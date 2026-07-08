/**
 * Phase 103 unified execution verification (static).
 *
 * Authoritative post-103 tile regression script.
 * Supersedes scripts/verifyPhase102TileRegression.mjs (Phase 102 generic-adapter expectations).
 *
 * Usage: node scripts/verifyPhase103Execution.mjs
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

function main() {
  // M1 — unified orchestrator
  const execution = read('src/execution/serviceExecution.ts');
  assert(
    execution.includes('shouldAttemptGenericAutofill'),
    'serviceExecution must use autofillEligibility',
  );
  assert(
    execution.includes('executeGenericAutofill'),
    'serviceExecution default path must call executeGenericAutofill',
  );
  assert(
    execution.includes('isSiteSpecificAdapter'),
    'serviceExecution must gate site-specific adapters only',
  );
  assert(
    !/shufersal|clalit|leumi|hapoalim/.test(execution),
    'serviceExecution must not branch on service ids',
  );
  assert(
    read('src/execution/autofillEligibility.ts').includes(
      'hasConfiguredLoginFields',
    ),
    'autofillEligibility must use hasConfiguredLoginFields',
  );

  // M2 — generic adapter retired
  const registry = read('src/execution/adapters/registry.ts');
  assert(
    !registry.includes('genericAutofillAdapter'),
    'genericAutofillAdapter must not be in adapter registry',
  );
  assert(
    !registry.includes('generic:'),
    'generic adapter id must not be registered',
  );
  assert(registry.includes('htzone'), 'htzone adapter must remain');
  assert(registry.includes('practice'), 'practice adapter must remain');

  assert(
    readAdapterIdForService('shufersal') === null,
    'shufersal must not use adapterId generic in builtinCatalog',
  );
  assert(
    readAdapterIdForService('clalit') === null,
    'clalit must not use adapterId generic in builtinCatalog',
  );
  assert(
    readAdapterIdForService('htzone') === 'htzone',
    'htzone must keep htzone adapter',
  );

  const overlay = read('src/catalog/builtinCatalogOverlay.ts');
  assert(
    !overlay.includes('adapterId:'),
    'builtinCatalogOverlay must not merge adapterId',
  );
  assert(
    !overlay.includes('loginUrl:'),
    'builtinCatalogOverlay must not merge loginUrl',
  );
  assert(
    !overlay.includes('loginFields:'),
    'builtinCatalogOverlay must not merge loginFields',
  );
  assert(
    overlay.includes('faviconSiteUrl'),
    'builtinCatalogOverlay must merge favicon presentation metadata',
  );

  // M3 — no tile-click discovery; execution via the single entry.
  // Phase 104 (AC-104-17) extracts a shared open-with-profile helper, so the
  // Dashboard may reach executeServiceFromTile directly OR through that helper.
  const dashboard = read('src/Dashboard.tsx');
  const sharedOpenExists = existsSync(join(root, 'src/serviceManagement/openWithProfile.ts'));
  const openHelper = sharedOpenExists
    ? read('src/serviceManagement/openWithProfile.ts')
    : '';
  assert(
    dashboard.includes('executeServiceFromTile') ||
      (dashboard.includes('openServiceWithProfile') &&
        openHelper.includes('executeServiceFromTile')),
    'Dashboard must execute via executeServiceFromTile (directly or via the shared open helper)',
  );
  assert(
    !/discoverAndPersistLoginUrl|discoverLogin/.test(dashboard),
    'Dashboard tile click must not run discovery',
  );

  // M4 — extension URL policy
  const background = read('extension/background.js');
  assert(
    background.includes('isAllowedGenericAutofillUrl'),
    'extension must define isAllowedGenericAutofillUrl',
  );
  assert(
    !background.includes('GENERIC_REAL_SITE_ALLOWED_HOSTS'),
    'extension host allowlist must be removed',
  );
  assert(
    !background.includes('isAllowedGenericRealSiteUrl'),
    'deprecated isAllowedGenericRealSiteUrl must be removed',
  );

  const manifest = read('extension/manifest.json');
  const versionMatch = manifest.match(/"version":\s*"([^"]+)"/);
  assert(versionMatch, 'manifest must declare version');
  const version = versionMatch[1];
  assert(
    version >= '1.3.0',
    `manifest version must be >= 1.3.0 after Phase 103 (got ${version})`,
  );

  const migration = read(
    'supabase/migrations/20260706140000_phase103_clear_generic_adapter.sql',
  );
  assert(migration.includes("'shufersal'"), 'phase103 migration must clear shufersal');
  assert(migration.includes("'clalit'"), 'phase103 migration must clear clalit');

  console.log('PASS: Phase 103 unified execution (static)');
  console.log(`  extension manifest version: ${version}`);
  console.log('  orchestrator: executeServiceFromTile (metadata-driven generic autofill)');
  console.log('  adapters: htzone, practice only');
  console.log('');
  console.log('Regression gate (manual UAT — required for Manager approval):');
  console.log('  T1 Shufersal — loginUrl open + extension generic fill');
  console.log('  T2 Clalit — loginUrl open + 3-field extension fill');
  console.log('  Reload unpacked extension after background.js changes');
}

main();
