import { build } from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pbjs from "protobufjs-cli/pbjs.js";
const require = createRequire(import.meta.url);
process.chdir(fileURLToPath(new URL(".", import.meta.url)));
await mkdir(".generated", { recursive: true });
// Generate from the repository schema, including nanopb options. No prebuilt
// sibling workspace or CDN dependency is needed in a fresh checkout.
await new Promise((resolve, reject) =>
  pbjs.main(
    [
      "-t",
      "static-module",
      "-w",
      "commonjs",
      "--no-service",
      "--no-delimited",
      "-p",
      "../../thirdparty/nanopb/generator/proto",
      "-o",
      ".generated/smartknob.cjs",
      "../../proto/smartknob.proto",
    ],
    (error) => (error ? reject(error) : resolve()),
  ),
);
export const bundleOptions = {
  bundle: true,
  alias: { "protobufjs/minimal": require.resolve("protobufjs/minimal.js") },
};
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  ...bundleOptions,
  entryPoints: ["src/controller.js"],
  outdir: "dist",
  format: "iife",
  target: "chrome120",
});
for (const name of ["index.html", "style.css"])
  await copyFile(`src/${name}`, `dist/${name}`);
await mkdir("dist/media", { recursive: true });
for (const name of ["big-buck-bunny.mp4", "README.md"])
  await copyFile(`media/${name}`, `dist/media/${name}`);
console.log("Built SmartKnob Demo → dist/");
