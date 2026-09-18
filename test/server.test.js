const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Readable, Writable } = require("node:stream");
const { createHandler } = require("../server");

const mockTitle = {
  id: "flextv:12418",
  platform: "flextv",
  lang: "id",
  title: "Kisah Contoh",
  synopsis: "Sinopsis contoh",
  tags: ["Romansa"],
  episode_count: 1,
  status: "completed",
  poster: "https://cdn.syln.dev/poster.webp",
};

function response(data, meta) {
  return { success: true, data, meta, rateLimit: { limit: 60, remaining: 59 } };
}

function mockClient() {
  return {
    platforms: async () => response([{ platform: "flextv", enabled: true, batch: "yes", titles: 1 }]),
    languages: async () => response([{ lang: "id" }]),
    catalog: async () => response([mockTitle], { page: 1, limit: 18, count: 1 }),
    search: async () => response([mockTitle], { page: 1, limit: 18, count: 1 }),
    title: async () => response(mockTitle),
    episodes: async () => response([{ ep: 1, title: null, duration_sec: 90, resolutions: [720], thumb: null }]),
    play: async () => response({ ep: 1, resolution: 720, url: "https://cdn.syln.dev/video.mp4?t=x&s=y", expires_in: 300, subtitles: [], codec: "h264" }),
  };
}

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
    this.chunks = [];
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), String(value));
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }

  writeHead(status, headers = {}) {
    this.statusCode = status;
    Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    return this;
  }
}

async function invoke({ method = "GET", url = "/", body, mediaFetch, videoRemuxer, quickTimeCompat = true } = {}) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = url;
  const response = new MockResponse();
  const finished = new Promise((resolve, reject) => {
    response.once("finish", resolve);
    response.once("error", reject);
  });
  await createHandler(mockClient(), mediaFetch, videoRemuxer, quickTimeCompat)(request, response);
  await finished;
  return {
    status: response.statusCode,
    headers: response.headers,
    text: Buffer.concat(response.chunks).toString("utf8"),
  };
}

test("serves the streaming interface with security headers", async () => {
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.match(result.headers.get("content-security-policy"), /cdn\.syln\.dev/);
  assert.match(result.text, /DRACROT/);
});

test("serves Daftar Saya as a separate page", async () => {
  const result = await invoke({ url: "/favorites.html" });
  assert.equal(result.status, 200);
  assert.match(result.text, /Daftar Saya/);
  assert.match(result.text, /favorites\.js/);
});

test("proxies catalog data without exposing credentials", async () => {
  const result = await invoke({ url: "/api/catalog?lang=id&page=1&limit=18" });
  const body = JSON.parse(result.text);
  assert.equal(result.status, 200);
  assert.equal(body.data[0].title, "Kisah Contoh");
  assert.equal(result.text.includes("SYLN_TOKEN"), false);
});

test("validates search and playback inputs", async () => {
  const search = await invoke({ url: "/api/search?q=a" });
  assert.equal(search.status, 400);

  const play = await invoke({ method: "POST", url: "/api/play", body: { id: "not-valid", ep: 1 } });
  assert.equal(play.status, 400);
});

test("downloads one episode with a safe, readable filename", async () => {
  const mediaFetch = async (url) => {
    assert.equal(url.hostname, "cdn.syln.dev");
    return new Response(Buffer.from("video-bytes"), {
      status: 200,
      headers: { "Content-Type": "video/mp4", "Content-Length": "11" },
    });
  };
  const videoRemuxer = (sourcePath, outputPath) => fs.promises.copyFile(sourcePath, outputPath);
  const title = encodeURIComponent("Kisah: Contoh/Bagus");
  const result = await invoke({
    url: `/api/download?id=flextv:12418&ep=1&res=720&lang=id&title=${title}`,
    mediaFetch,
    videoRemuxer,
  });

  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "video/mp4");
  assert.equal(result.headers.get("x-dracrot-container"), "standard-mp4");
  assert.match(result.headers.get("content-disposition"), /Episode%2001\.mp4/);
  assert.equal(result.text, "video-bytes");
});

test("can pass through the original download when QuickTime compatibility is disabled", async () => {
  let remuxCalled = false;
  const mediaFetch = async () => new Response(Buffer.from("original-video"), {
    status: 200,
    headers: { "Content-Type": "video/mp4", "Content-Length": "14" },
  });
  const result = await invoke({
    url: "/api/download?id=flextv:12418&ep=1&res=720&title=Kisah",
    mediaFetch,
    videoRemuxer: async () => { remuxCalled = true; },
    quickTimeCompat: false,
  });

  assert.equal(result.status, 200);
  assert.equal(result.headers.get("x-dracrot-container"), "original");
  assert.equal(result.headers.get("content-length"), "14");
  assert.equal(result.text, "original-video");
  assert.equal(remuxCalled, false);
});
