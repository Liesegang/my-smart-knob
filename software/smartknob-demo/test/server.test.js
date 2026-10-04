import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createRequestHandler } from "../server.mjs";

test("local media serves full files, byte ranges, and HEAD without exposing other paths", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "smartknob-server-"));
  await mkdir(join(directory, "media"));
  const fixture = Buffer.from("0123456789abcdefghijklmnopqrstuvwxyz");
  await writeFile(join(directory, "media/big-buck-bunny.mp4"), fixture);
  await writeFile(join(directory, "index.html"), "<!doctype html><title>Demo</title>");
  await writeFile(join(directory, "desktop.js"), "export const desktop = true;");
  await writeFile(join(directory, "coast.png"), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(directory, "private.txt"), "not public");
  const server = createServer(createRequestHandler(pathToFileURL(`${directory}/`)));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/media/big-buck-bunny.mp4`;

  const desktop = await fetch(`${origin}/desktop.js`);
  assert.equal(desktop.status, 200);
  assert.match(desktop.headers.get("content-type"), /^text\/javascript/);
  assert.match(await desktop.text(), /export const desktop/);
  const wallpaper = await fetch(`${origin}/coast.png`);
  assert.equal(wallpaper.status, 200);
  assert.equal(wallpaper.headers.get("content-type"), "image/png");

  const full = await fetch(url);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "video/mp4");
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.equal(full.headers.get("content-length"), "36");
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), fixture);

  const head = await fetch(url, { method: "HEAD", headers: { Range: "bytes=3-7" } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "36");
  assert.equal(await head.text(), "");

  for (const [range, start, end] of [
    ["bytes=3-7", 3, 7],
    ["bytes=30-", 30, 35],
    ["bytes=-4", 32, 35],
    ["bytes=30-900", 30, 35],
    ["bytes=-100", 0, 35],
  ]) {
    const partial = await fetch(url, { headers: { Range: range } });
    assert.equal(partial.status, 206, range);
    assert.equal(partial.headers.get("content-range"), `bytes ${start}-${end}/36`);
    assert.equal(partial.headers.get("content-length"), `${end - start + 1}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), fixture.subarray(start, end + 1));
  }

  for (const range of ["bytes=36-", "bytes=7-3", "bytes=-0", "bytes=-", "bytes=0-2,4-6"]) {
    const invalid = await fetch(url, { headers: { Range: range } });
    assert.equal(invalid.status, 416, range);
    assert.equal(invalid.headers.get("content-range"), "bytes */36");
    assert.equal(await invalid.text(), "");
  }
  for (const pathname of ["/private.txt", "/media/other.mp4", "/%2e%2e/private.txt"]) {
    assert.equal((await fetch(`${origin}${pathname}`)).status, 404, pathname);
  }
  const method = await fetch(url, { method: "POST" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
});
