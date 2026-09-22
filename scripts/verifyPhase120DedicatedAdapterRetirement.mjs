/**
 * Phase 120.3.6 — Dedicated Site-Adapter Legacy Debt Removal (static).
 * Package A + B evidence gates. Usage: node scripts/verifyPhase120DedicatedAdapterRetirement.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function countMatches(pattern, text) {
  const re = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern;
  return (text.match(re) || []).length;
}

function main() {
  const legacy = read('src/service/legacyCatalogMap.ts');
  const poc = read('src/pocAutofill.ts');
  const registry = read('src/execution/adapters/registry.ts');
  const catalog = read('src/catalog/builtinCatalog.ts');
  const support = read('src/loginAssistance/supportLevel.ts');
  const execution = read('src/execution/serviceExecution.ts');
  const background = read('extension/background.js');
  const manifest = read('extension/manifest.json');

  // Package A
  assert(!legacy.includes('LEGACY_ADAPTER_ID_BY_SERVICE_ID'), 'A1: dead map removed');
  assert(legacy.includes('service.adapterId'), 'A1: adapterId from service only');
  assert(!poc.includes('openIsraeliSiteAutofillTest'), 'A2: HTZone POC helper removed');
  assert(!poc.includes('openHtzoneTile'), 'A2: openHtzoneTile removed');
  assert(!poc.includes('POC_FILL_IL'), 'A2: no POC_FILL_IL');
  assert(!poc.includes('htzoneAdapter'), 'A2: no htzoneAdapter import');
  assert(poc.includes('openPracticeLoginFromTile'), 'A2: practice POC retained');
  assert(poc.includes('openShufersalLoginFromTile'), 'A2: Shufersal POC retained');
  assert(poc.includes('openClalitLoginFromTile'), 'A2: Clalit POC retained');

  // Package B
  assert(!existsSync(join(root, 'src/execution/adapters/htzoneAdapter.ts')), 'B1: htzoneAdapter deleted');
  assert(!existsSync(join(root, 'extension/htzone-adapter.js')), 'B10: htzone-adapter.js deleted');
  assert(registry.includes("new Set(['practice'])"), 'B2: practice-only SITE_SPECIFIC');
  assert(!registry.includes("'htzone'"), 'B2: htzone not in registry');
  assert(!/adapterId:\s*'htzone'/.test(catalog), 'B3: catalog adapterId cleared');
  assert(catalog.includes("id: 'htzone'"), 'B3: htzone catalog row retained');
  assert(support.includes("adapterId === 'practice'"), 'B4: practice arm kept');
  assert(!support.includes("'htzone'"), 'B4: htzone arm removed');
  assert(!background.includes('POC_FILL_IL'), 'B5: POC_FILL_IL gone');
  assert(!background.includes('isHtzoneLoginUrl'), 'B6: hostname gate gone');
  assert(!background.includes('openHtzonePageAndFill'), 'B7: open helper gone');
  assert(!background.includes('MOCK_HTZONE'), 'B8: mocks gone');
  assert(!background.includes('htzone-login'), 'B9: getPageConfig htzone branch gone');
  assert(!manifest.includes('htzone.co.il'), 'B11: named host_permissions removed');
  assert(manifest.includes('https://*/*'), 'B11: broad https://*/* retained');
  assert(
    execution.includes('Site-specific adapters (practice) only'),
    'B12: comment practice-only',
  );
  assert(
    existsSync(
      join(root, 'supabase/migrations/20260922120000_phase120_clear_htzone_adapter_id.sql'),
    ),
    'B: live adapter_id clear migration present',
  );

  // Protect
  assert(existsSync(join(root, 'src/execution/adapters/practiceAdapter.ts')), 'practice retained');
  assert(background.includes('POC_FILL_DEMO'), 'POC_FILL_DEMO retained');
  assert(background.includes('POC_GENERIC_FILL') || background.includes('HUB_MANAGED_AUTOFILL'), 'generic/Managed retained');
  assert(execution.includes('executeManagedAutofill'), 'Managed path retained');
  assert(
    /never fall through to legacy\/generic/.test(execution),
    'no silent Managed→generic',
  );

  // §13 zero callers in src+extension for retired symbols
  const prod = `${read('src/pocAutofill.ts')}${registry}${catalog}${support}${execution}${background}${manifest}`;
  for (const sym of [
    'POC_FILL_IL',
    'htzone-adapter',
    'openHtzonePageAndFill',
    'isHtzoneLoginUrl',
    'runHtzoneAdapterFill',
    '__israeliVaultHtzoneFill',
    'htzoneAdapter',
    'MOCK_HTZONE',
    'HTZONE_RETRY',
  ]) {
    assert(countMatches(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), prod) === 0, `§13 zero: ${sym}`);
  }

  console.log('verifyPhase120DedicatedAdapterRetirement: PASS (Package A + B + §13)');
}

main();
