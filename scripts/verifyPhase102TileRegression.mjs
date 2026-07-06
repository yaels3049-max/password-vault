/**
 * Phase 102 tile execution regression checks (static).
 *
 * Usage: node scripts/verifyPhase102TileRegression.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readAdapterIdForService(serviceId) {
  const text = readFileSync(join(root, 'src/catalog/builtinCatalog.ts'), 'utf8');
  const blockPattern = new RegExp(
    `id:\\s*'${serviceId}'[\\s\\S]*?\\n\\s*\\},`,
  );
  const block = text.match(blockPattern)?.[0];
  if (!block) {
    return null;
  }
  const adapterMatch = block.match(/adapterId:\s*'([^']+)'/);
  return adapterMatch?.[1] ?? null;
}

function readServiceExecutionSource() {
  return readFileSync(join(root, 'src/execution/serviceExecution.ts'), 'utf8');
}

function main() {
  assert(readAdapterIdForService('shufersal') === 'generic', 'shufersal must use adapterId generic');
  assert(readAdapterIdForService('clalit') === 'generic', 'clalit must use adapterId generic');
  assert(readAdapterIdForService('hapoalim') === null, 'hapoalim must not use an adapter in Phase 102');
  assert(readAdapterIdForService('leumi') === null, 'leumi must not use an adapter in Phase 102');
  assert(readAdapterIdForService('htzone') === 'htzone', 'htzone must keep htzone adapter');

  const registry = readFileSync(join(root, 'src/execution/adapters/registry.ts'), 'utf8');
  assert(registry.includes('generic: genericAutofillAdapter'), 'generic adapter must be registered');

  const execution = readServiceExecutionSource();
  assert(
    !/shufersal|clalit/.test(execution),
    'serviceExecution must not branch on service ids',
  );
  assert(
    execution.includes('getServiceAdapter'),
    'serviceExecution must route through adapter registry',
  );

  const dashboard = readFileSync(join(root, 'src/Dashboard.tsx'), 'utf8');
  assert(
    !/discoverAndPersistLoginUrl|discoverLogin/.test(dashboard),
    'Dashboard tile click must not run discovery',
  );

  const overlay = readFileSync(join(root, 'src/catalog/builtinCatalogOverlay.ts'), 'utf8');
  assert(overlay.includes('applyBuiltinCatalogOverlay'), 'builtin catalog overlay must exist for stale registry rows');

  const loader = readFileSync(join(root, 'src/registry/registryLoader.ts'), 'utf8');
  assert(
    loader.includes('applyBuiltinCatalogOverlayAll'),
    'registryLoader must apply builtin overlay after fetch',
  );

  const migration = readFileSync(
    join(root, 'supabase/migrations/20260706120000_phase102_restore_generic_autofill.sql'),
    'utf8',
  );
  assert(migration.includes("'shufersal'"), 'migration must update shufersal adapter_id');
  assert(migration.includes("'clalit'"), 'migration must update clalit adapter_id');

  console.log('PASS: Phase 102 tile regression (static)');
  console.log('  generic adapter: shufersal, clalit');
  console.log('');
  console.log('Manual browser regression:');
  console.log('  1. Shufersal — opens loginUrl, extension autofills saved credentials');
  console.log('  2. Clalit — opens loginUrl, extension autofills saved credentials');
  console.log('  3. Leumi (or similar) — opens URL only, tab stays open');
  console.log('  4. Custom service — opens URL only, tab stays open');
}

main();
