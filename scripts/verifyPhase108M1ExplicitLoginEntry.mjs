/**
 * Phase 108 M1 — explicit login entry; product paths do not invoke discovery.
 *
 * Usage: node scripts/verifyPhase108M1ExplicitLoginEntry.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const productPaths = [
  'src/App.tsx',
  'src/AddSiteModal.tsx',
  'src/ManageServices.tsx',
  'src/admin/RegistryAdmin.tsx',
  'src/admin/ApprovalQueue.tsx',
  'src/admin/LoginUrlRefresh.tsx',
  'src/admin/IntegrationStatusPanel.tsx',
  'src/catalog/customService.ts',
];

const forbidden = [
  'discoverLogin(',
  'discoverLoginForRegistryService',
  'discoverAndPersistLoginUrl',
  'adminTriggerLoginRediscovery',
  'adminBulkRefreshLoginUrls',
  'promoteUserSubmissionWithDiscovery',
  'createGlobalRegistryRowWithDiscovery',
  'recordLoginDiscoveryPipelineFailure',
];

function mainStatic() {
  for (const path of productPaths) {
    const source = read(path);
    for (const token of forbidden) {
      assert(!source.includes(token), `${path} must not reference ${token}`);
    }
  }

  const mapper = read('src/registry/registryMapper.ts');
  assert(
    !mapper.includes('loginUrlDiscoveryOutcome') &&
      !mapper.includes('loginUrlDiscoveryAttempted'),
    'registry insert must not write discovery outcome fields',
  );
  assert(
    mapper.includes("loginUrlSource: 'user'") && mapper.includes('loginEntryType'),
    'registry insert must write explicit loginUrlSource and loginEntryType',
  );

  const app = read('src/App.tsx');
  assert(app.includes('upsertCustomServiceRegistryRow'), 'custom add must persist the registry row');
  assert(app.includes('updateCustomService'), 'custom edit must persist without discovery');

  const modal = read('src/AddSiteModal.tsx');
  const labels = read('src/catalog/explicitLoginEntry.ts');
  assert(labels.includes('דף הכניסה זהה לכתובת האתר'), 'same-as-website label required');
  assert(labels.includes('כתובת כניסה'), 'login URL field label required');
  assert(modal.includes('SAME_AS_WEBSITE_LABEL') && modal.includes('LOGIN_URL_FIELD_LABEL'), 'modal must use explicit labels');
  assert(!modal.includes('מוסיף את האתר'), 'discovery progress copy must be gone');

  const admin = read('src/admin/RegistryAdmin.tsx');
  assert(
    labels.includes('כניסה מדף הבית') &&
      labels.includes('כתובת כניסה ייעודית') &&
      admin.includes('ADMIN_PRIMARY_PAGE_LABEL') &&
      admin.includes('ADMIN_DIRECT_URL_LABEL'),
    'admin entry type control required',
  );
  assert(!admin.includes('רענון כניסה מרוכז'), 'bulk refresh button must be gone');
  assert(!admin.includes('דרוס עריכות מנהל'), 'force overwrite control must be gone');

  const openUrl = read('src/service/legacyService.ts');
  assert(
    openUrl.includes('return service.loginUrl ?? service.url'),
    'open falls back to primary URL for legacy null loginUrl',
  );

  assert(existsSync(join(root, 'src/discovery/discoverLoginEntry.ts')), 'M3: discovery engine must remain');
  assert(existsSync(join(root, 'src/extension/discoveryPageEntry.ts')), 'M3: extension discovery entry must remain');
  assert(existsSync(join(root, 'scripts/buildExtensionDiscovery.mjs')), 'M3: discovery build script must remain');
  assert(
    read('package.json').includes('build:extension-discovery'),
    'M3: do not detach discovery build step in M1',
  );
  assert(existsSync(join(root, 'src/serviceAssets/discovery.ts')), 'icon discovery must remain');
  assert(existsSync(join(root, 'src/serviceManagement/discoveryFilter.ts')), 'catalog search filter must remain');
  assert(
    !existsSync(join(root, 'supabase/migrations/20260914120000_phase108_explicit_login_entry.sql')),
    'M1 must not add a migration',
  );
}

async function mainHelper() {
  const outdir = mkdtempSync(join(tmpdir(), 'pv-m1-'));
  const outfile = join(outdir, 'explicitLoginEntry.mjs');
  await build({
    entryPoints: [join(root, 'src/catalog/explicitLoginEntry.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);

  const same = mod.resolveExplicitLoginEntry({
    websiteUrl: 'https://www.example.co.il/',
    sameAsWebsite: true,
  });
  assert(same.loginEntryType === 'primary_page', 'checked control is primary_page');
  assert(same.loginUrl === 'https://www.example.co.il/', 'primary_page stores website URL');

  let rejected = false;
  try {
    mod.resolveExplicitLoginEntry({
      websiteUrl: 'https://example.com',
      sameAsWebsite: false,
      dedicatedLoginUrl: '   ',
    });
  } catch (error) {
    rejected = error instanceof Error && error.message === 'יש להזין כתובת כניסה';
  }
  assert(rejected, 'empty dedicated login URL must be rejected');

  const direct = mod.resolveExplicitLoginEntry({
    websiteUrl: 'https://example.com',
    sameAsWebsite: false,
    dedicatedLoginUrl: 'https://example.com/login',
  });
  assert(direct.loginEntryType === 'direct_url', 'unchecked control is direct_url');
  assert(direct.loginUrl === 'https://example.com/login', 'direct_url stores the human URL');

  assert(
    mod.defaultSameAsWebsite(null, 'https://example.com') === true,
    'null loginUrl defaults the control on',
  );
  assert(
    mod.defaultSameAsWebsite('https://example.com/login', 'https://example.com') === false,
    'different loginUrl defaults the control off',
  );

  const stamped = mod.stampExplicitLoginMetadata(
    { loginUrlDiscoveryOutcome: 'legacy' },
    'user',
    'primary_page',
  );
  assert(stamped.loginUrlSource === 'user', 'user source is ownership');
  assert(stamped.loginEntryType === 'primary_page', 'entry type is stored');
  assert(
    !Object.prototype.hasOwnProperty.call(stamped, 'loginUrlDiscoveryAttempted') ||
      stamped.loginUrlDiscoveryOutcome === 'legacy',
    'stamp must not invent a discovery attempt',
  );
}

await mainStatic();
await mainHelper();
console.log('PASS: Phase 108 M1 explicit login entry (static + persist helper)');
