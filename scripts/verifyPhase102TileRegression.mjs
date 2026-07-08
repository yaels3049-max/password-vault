/**
 * Phase 102 tile regression — SUPERSEDED by Phase 103.
 *
 * Usage: node scripts/verifyPhase102TileRegression.mjs
 * Delegates to verifyPhase103Execution.mjs (authoritative post-103).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const phase103Script = join(__dirname, 'verifyPhase103Execution.mjs');

console.log(
  'NOTE: verifyPhase102TileRegression.mjs is superseded by verifyPhase103Execution.mjs (Phase 103).',
);
console.log('');

const result = spawnSync(process.execPath, [phase103Script], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
});

process.exit(result.status ?? 1);
