import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(rootDir, '..', 'extension', 'discovery');
const outfile = path.join(outDir, 'login-entry-discovery.js');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, '..', 'src', 'extension', 'discoveryPageEntry.ts')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome93'],
  logLevel: 'info',
});

console.log(`Built ${outfile}`);
