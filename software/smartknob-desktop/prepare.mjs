import { mkdir, copyFile, constants } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pbjs from 'protobufjs-cli/pbjs.js';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('.', import.meta.url));
process.chdir(root);
await mkdir('.generated', { recursive: true });
await new Promise((resolve, reject) => pbjs.main([
  '-t','static-module','-w','commonjs','--no-service','--no-delimited',
  '-p','../../thirdparty/nanopb/generator/proto','-o','.generated/smartknob.cjs','../../proto/smartknob.proto'
], error => error ? reject(error) : resolve()));
// Reuse the tested transport without depending on a sibling node_modules/build.
await build({
  entryPoints:['../smartknob-demo/src/protocol.js'], outfile:'.generated/transport.js',
  bundle:true, format:'esm', platform:'browser', target:'chrome120',
  alias:{'protobufjs/minimal': require.resolve('protobufjs/minimal.js')},
  plugins:[{name:'local-schema', setup(b) {
    b.onResolve({filter:/smartknob\.cjs$/}, () => ({path: `${root}.generated/smartknob.cjs`}));
  }}]
});
await mkdir('public/media', {recursive:true});
for (const file of ['big-buck-bunny.mp4','README.md'])
  await copyFile(`../smartknob-demo/media/${file}`, `public/media/${file}`, constants.COPYFILE_FICLONE);
