/**
 * Phase 120.2 — Shufersal Managed migration pilot — static evidence (config-only).
 * Does NOT prove live P1 path or Admin validated profile.
 * Usage: node scripts/verifyPhase120ShufersalMigration.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function main() {
  const builtin = read('src/catalog/builtinCatalog.ts');
  const exec = read('src/execution/serviceExecution.ts');
  const managed = read('src/execution/managedAutofill.ts');
  const generic = read('src/execution/genericAutofill.ts');
  const bg = read('extension/background.js');
  const sqlSeed = read(
    'supabase/migrations/20260703120100_phase102_seed_builtin.sql',
  );
  const adapterCheck = read('scripts/checkRegistryAdapterIds.mjs');

  // AC-120.2-1 catalog remains normal shufersal
  const shufBlock = builtin.slice(
    builtin.indexOf("id: 'shufersal'"),
    builtin.indexOf("id: 'rami-levy'"),
  );
  assert(shufBlock.includes("id: 'shufersal'"), 'AC-120.2-1 catalog id shufersal');
  assert(
    shufBlock.includes("loginUrl: 'https://www.shufersal.co.il/online/he/login'"),
    'AC-120.2-1 seed Login Entry',
  );
  assert(
    shufBlock.includes("id: 'email'") && shufBlock.includes("id: 'password'"),
    'builtin seed still has email+password (seed hygiene out of 120.2 — do not rewrite)',
  );
  assert(
    !shufBlock.includes("id: 'username'"),
    'builtin seed must NOT be rewritten to username in this slice',
  );
  assert(
    !shufBlock.includes('adapterId'),
    'AC-120.2-1/2 seed has no adapterId',
  );

  // SQL seed aligned
  assert(
    sqlSeed.includes("'shufersal'") &&
      sqlSeed.includes('https://www.shufersal.co.il/online/he/login') &&
      sqlSeed.includes('"id":"email"') &&
      sqlSeed.includes('"id":"password"'),
    'AC-120.2-1 SQL seed matches email/password + Login Entry',
  );

  // AC-120.2-2 no shufersal adapter file
  const adaptersDir = join(root, 'src', 'adapters');
  if (existsSync(adaptersDir)) {
    const names = readdirSync(adaptersDir).join(',');
    assert(!/shufersal/i.test(names), 'AC-120.2-2 no shufersal adapter module');
  }
  assert(
    adapterCheck.includes('shufersal: null'),
    'AC-120.2-2 checkRegistry expects shufersal adapter_id null',
  );

  // AC-120.2-3 no hostname/serviceId runtime branch for shufersal in orchestrator/Managed
  assert(
    !/serviceId\s*===\s*['"]shufersal['"]|['"]shufersal['"]\s*===/.test(exec),
    'AC-120.2-3 no serviceId===shufersal in serviceExecution',
  );
  assert(
    !/serviceId\s*===\s*['"]shufersal['"]/.test(managed),
    'AC-120.2-3 no serviceId===shufersal in managedAutofill',
  );
  assert(
    !/hostname\s*===\s*['"][^'"]*shufersal/i.test(exec + managed),
    'AC-120.2-3 no shufersal hostname branch',
  );

  // AC-120.2-8 Managed fail does not call generic (orchestrator structure)
  const managedGate = exec.slice(
    exec.indexOf('serviceClaimsValidatedManagedProfile'),
    exec.indexOf("complexity === 'complex'"),
  );
  assert(
    managedGate.includes('executeManagedAutofill'),
    'AC-120.2-8 Managed gate calls executeManagedAutofill',
  );
  assert(
    !managedGate.includes('executeGenericAutofill'),
    'AC-120.2-8 Managed gate body does not call executeGenericAutofill',
  );
  assert(
    managedGate.includes("status: 'open_only'") ||
      managedGate.includes("status: \"open_only\""),
    'AC-120.2-8 Managed failure returns open_only',
  );

  // Generic still present for others (not deleted)
  assert(
    exec.includes('executeGenericAutofill') &&
      generic.includes("POC_GENERIC_FILL"),
    'AC-120.2-9 legacy generic still present',
  );
  assert(
    bg.includes("message.type === 'HUB_MANAGED_AUTOFILL'") &&
      bg.includes("message.type === 'POC_GENERIC_FILL'"),
    'AC-120.2-9/10 both Managed and generic extension handlers retained',
  );
  assert(
    managed.includes("HUB_MANAGED_AUTOFILL"),
    'P1 message constant present in Hub Managed path',
  );

  // No Clalit migration artifacts under 120.2
  assert(
    !existsSync(join(root, 'team-Yuri', 'dev-phase120-clalit.md')),
    'no Clalit migration artifact',
  );

  console.log('verifyPhase120ShufersalMigration: PASS (static)');
  console.log('  - builtin seed hygiene preserved (email+password; not rewritten to username)');
  console.log('  - AC-120.2-2 no shufersal adapter');
  console.log('  - AC-120.2-3 no shufersal serviceId/hostname runtime branch');
  console.log('  - AC-120.2-8 Managed fail ≠ generic fallback');
  console.log('  - AC-120.2-9 generic retained');
  console.log('  - Live baseline username/password + S3–S7/P1/P3 are Operator Admin evidence');
}

main();
