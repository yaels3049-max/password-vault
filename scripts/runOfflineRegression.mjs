/**
 * Offline regression: every top-level `scripts/verify*.mjs`, one at a time.
 * Not included: `scripts/retired/` (superseded, see its README) and the live-only scripts below.
 * Usage: node scripts/runOfflineRegression.mjs [--skip=<name>[,<name>…]]
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Need the live Supabase project; run only on purpose. */
export const LIVE_ONLY = ['verifyPhase101Supabase.mjs', 'verifyPhase102Registry.mjs'];

const skipArg = (process.argv.find((a) => a.startsWith('--skip=')) ?? '').slice('--skip='.length);
const skip = new Set(skipArg ? skipArg.split(',').map((s) => (s.endsWith('.mjs') ? s : `${s}.mjs`)) : []);

const files = readdirSync(join(root, 'scripts'))
  .filter((f) => /^verify.*\.mjs$/.test(f) && !LIVE_ONLY.includes(f) && !skip.has(f))
  .sort();

const failed = [];
for (const f of files) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [join('scripts', f)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90 * 60 * 1000,
    maxBuffer: 256 * 1024 * 1024,
  });
  const ok = r.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${f} (${Math.round((Date.now() - t) / 1000)}s${ok ? '' : `, exit ${r.status}${r.signal ? ` ${r.signal}` : ''}`})`);
  if (!ok) {
    failed.push(f);
    console.log(`${(r.stdout || '').slice(-1500)}\n${(r.stderr || '').slice(-1500)}`);
  }
}

console.log(`\n${files.length} scripts, ${files.length - failed.length} PASS, ${failed.length} FAIL (live-only not run: ${LIVE_ONLY.join(', ')}${skip.size ? `; skipped: ${[...skip].join(', ')}` : ''})`);
process.exit(failed.length ? 1 : 0);
