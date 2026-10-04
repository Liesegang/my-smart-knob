import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream";

// Keep the dev server's public surface explicit, including the one demo movie.
const files = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/controller.js", "controller.js"],
  ["/style.css", "style.css"],
  ["/desktop.js", "desktop.js"],
  ["/coast.png", "coast.png"],
  ["/media/big-buck-bunny.mp4", "media/big-buck-bunny.mp4"],
  ["/media/README.md", "media/README.md"],
]);
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
  mp4: "video/mp4",
  md: "text/plain; charset=utf-8",
};

function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || !size) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return false;
    if (start >= size || start > end) return false;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export function createRequestHandler(root = new URL("./dist/", import.meta.url)) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    let filename;
    try {
      filename = files.get(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!filename) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const file = new URL(filename, root);
      const { size } = await stat(file);
      const headers = {
        "Content-Type": types[filename.split(".").at(-1)],
        "Content-Length": size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
      };
      // RFC 9110: Range only changes GET. HEAD reports the complete resource.
      const range = req.method === "GET" ? byteRange(req.headers.range, size) : null;
      if (range === false) {
        res.writeHead(416, {
          ...headers,
          "Content-Length": 0,
          "Content-Range": `bytes */${size}`,
        });
        res.end();
        return;
      }
      if (range) {
        headers["Content-Length"] = range.end - range.start + 1;
        headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
      }
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === "HEAD" || size === 0) {
        res.end();
        return;
      }
      // Streams limit memory use and close the file when a seek cancels a request.
      pipeline(createReadStream(file, range || {}), res, (error) => {
        if (error && !res.destroyed) res.destroy(error);
      });
    } catch {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Build output unavailable");
      } else {
        res.destroy();
      }
    }
  };
}
