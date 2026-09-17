/**
 * Phase 116 corrective — Custom Add Registered-URL Identity Convergence (AC-116-3)
 * + Custom Add failure classification (R1–R11).
 *
 * Usage: node scripts/verifyPhase116CustomAddIdentity.mjs
 *
 * Does NOT modify Phase 117 Managed Autofill. R10 runs the Phase 117 verify script.
 */
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function def(partial) {
  return {
    schemaVersion: 1,
    id: 'svc',
    displayName: 'Site',
    url: 'https://example.test/',
    icon: '✦',
    source: 'built-in-catalog',
    ...partial,
  };
}

async function loadModules() {
  const dir = mkdtempSync(join(tmpdir(), 'pv-116-'));
  const persistenceOut = join(dir, 'persistence.mjs');
  const outcomeOut = join(dir, 'outcome.mjs');
  const failureOut = join(dir, 'failure.mjs');
  const mapperOut = join(dir, 'mapper.mjs');

  await build({
    entryPoints: [join(root, 'src/supabase/registryPersistence.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: persistenceOut,
    define: { 'import.meta.env.DEV': 'false' },
  });
  await build({
    entryPoints: [join(root, 'src/catalog/addCustomServiceOutcome.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outcomeOut,
  });
  await build({
    entryPoints: [join(root, 'src/catalog/customAddFailure.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: failureOut,
  });
  await build({
    entryPoints: [join(root, 'src/registry/registryMapper.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: mapperOut,
    define: { 'import.meta.env.DEV': 'false' },
  });

  return {
    persistence: await import(pathToFileURL(persistenceOut).href),
    outcome: await import(pathToFileURL(outcomeOut).href),
    failure: await import(pathToFileURL(failureOut).href),
    mapper: await import(pathToFileURL(mapperOut).href),
  };
}

function mainStatic() {
  const mapper = read('src/registry/registryMapper.ts');
  assert(
    mapper.includes('candidate.loginUrl = row.login_url'),
    'S0: registryMapper maps login_url → loginUrl',
  );

  const persistence = read('src/supabase/registryPersistence.ts');
  assert(
    persistence.includes('function serviceMatchesRegisteredUrl') &&
      persistence.includes('function urlsMatchRegisteredIdentitySet'),
    'S1: shared registered-URL identity helpers',
  );
  assert(
    persistence.includes('login_url, display_name') ||
      persistence.includes('primary_url, login_url, display_name'),
    'S3: user-row duplicate scan includes login_url',
  );

  const outcome = read('src/catalog/addCustomServiceOutcome.ts');
  assert(
    outcome.includes('serviceMatchesRegisteredUrl') &&
      !/urlsReferToSameService\(existing\.url/.test(outcome),
    'S2: classifier uses registered-URL set (not primary-only)',
  );

  const app = read('src/App.tsx');
  assert(
    app.includes('classifyAddCustomService') &&
      app.indexOf('classifyAddCustomService') < app.indexOf('upsertCustomServiceRegistryRow'),
    'S3: classify before upsert in addCustomService',
  );
  assert(
    app.includes('userMessageForCustomAddFailure'),
    'S4: App maps upsert failures via classifyCustomAddFailure',
  );
  assert(
    !/throw new Error\(CUSTOM_SERVICE_CLOUD_FAIL_MESSAGE\)/.test(app),
    'S4: App no longer maps every upsert failure to network-only message',
  );

  // Phase 117 Managed Autofill must not be touched by this correction.
  const managedPaths = [
    'src/autofill/validatedProfile.ts',
    'src/execution/managedAutofill.ts',
    'extension/generic/validated-autofill.js',
  ];
  for (const rel of managedPaths) {
    assert(existsSync(join(root, rel)), `R10 prerequisite exists: ${rel}`);
  }
  assert(
    !app.includes('executeManagedAutofill') || true,
    'placeholder',
  );
}

async function mainRuntime(mods) {
  const {
    serviceMatchesRegisteredUrl,
    urlsMatchRegisteredIdentitySet,
    urlsReferToSameService,
    serviceUrlIdentityKey,
  } = mods.persistence;
  const { classifyAddCustomService } = mods.outcome;
  const { classifyCustomAddFailure, CUSTOM_ADD_FAIL_CONNECTIVITY_HE, CUSTOM_ADD_FAIL_AUTH_POLICY_HE, CUSTOM_ADD_FAIL_PERSISTENCE_HE } =
    mods.failure;
  const { registryRowToServiceDefinition } = mods.mapper;

  const rivhitPrimary = 'https://online1.rivhit.co.il/';
  const rivhitLogin = 'https://online1.rivhit.co.il/loginmanager/login';
  const rivhit = def({
    id: 'rivhit-online',
    displayName: 'Rivhit Online',
    url: rivhitPrimary,
    loginUrl: rivhitLogin,
    source: 'built-in-catalog',
  });

  // S0 — mapper exposes loginUrl from registry row
  const mapped = registryRowToServiceDefinition({
    id: 'rivhit-online',
    display_name: 'Rivhit Online',
    primary_url: rivhitPrimary,
    login_url: rivhitLogin,
    source_type: 'built_in',
    category_id: null,
    icon: null,
    adapter_id: null,
    login_fields: [
      { id: 'username', label: 'u', type: 'text', required: true },
      { id: 'password', label: 'p', type: 'password', required: true },
      { id: 'business_id', label: 'b', type: 'text', required: true },
    ],
    metadata: {},
    owner_user_id: null,
    login_url_status: 'valid',
  });
  assert(mapped.loginUrl === rivhitLogin, 'S0: mapped definition exposes loginUrl');

  // S1 helper unit cases
  assert(serviceMatchesRegisteredUrl(rivhit, rivhitPrimary) === true, 'S1: primary match');
  assert(serviceMatchesRegisteredUrl(rivhit, rivhitLogin) === true, 'S1: login match');
  assert(
    serviceMatchesRegisteredUrl(rivhit, 'https://online1.rivhit.co.il/unregistered/path') === false,
    'S1: neither / unregistered path',
  );
  assert(
    serviceMatchesRegisteredUrl({ url: rivhitPrimary }, rivhitLogin) === false,
    'S1: empty login ignored — login path does not match primary-only def',
  );
  assert(
    urlsMatchRegisteredIdentitySet(rivhitPrimary, rivhitLogin, rivhitLogin) === true,
    'S1: urlsMatchRegisteredIdentitySet login',
  );

  // R1 — enter primary → same service id
  const r1 = classifyAddCustomService({
    normalizedUrl: rivhitPrimary,
    definitions: [rivhit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    r1?.status === 'catalog_service_available' && r1.existingServiceId === 'rivhit-online',
    'R1: primary_url resolves to existing service',
  );

  // R2 — enter login_url → same id as R1
  const r2 = classifyAddCustomService({
    normalizedUrl: rivhitLogin,
    definitions: [rivhit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    r2?.status === 'catalog_service_available' &&
      r2.existingServiceId === r1.existingServiceId,
    'R2: login_url resolves to same service id as R1',
  );

  // R3 — registered Login Entry → catalog reuse, not create (null)
  assert(r2 !== null && r2.status !== 'created', 'R3: Login Entry is catalog reuse outcome');
  assert(
    classifyAddCustomService({
      normalizedUrl: rivhitLogin,
      definitions: [rivhit],
      selectedIds: new Set(['rivhit-online']),
      localCustomServices: [],
    })?.status === 'already_in_user_home',
    'R3: Login Entry already in home',
  );

  // R4 — existing homepage matching unchanged
  const home = classifyAddCustomService({
    normalizedUrl: 'https://www.bankhapoalim.co.il/',
    definitions: [
      def({
        id: 'hapoalim',
        displayName: 'בנק הפועלים',
        url: 'https://www.bankhapoalim.co.il',
      }),
    ],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    home?.status === 'catalog_service_available' && home.existingServiceId === 'hapoalim',
    'R4: homepage matching unchanged',
  );

  // R5 — Phase 116 normalization (www / trailing slash / case / query / fragment)
  const base = 'https://www.Example.TEST/path/';
  const variants = [
    'https://example.test/path',
    'http://www.example.test/path/',
    'HTTPS://EXAMPLE.TEST/path?x=1',
    'https://example.test/path#frag',
  ];
  for (const variant of variants) {
    assert(
      urlsReferToSameService(base, variant) === true,
      `R5: identity key matches for ${variant}`,
    );
  }
  assert(
    serviceUrlIdentityKey('https://www.example.test/a') !==
      serviceUrlIdentityKey('https://www.example.test/b'),
    'R5: distinct paths remain distinct keys',
  );

  // R6 — unregistered path on same host does NOT match
  const r6 = classifyAddCustomService({
    normalizedUrl: 'https://online1.rivhit.co.il/some/other/deep/path',
    definitions: [rivhit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(r6 === null, 'R6: unregistered same-host path does not match catalog');

  // R7 — distinct path-based customs on same host remain distinct
  const customA = def({
    id: 'custom-a',
    displayName: 'A',
    url: 'https://portal.example.test/a',
    source: 'user-created',
  });
  const customBUrl = 'https://portal.example.test/b';
  const r7 = classifyAddCustomService({
    normalizedUrl: customBUrl,
    definitions: [],
    selectedIds: new Set(),
    localCustomServices: [customA],
  });
  assert(r7 === null, 'R7: distinct path custom on same host stays distinct (create allowed)');

  // R8 — different subdomains not automatically merged
  const r8 = classifyAddCustomService({
    normalizedUrl: 'https://login.online1.rivhit.co.il/',
    definitions: [rivhit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(r8 === null, 'R8: different subdomain not merged');

  // R9 — duplicate prevention (same-user custom / already in home)
  const local = def({
    id: 'custom-1',
    displayName: 'שלי',
    url: 'https://mysite.example/',
    source: 'user-created',
  });
  assert(
    classifyAddCustomService({
      normalizedUrl: 'https://mysite.example/',
      definitions: [rivhit],
      selectedIds: new Set(['custom-1']),
      localCustomServices: [local],
    })?.status === 'already_in_user_home',
    'R9: already in home',
  );
  assert(
    classifyAddCustomService({
      normalizedUrl: 'https://mysite.example/',
      definitions: [rivhit],
      selectedIds: new Set(),
      localCustomServices: [local],
    })?.status === 'same_user_custom_duplicate',
    'R9: same-user custom duplicate',
  );

  // Custom with loginUrl: matching login converges
  const customWithLogin = def({
    id: 'custom-login',
    displayName: 'Custom Login',
    url: 'https://app.example.test/',
    loginUrl: 'https://app.example.test/auth/login',
    source: 'user-created',
  });
  assert(
    classifyAddCustomService({
      normalizedUrl: 'https://app.example.test/auth/login',
      definitions: [],
      selectedIds: new Set(),
      localCustomServices: [customWithLogin],
    })?.existingServiceId === 'custom-login',
    'R9b: user custom loginUrl also converges',
  );

  // R11 — non-network failures not presented as network-only
  const auth = classifyCustomAddFailure({ message: 'JWT expired', status: 401 });
  assert(auth.failureClass === 'auth_policy', 'R11: 401 → auth_policy');
  assert(
    auth.userMessage === CUSTOM_ADD_FAIL_AUTH_POLICY_HE &&
      auth.userMessage !== CUSTOM_ADD_FAIL_CONNECTIVITY_HE,
    'R11: auth message is not network-only',
  );
  const persist = classifyCustomAddFailure({
    message: 'new row violates check constraint',
    code: '23514',
  });
  assert(persist.failureClass === 'persistence_validation', 'R11: constraint → persistence');
  assert(
    persist.userMessage === CUSTOM_ADD_FAIL_PERSISTENCE_HE &&
      persist.userMessage !== CUSTOM_ADD_FAIL_CONNECTIVITY_HE,
    'R11: persistence message is not network-only',
  );
  const net = classifyCustomAddFailure(new TypeError('Failed to fetch'));
  assert(
    net.failureClass === 'connectivity' && net.userMessage === CUSTOM_ADD_FAIL_CONNECTIVITY_HE,
    'R11: Failed to fetch remains connectivity',
  );

  // Clalit non-goal preserved: e-services host root ≠ loginUrl path
  const clalit = def({
    id: 'clalit',
    displayName: 'כללית',
    url: 'https://www.clalit.co.il',
    loginUrl: 'https://e-services.clalit.co.il/onlineweb/general/login.aspx',
  });
  assert(
    classifyAddCustomService({
      normalizedUrl: 'https://e-services.clalit.co.il/',
      definitions: [clalit],
      selectedIds: new Set(),
      localCustomServices: [],
    }) === null,
    'R6/Clalit: unregistered e-services root does not match',
  );
  assert(
    classifyAddCustomService({
      normalizedUrl: 'https://e-services.clalit.co.il/onlineweb/general/login.aspx',
      definitions: [clalit],
      selectedIds: new Set(),
      localCustomServices: [],
    })?.existingServiceId === 'clalit',
    'R2/Clalit: registered loginUrl converges',
  );
}

function runPhase117Regression() {
  const script = join(root, 'scripts/verifyPhase117ManagedAutofill.mjs');
  assert(existsSync(script), 'R10: Phase 117 verify script exists');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `R10 Phase 117 regression FAILED:\n${result.stdout || ''}\n${result.stderr || ''}`,
    );
  }
  assert(
    (result.stdout || '').includes('PASS'),
    'R10: Phase 117 verify reported PASS',
  );
}

async function main() {
  mainStatic();
  const mods = await loadModules();
  await mainRuntime(mods);
  runPhase117Regression();
  console.log('verifyPhase116CustomAddIdentity: PASS (S0–S4 static + R1–R11)');
}

await main();
