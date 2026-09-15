/**
 * Ownership / source root-cause regression (static + helper).
 * Usage: node scripts/verifyServiceSourceOwnership.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function mainStatic() {
  const manage = read('src/ManageServices.tsx');
  assert(!manage.includes('isCustomServiceId'), 'ManageServices must not use isCustomServiceId');
  assert(manage.includes("source ==="), 'edit menu must read runtime source');
  assert(manage.includes("'user-created'"), 'edit menu must require user-created source');
  assert(manage.includes('עריכת פרטי האתר'), 'custom edit label remains');

  const app = read('src/App.tsx');
  assert(!app.includes('isCustomServiceId'), 'App dedupe must not use isCustomServiceId');
  assert(app.includes('isUserCreatedRuntimeSource'), 'dedupe must use source helpers');
  assert(app.includes('isCatalogOrGlobalRuntimeSource'), 'dedupe must prefer catalog by source');

  const legacy = read('src/service/legacyCatalogMap.ts');
  assert(!legacy.includes('inferServiceSource'), 'inferServiceSource must be removed');
  assert(legacy.includes('refuse to infer from id'), 'legacy convert must refuse id inference');
  assert(!legacy.includes("startsWith('custom-')"), 'legacy map must not use custom- prefix');

  const custom = read('src/catalog/customService.ts');
  assert(custom.includes('generateCustomServiceId'), 'custom-* minting remains');
  assert(custom.includes("source: 'user-created'"), 'new customs still stamp user-created');

  const docs = read('src/service/CATALOG_MAPPING.md');
  assert(docs.includes('identity only'), 'docs state id is identity only');
  assert(docs.includes('Do not'), 'docs forbid prefix-as-source');
}

async function mainHelper() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-src-')), 'legacy.mjs');
  await build({
    entryPoints: [join(root, 'src/service/legacyCatalogMap.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);

  const withSource = mod.legacyServiceToDefinition(
    {
      id: 'custom-abc',
      name: 'Test',
      icon: '🔗',
      url: 'https://example.test',
      category: 'shopping',
      source: 'built-in-catalog',
    },
  );
  assert(withSource.source === 'built-in-catalog', 'explicit source wins even for custom-* id');

  const forced = mod.legacyServiceToDefinition(
    {
      id: 'custom-abc',
      name: 'Test',
      icon: '🔗',
      url: 'https://example.test',
      category: 'shopping',
    },
    { source: 'user-created' },
  );
  assert(forced.source === 'user-created', 'options.source is authoritative');

  let threw = false;
  try {
    mod.legacyServiceToDefinition({
      id: 'custom-abc',
      name: 'Test',
      icon: '🔗',
      url: 'https://example.test',
      category: 'shopping',
    });
  } catch {
    threw = true;
  }
  assert(threw, 'missing source must not invent user-created from custom-* id');
}

await mainStatic();
await mainHelper();
console.log('PASS: service source/ownership root-cause regression');
