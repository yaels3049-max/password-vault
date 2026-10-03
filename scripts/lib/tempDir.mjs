/**
 * Verify temp dirs under `node_modules/.tmp/pv-*` (inside the repo so bundled externals resolve
 * from node_modules). Every dir is removed in a `finally` — on pass and on fail. The exit hook is
 * only a safety net for `process.exit()` paths that skip `finally`.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TMP_BASE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', '.tmp');
const live = new Set();
let exitHooked = false;

/** Creates `node_modules/.tmp/<prefix>XXXXXX`; the caller removes it in a `finally` (`removeTempDir`). */
export function makeTempDir(prefix) {
  if (!prefix.startsWith('pv-')) throw new Error(`temp dir prefix must start with "pv-" (${prefix})`);
  mkdirSync(TMP_BASE, { recursive: true });
  const dir = mkdtempSync(join(TMP_BASE, prefix));
  live.add(dir);
  if (!exitHooked) {
    exitHooked = true;
    process.on('exit', removeAllTempDirs);
  }
  return dir;
}

export function removeTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  live.delete(dir);
}

export function removeAllTempDirs() {
  for (const dir of [...live]) removeTempDir(dir);
}

/** Runs `fn(dir)` and removes the dir in a `finally`, on pass and on fail. */
export async function withTempDir(prefix, fn) {
  const dir = makeTempDir(prefix);
  try {
    return await fn(dir);
  } finally {
    removeTempDir(dir);
  }
}
