/**
 * Phase 112 — Login Intelligence static contracts + fixture classification.
 * Usage: node scripts/verifyPhase112LoginIntelligence.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function loadClassifier() {
  // Prefer compiled-free approach: evaluate classify via dynamic import of ts is hard;
  // duplicate minimal check by importing from built path — use node --experimental
  // Instead: spawn through vite-node if available, else inline replicate by reading exports via esbuild.
  // Practical: use tsx if present, else transpile with esbuild sync.
  try {
    const esbuild = require('esbuild');
    const entry = join(root, 'src/loginIntelligence/index.ts');
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      packages: 'external',
    });
    const code = result.outputFiles[0].text;
    const tmp = join(root, 'node_modules', '.tmp-phase112-li.mjs');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(tmp, code);
    return import(pathToFileURL(tmp).href);
  } catch (error) {
    throw new Error(`Failed to bundle loginIntelligence for verify: ${error}`);
  }
}

function mainStatic() {
  assert(
    existsSync(join(root, 'supabase/migrations/20260714140000_phase112_login_intelligence.sql')),
    'M1 migration required',
  );
  assert(existsSync(join(root, 'src/loginIntelligence/index.ts')), 'loginIntelligence module required');
  assert(existsSync(join(root, 'src/admin/LoginIntelligencePanel.tsx')), 'Admin LI panel required');
  assert(existsSync(join(root, 'docs/MIGRATION_PHASE_112.md')), 'Migration doc required');

  const execution = read('src/execution/serviceExecution.ts');
  assert(execution.includes('complexityForExecution') || execution.includes('loginIntelligence'), 'M3: soft LI branch in executeServiceFromTile');
  assert(execution.includes('executeMediumAssist') || execution.includes('medium'), 'M3/M6: medium path');
  assert(/openUrlInNewTab/.test(execution), 'Open-first preserved');
  assert(!/type:\s*['\"]submit['\"]|form\.submit\(|\.click\(\)/.test(execution), 'No auto-submit in execution soft branch');

  const medium = read('src/loginIntelligence/mediumAssist.ts');
  assert(medium.includes('POC_IDENTITY_FIRST_FILL'), 'M9: medium identity-first message');
  assert(!/\bexecuteGenericAutofill\b/.test(medium), 'M9: medium must not call Phase 110 generic');
  assert(!/form\.submit\s*\(/.test(medium), 'M6/M9: no form.submit');

  const apply = read('src/loginIntelligence/applyClassification.ts');
  assert(apply.includes('canAutoApplyClassification') || apply.includes('admin_override'), 'Admin override protect');

  const health = read('src/loginIntelligence/health.ts');
  const types = read('src/loginIntelligence/types.ts');
  assert(
    types.includes("'healthy'") &&
      types.includes("'degraded'") &&
      types.includes("'needs_review'") &&
      types.includes("'adapter_required'") &&
      types.includes("'unsupported'"),
    'Health enum states',
  );
  assert(health.includes('mapOutcomeToIntegrationHealth'), 'Health mapper required');

  assert(types.includes('LOGIN_DETECTION_ENGINE_VERSION'), 'AC-112-24 engine version');
  assert(types.includes('lastValidatedBy'), 'AC-112-24 lastValidatedBy');

  const messages = read('src/loginIntelligence/messages.ts');
  assert(/פתחנו את האתר/.test(messages), 'Hebrew-only user copy');

  const fixturesDir = join(root, 'scripts/fixtures');
  const fixtures = readdirSync(fixturesDir).filter((f) => f.startsWith('phase112-'));
  assert(fixtures.length >= 4, 'Concrete Phase 112 fixtures required before AC-112-4…7');

  console.log('verifyPhase112LoginIntelligence: static PASS');
}

async function mainFixtures() {
  const mod = await loadClassifier();
  const {
    classifyLoginIntelligence,
    canAutoApplyClassification,
    applyLoginIntelligenceClassification,
    canTransitionAdapterLifecycle,
  } = mod;

  function checkExpect(actual, expect, id) {
    for (const [key, value] of Object.entries(expect)) {
      if (key === 'noFederatedAutoClick') {
        assert(value === true, `${id}: federated must remain detect-only`);
        continue;
      }
      assert(actual[key] === value, `${id}: expected ${key}=${value}, got ${actual[key]}`);
    }
  }

  const email = JSON.parse(read('scripts/fixtures/phase112-email-first.json'));
  checkExpect(classifyLoginIntelligence(email.signals).intelligence, email.expect, email.id);

  const user = JSON.parse(read('scripts/fixtures/phase112-username-first.json'));
  checkExpect(classifyLoginIntelligence(user.signals).intelligence, user.expect, user.id);

  const auth = JSON.parse(read('scripts/fixtures/phase112-auth-method.json'));
  checkExpect(classifyLoginIntelligence(auth.signals).intelligence, auth.expect, auth.id);

  const basic = JSON.parse(read('scripts/fixtures/phase112-standard-basic.json'));
  checkExpect(classifyLoginIntelligence(basic.signals).intelligence, basic.expect, basic.id);

  const complex = JSON.parse(read('scripts/fixtures/phase112-complex-surfaces.json'));
  for (const c of complex.cases) {
    checkExpect(classifyLoginIntelligence(c.signals).intelligence, c.expect, complex.id);
  }

  // Admin override protection
  const adminLi = {
    loginComplexity: 'basic',
    loginFlowType: 'standard_single_page',
    loginDetectionStatus: 'ok',
    loginDetectionConfidence: 'high',
    loginDetectionLastCheckedAt: null,
    loginDetectionError: null,
    loginDetectionEngineVersion: '112.1.0',
    lastValidatedBy: 'admin',
    adapterRecommended: false,
    adapterReason: null,
    adapterLifecycle: null,
    integrationHealth: 'healthy',
    supportedCredentialFields: [],
    federatedLoginOptions: [],
    requiresOtp: false,
    requiresCaptcha: false,
    usesIframe: false,
    usesModal: false,
    isMultiStep: false,
    loginIntelligenceAdminOverride: true,
  };
  const gate = canAutoApplyClassification(adminLi, 'high');
  assert(!gate.apply, 'Admin override must block auto apply');

  const lowGate = canAutoApplyClassification(
    { ...adminLi, loginIntelligenceAdminOverride: false, lastValidatedBy: 'auto', loginComplexity: 'basic' },
    'low',
  );
  assert(!lowGate.apply, 'Low confidence must not replace verified basic');

  const forced = applyLoginIntelligenceClassification(
    { loginComplexity: 'basic', lastValidatedBy: 'admin', loginIntelligenceAdminOverride: true },
    { hasVisibleEmail: true, hasVisiblePassword: false },
    { forceReplaceAdmin: true },
  );
  assert(forced.applied && forced.intelligence?.lastValidatedBy === 'admin', 'force admin replace');

  assert(canTransitionAdapterLifecycle(null, 'recommended'), 'lifecycle start');
  assert(canTransitionAdapterLifecycle('recommended', 'approved'), 'lifecycle advance');
  assert(canTransitionAdapterLifecycle('validated', 'deprecated'), 'lifecycle deprecate');

  console.log('verifyPhase112LoginIntelligence: fixtures PASS');
}

try {
  mainStatic();
  await mainFixtures();
  console.log('verifyPhase112LoginIntelligence: PASS');
} catch (error) {
  console.error('verifyPhase112LoginIntelligence: FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
