const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { Syln, SylnError } = require("@syln/sdk");

const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 8 * 1024;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://cdn.syln.dev data:; media-src https://cdn.syln.dev blob:; style-src 'self'; script-src 'self'; connect-src 'self' https://cdn.syln.dev; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
}

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(body);
}

function publicError(error) {
  if (error instanceof SylnError) {
    const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 502;
    const headers = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
    return {
      status,
      headers,
      body: {
        success: false,
        error: status === 429
          ? `Batas permintaan tercapai. Coba lagi dalam ${error.retryAfter || "beberapa"} detik.`
          : error.message || "Layanan Syln sedang tidak tersedia.",
        requestId: error.requestId,
      },
    };
  }

  console.error(error);
  return {
    status: 500,
    headers: {},
    body: { success: false, error: "Terjadi kesalahan pada server." },
  };
}

function parsePositiveInteger(value, fallback, max = 10000) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value);
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function requireTitleId(value) {
  if (!value || !/^[a-z0-9_-]+:[a-zA-Z0-9_-]+$/.test(value)) {
    const error = new Error("ID judul tidak valid.");
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function safeDownloadName(value, episode) {
  const cleanTitle = String(value || "Dracrot")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Dracrot";
  return `${cleanTitle} - Episode ${String(episode).padStart(2, "0")}.mp4`;
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function remuxMp4(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", sourcePath,
      "-map", "0",
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let errorOutput = "";
    process.stderr.on("data", (chunk) => {
      if (errorOutput.length < 8192) errorOutput += chunk.toString("utf8");
    });
    process.once("error", (error) => {
      error.statusCode = 500;
      error.message = error.code === "ENOENT"
        ? "FFmpeg belum tersedia di server untuk menyiapkan MP4 kompatibel."
        : "Video gagal dinormalisasi.";
      reject(error);
    });
    process.once("close", (code) => {
      if (code === 0) return resolve();
      const error = new Error(`Video gagal dinormalisasi.${errorOutput ? ` ${errorOutput.trim()}` : ""}`);
      error.statusCode = 502;
      reject(error);
    });
  });
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Permintaan terlalu besar.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Format JSON tidak valid.");
    error.statusCode = 400;
    throw error;
  }
}

function queryCatalogParams(searchParams) {
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const limit = parsePositiveInteger(searchParams.get("limit"), 18, 100);
  if (page === null || limit === null) {
    const error = new Error("Halaman atau jumlah item tidak valid.");
    error.statusCode = 400;
    throw error;
  }

  const params = { page, limit, has_media: true };
  for (const key of ["platform", "lang", "feed"]) {
    const value = searchParams.get(key)?.trim();
    if (value) params[key] = value.slice(0, 100);
  }
  return params;
}

function createHandler(client, mediaFetch = globalThis.fetch, videoRemuxer = remuxMp4, quickTimeCompat = true) {
  return async function handler(request, response) {
    setSecurityHeaders(response);
    const url = new URL(request.url, "http://localhost");

    try {
      if (url.pathname.startsWith("/api/")) {
        if (!client) {
          return sendJson(response, 503, {
            success: false,
            error: "Server belum memiliki SYLN_TOKEN. Isi .env.local lalu jalankan ulang.",
          });
        }

        let result;
        if (request.method === "GET" && url.pathname === "/api/platforms") {
          result = await client.platforms();
        } else if (request.method === "GET" && url.pathname === "/api/languages") {
          result = await client.languages(url.searchParams.get("platform") || undefined);
        } else if (request.method === "GET" && url.pathname === "/api/catalog") {
          const params = queryCatalogParams(url.searchParams);
          result = await client.catalog(params);
        } else if (request.method === "GET" && url.pathname === "/api/search") {
          const query = (url.searchParams.get("q") || "").trim();
          if (query.length < 2) {
            return sendJson(response, 400, { success: false, error: "Kata pencarian minimal 2 karakter." });
          }
          result = await client.search(query.slice(0, 100), queryCatalogParams(url.searchParams));
        } else if (request.method === "GET" && url.pathname === "/api/title") {
          const id = requireTitleId(url.searchParams.get("id"));
          const lang = url.searchParams.get("lang") || undefined;
          result = await client.title(id, lang ? { lang } : undefined);
        } else if (request.method === "GET" && url.pathname === "/api/episodes") {
          result = await client.episodes(requireTitleId(url.searchParams.get("id")));
        } else if (request.method === "POST" && url.pathname === "/api/play") {
          const body = await readJson(request);
          const id = requireTitleId(body.id);
          const ep = parsePositiveInteger(body.ep, null, 100000);
          const res = body.res === undefined || body.res === null
            ? undefined
            : parsePositiveInteger(body.res, null, 4320);
          if (ep === null || (body.res !== undefined && body.res !== null && (res === null || res < 144))) {
            return sendJson(response, 400, { success: false, error: "Episode atau resolusi tidak valid." });
          }
          result = await client.play(id, ep, { res, lang: body.lang || undefined });
        } else if (request.method === "GET" && url.pathname === "/api/download") {
          const id = requireTitleId(url.searchParams.get("id"));
          const ep = parsePositiveInteger(url.searchParams.get("ep"), null, 100000);
          const rawRes = url.searchParams.get("res");
          const res = rawRes ? parsePositiveInteger(rawRes, null, 4320) : undefined;
          if (ep === null || (rawRes && (res === null || res < 144))) {
            return sendJson(response, 400, { success: false, error: "Episode atau resolusi tidak valid." });
          }

          const playback = await client.play(id, ep, {
            res,
            lang: url.searchParams.get("lang") || undefined,
          });
          const signedUrl = new URL(playback.data.url);
          if (signedUrl.protocol !== "https:" || signedUrl.hostname !== "cdn.syln.dev") {
            throw new Error("URL media tidak valid.");
          }

          const upstream = await mediaFetch(signedUrl, { redirect: "error" });
          if (!upstream.ok || !upstream.body) {
            const error = new Error("Video gagal diunduh dari penyedia media.");
            error.statusCode = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
            throw error;
          }

          const filename = safeDownloadName(url.searchParams.get("title"), ep);
          const downloadHeaders = {
            "Content-Type": "video/mp4",
            "Content-Disposition": contentDisposition(filename),
            "Cache-Control": "no-store",
            "X-Dracrot-Resolution": String(playback.data.resolution || res || "unknown"),
          };

          if (!quickTimeCompat) {
            const contentLength = upstream.headers.get("content-length");
            response.writeHead(200, {
              ...downloadHeaders,
              ...(contentLength ? { "Content-Length": contentLength } : {}),
              "X-Dracrot-Container": "original",
            });
            const mediaStream = Readable.fromWeb(upstream.body);
            mediaStream.once("error", (error) => response.destroy(error));
            return mediaStream.pipe(response);
          }

          const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "dracrot-download-"));
          const sourcePath = path.join(tempDir, "source.mp4");
          const outputPath = path.join(tempDir, "ready.mp4");
          try {
            await pipeline(Readable.fromWeb(upstream.body), fs.createWriteStream(sourcePath));
            await videoRemuxer(sourcePath, outputPath);
            if (response.destroyed) {
              await fs.promises.rm(tempDir, { recursive: true, force: true });
              return;
            }

            const stat = await fs.promises.stat(outputPath);
            response.writeHead(200, {
              ...downloadHeaders,
              "Content-Length": stat.size,
              "X-Dracrot-Container": "standard-mp4",
            });

            let cleaned = false;
            const cleanup = () => {
              if (cleaned) return;
              cleaned = true;
              fs.promises.rm(tempDir, { recursive: true, force: true }).catch(console.error);
            };
            response.once("finish", cleanup);
            response.once("close", cleanup);
            const fileStream = fs.createReadStream(outputPath);
            fileStream.once("error", (error) => {
              cleanup();
              response.destroy(error);
            });
            return fileStream.pipe(response);
          } catch (error) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            throw error;
          }
        } else {
          return sendJson(response, 404, { success: false, error: "Endpoint tidak ditemukan." });
        }

        return sendJson(response, 200, {
          success: true,
          data: result.data,
          meta: result.meta,
          rateLimit: result.rateLimit,
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        return response.end();
      }

      const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(requestedPath);
      } catch {
        response.writeHead(400);
        return response.end("Bad Request");
      }
      const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
      if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        response.writeHead(403);
        return response.end("Forbidden");
      }

      let stat;
      try {
        stat = await fs.promises.stat(filePath);
      } catch {
        response.writeHead(404);
        return response.end("Not Found");
      }
      if (!stat.isFile()) {
        response.writeHead(404);
        return response.end("Not Found");
      }

      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
      });
      if (request.method === "HEAD") return response.end();
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      if (error.statusCode) {
        return sendJson(response, error.statusCode, { success: false, error: error.message });
      }
      const normalized = publicError(error);
      return sendJson(response, normalized.status, normalized.body, normalized.headers);
    }
  };
}

function createServer({ client, mediaFetch, videoRemuxer, quickTimeCompat } = {}) {
  const token = process.env.SYLN_TOKEN?.trim();
  const syln = client || (token ? new Syln({ token, timeoutMs: 15000 }) : null);
  const normalizeDownloads = quickTimeCompat ?? parseBoolean(process.env.DOWNLOAD_QUICKTIME_COMPAT, true);
  return http.createServer(createHandler(syln, mediaFetch, videoRemuxer, normalizeDownloads));
}

if (require.main === module) {
  const port = parsePositiveInteger(process.env.PORT, 3000, 65535) || 3000;
  createServer().listen(port, () => {
    console.log(`Dracrot siap di http://localhost:${port}`);
    console.log(`Kompatibilitas unduhan QuickTime: ${parseBoolean(process.env.DOWNLOAD_QUICKTIME_COMPAT, true) ? "aktif" : "nonaktif"}`);
    if (!process.env.SYLN_TOKEN) console.warn("SYLN_TOKEN belum diisi. Katalog belum dapat dimuat.");
  });
}

module.exports = { createHandler, createServer };
