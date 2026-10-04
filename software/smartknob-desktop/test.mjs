import './prepare.mjs';
import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const outdir=await mkdtemp(join(tmpdir(),'smartknob-desktop-tests-'));
try {
  const names=(await readdir('test')).filter(n=>n.endsWith('.test.js'));
  await build({entryPoints:names.map(n=>`test/${n}`),outdir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
  const result=spawnSync(process.execPath,['--test',...names.map(n=>join(outdir,n.replace(/\.js$/,'.mjs')))],{stdio:'inherit'});
  process.exitCode=result.status??1;
} finally { await rm(outdir,{recursive:true,force:true}); }
