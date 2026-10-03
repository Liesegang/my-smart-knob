import { bundleOptions } from "./build.mjs";
import { build } from "esbuild";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "smartknob-tests-"));
try {
  const entries = (await readdir("test"))
    .filter((name) => name.endsWith(".test.js"))
    .sort();
  await build({
    ...bundleOptions,
    entryPoints: entries.map((name) => join("test", name)),
    outdir: directory,
    outExtension: { ".js": ".mjs" },
    platform: "node",
    format: "esm",
  });
  const result = spawnSync(
    process.execPath,
    ["--test", ...entries.map((name) => join(directory, name.replace(/\.js$/, ".mjs")))],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
