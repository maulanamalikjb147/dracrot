const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
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

function requireTitleId(value) {
  if (!value || !/^[a-z0-9_-]+:[a-zA-Z0-9_-]+$/.test(value)) {
    const error = new Error("ID judul tidak valid.");
    error.statusCode = 400;
    throw error;
  }
  return value;
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

function createHandler(client) {
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

function createServer({ client } = {}) {
  const token = process.env.SYLN_TOKEN?.trim();
  const syln = client || (token ? new Syln({ token, timeoutMs: 15000 }) : null);
  return http.createServer(createHandler(syln));
}

if (require.main === module) {
  const port = parsePositiveInteger(process.env.PORT, 3000, 65535) || 3000;
  createServer().listen(port, () => {
    console.log(`Dracin siap di http://localhost:${port}`);
    if (!process.env.SYLN_TOKEN) console.warn("SYLN_TOKEN belum diisi. Katalog belum dapat dimuat.");
  });
}

module.exports = { createHandler, createServer };
