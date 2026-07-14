/**
 * Phase 112 M10 — AC-112-26 status mapping unit checks.
 * Usage: node scripts/verifyPhase112MediumStatus.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

async function loadModule() {
  const esbuild = require('esbuild');
  const entry = join(root, 'src/loginIntelligence/mediumStatus.ts');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node18',
  });
  const tmp = join(root, 'node_modules', '.tmp-phase112-status.mjs');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(tmp, result.outputFiles[0].text);
  return import(pathToFileURL(tmp).href);
}

function mainStatic() {
  const medium = read('src/loginIntelligence/mediumAssist.ts');
  assert(medium.includes('sendExtensionMessageAsync'), 'M10: must await extension outcome');
  assert(medium.includes('mapMediumOutcomeToUserStatus'), 'M10: must map statuses');
  assert(medium.includes('activeProfileId'), 'BD-112-4: profile id on attempt');

  const sites = read('src/loginIntelligence/supportedMediumSites.ts');
  assert(sites.includes('PHASE112_MEDIUM_SUPPORTED_SITES'), 'published supported list');
  assert(sites.includes('amazon-il') && sites.includes('ksp'), 'named supported sites');

  const exec = read('src/execution/serviceExecution.ts');
  assert(/async function executeServiceFromTile|export async function executeServiceFromTile/.test(exec), 'async execution for medium await');

  assert(existsSync(join(root, 'src/loginIntelligence/mediumStatus.ts')), 'status module');
  console.log('verifyPhase112MediumStatus: static PASS');
}

async function mainUnits() {
  const { mapMediumOutcomeToUserStatus, AC112_26_HEBREW } = await loadModule();

  const cases = [
    { in: { noIdentityCredential: true }, cat: 'no_credentials_for_profile' },
    { in: { profileMissing: true }, cat: 'no_credentials_for_profile' },
    { in: { unsupportedSite: true }, cat: 'website_not_supported' },
    { in: { extensionMissing: true }, cat: 'system_error' },
    { in: { ok: true, filled: 1 }, cat: 'success_step1' },
    { in: { reason: 'identity_step_not_found' }, cat: 'login_form_not_detected' },
    { in: { reason: 'no_identity_mapping' }, cat: 'first_field_not_detected' },
    { in: { reason: 'bot_interstitial' }, cat: 'blocked_by_website' },
    { in: { reason: 'url_not_allowed' }, cat: 'website_not_supported' },
    { in: { reason: 'script_injection_failed' }, cat: 'system_error' },
    { in: { reason: 'totally_unknown_xyz' }, cat: 'system_error' },
  ];

  for (const c of cases) {
    const out = mapMediumOutcomeToUserStatus(c.in);
    assert(out.category === c.cat, `expected ${c.cat}, got ${out.category}`);
    assert(typeof out.userMessage === 'string' && out.userMessage.length > 10, 'hebrew message');
    assert(!/stack|Error:|at\s+\w+|password\s*=/i.test(out.userMessage), 'no raw tech/creds');
  }

  assert(AC112_26_HEBREW.website_not_supported !== AC112_26_HEBREW.system_error, 'BD-112-6 distinct');
  assert(AC112_26_HEBREW.login_form_not_detected !== AC112_26_HEBREW.first_field_not_detected);

  console.log('verifyPhase112MediumStatus: units PASS');
}

try {
  mainStatic();
  await mainUnits();
  console.log('verifyPhase112MediumStatus: PASS');
} catch (error) {
  console.error('verifyPhase112MediumStatus: FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
