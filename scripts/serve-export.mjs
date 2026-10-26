// Test the actual Pages export, including the repository base path.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("out");
const types = {
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const prefix = "/CURA-CAF-/";
  if (!pathname.startsWith(prefix)) {
    res.writeHead(404).end();
    return;
  }
  const file = resolve(
    root,
    pathname.slice(prefix.length) +
      (pathname.endsWith("/") ? "index.html" : ""),
  );
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      res.writeHead(301, { Location: pathname + "/" }).end();
      return;
    }
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4173, "127.0.0.1");
