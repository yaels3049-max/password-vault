/**
 * Phase 108 — adapterId architecture compliance (static).
 *
 * Proves:
 *   - Only htzone + practice are site-specific adapters
 *   - executeServiceFromTile routes by adapterId, not service id
 *   - Clalit / Shufersal have no adapterId in catalog (generic autofill)
 *   - HTZone / practice declare approved adapterId in seed
 *   - Empty-DB restore passes adapterId from catalog
 *   - No shufersal/clalit/leumi/hapoalim branching in orchestrator
 *
 * Usage: node scripts/verifyPhase108AdapterRouting.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readAdapterIdForService(serviceId) {
  const text = read('src/catalog/builtinCatalog.ts');
  const blockPattern = new RegExp(`id:\\s*'${serviceId}'[\\s\\S]*?\\n\\s*\\},`);
  const block = text.match(blockPattern)?.[0];
  if (!block) {
    return null;
  }
  const adapterMatch = block.match(/adapterId:\s*'([^']+)'/);
  return adapterMatch?.[1] ?? null;
}

function main() {
  const registry = read('src/execution/adapters/registry.ts');
  const execution = read('src/execution/serviceExecution.ts');
  const eligibility = read('src/execution/autofillEligibility.ts');
  const persistence = read('src/supabase/registryPersistence.ts');
  const seed = read('supabase/migrations/20260703120100_phase102_seed_builtin.sql');
  const compliance = read(
    'supabase/migrations/20260712150000_phase108_adapter_id_compliance.sql',
  );

  assert(registry.includes("'practice'"), 'Adapters: practice only (120.3.6)');
  assert(!registry.includes("'htzone'"), '120.3.6: htzone adapter removed from registry');
  assert(!registry.includes('genericAutofillAdapter') && !registry.includes('generic:'), 'No generic adapter registry entry');

  assert(execution.includes('isSiteSpecificAdapter') && execution.includes('executeGenericAutofill'), 'Orchestrator: adapter then generic');
  assert(!/shufersal|clalit|leumi|hapoalim/.test(execution), 'Orchestrator must not branch on service ids');
  assert(!/shufersal|clalit|leumi|hapoalim/.test(eligibility), 'Eligibility must not branch on service ids');

  assert(readAdapterIdForService('htzone') === null, '120.3.6: HTZone catalog adapterId cleared');
  assert(readAdapterIdForService('hub-practice-login') === 'practice', 'Practice catalog adapterId=practice');
  assert(readAdapterIdForService('clalit') === null, 'Clalit catalog adapterId must be null (generic)');
  assert(readAdapterIdForService('shufersal') === null, 'Shufersal catalog adapterId must be null (generic)');

  assert(seed.includes("'clalit'") && !/'clalit'[\s\S]{0,500}'generic'/.test(seed), 'SQL seed: clalit must not use generic adapter');
  assert(seed.includes("'shufersal'") && !/'shufersal'[\s\S]{0,500}'generic'/.test(seed), 'SQL seed: shufersal must not use generic adapter');
  // Historical phase102 seed may still list htzone adapter_id; 120.3.6 migration clears live rows.
  assert(
    existsSync(join(root, 'supabase/migrations/20260922120000_phase120_clear_htzone_adapter_id.sql')),
    '120.3.6 migration clears htzone adapter_id',
  );

  assert(
    persistence.includes("p_adapter_id: definition.adapterId ?? null"),
    'Empty-DB restore must pass catalog adapterId into ensure RPC',
  );
  assert(
    compliance.includes("adapter_id = 'htzone'") &&
      compliance.includes("adapter_id = null") &&
      compliance.includes('adapter_id = excluded.adapter_id'),
    'Historical compliance migration (superseded for htzone by 120.3.6 clear)',
  );

  console.log('PASS: Phase 108 adapterId architecture compliance (static) — post 120.3.6');
  console.log('  adapters: practice only');
  console.log('  htzone: adapterId cleared (no dedicated Autofill)');
  console.log('  clalit/shufersal: generic autofill (adapterId null)');
  console.log('  empty-DB restore: adapterId from builtinCatalog seed');
}

main();
