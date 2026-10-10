// リポジトリ直下を配る、依存なしの静的サーバー。
// MZ は file:// では動かないので、テストはこのサーバー越しに index.html を開く。
//   import { startServer } from "./serve.mjs";
//   const { url, close } = await startServer();   // url は "http://127.0.0.1:<port>/"
// 単独で動かすと手元のブラウザで遊べる：node tests/serve.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".efkefc": "application/octet-stream",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function handle(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.join(ROOT, pathname);
  // リポジトリの外は配らない
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
}

/** 空いているポート（既定）で起動し、{ url, port, close } を返す。 */
export function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const p = server.address().port;
      resolve({
        url: `http://127.0.0.1:${p}/`,
        port: p,
        close: () => new Promise(r => server.close(() => r())),
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startServer(Number(process.argv[2] || 8000));
  console.log(`配信中: ${url}index.html （止めるには Ctrl+C）`);
}
