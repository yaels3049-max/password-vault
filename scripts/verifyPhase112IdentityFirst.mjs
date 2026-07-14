/**
 * Phase 112 M9 — identity-first step-1 fill (AC-112-25 / D-112-20…22).
 * Usage: node scripts/verifyPhase112IdentityFirst.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function mainStatic() {
  const medium = read('src/loginIntelligence/mediumAssist.ts');
  assert(
    medium.includes('POC_IDENTITY_FIRST_FILL') && medium.includes('sendExtensionMessageAsync'),
    'D-112-20/M10: medium MUST await POC_IDENTITY_FIRST_FILL',
  );
  assert(
    !/\bexecuteGenericAutofill\b/.test(medium) && !/type:\s*['\"]POC_GENERIC_FILL['\"]/.test(medium),
    'D-112-20: medium must NOT solely call Phase 110 generic fill',
  );

  const identity = read('extension/generic/identity-first-autofill.js');
  assert(identity.includes('runIdentityFirstAutofill'), 'identity-first runner required');
  assert(
    !/\.assessStandardLogin\s*\(/.test(identity),
    'D-112-20: identity-first must not call assessStandardLogin',
  );
  assert(/filled\s*>=\s*1|filled >= 1/.test(identity), 'D-112-21: success ≥1 fill');

  const detector = read('extension/generic/form-detector.js');
  assert(
    detector.includes('detectVisibleIdentityStep'),
    'identity-step detector required',
  );

  const mapper = read('extension/generic/field-mapper.js');
  assert(mapper.includes('mapIdentityFieldsOnly'), 'identity-only mapper required');

  const bg = read('extension/background.js');
  assert(bg.includes('POC_IDENTITY_FIRST_FILL'), 'background message handler required');
  assert(bg.includes('runIdentityFirstAutofillOnTab'), 'background tab runner required');
  assert(
    bg.includes('identity-first-autofill.js'),
    'background must inject identity-first script',
  );

  // Phase 110 path must remain intact
  const generic = read('extension/generic/generic-autofill.js');
  assert(generic.includes('assessStandardLogin'), 'Phase 110 standard gate preserved');
  assert(bg.includes('POC_GENERIC_FILL'), 'Phase 110 POC_GENERIC_FILL preserved');

  assert(
    existsSync(join(root, 'scripts/fixtures/phase112-email-first-step1.html')),
    'HTML fixture for AC-112-25 required',
  );

  console.log('verifyPhase112IdentityFirst: static PASS');
}

async function loadScriptsIntoWindow(window) {
  const scripts = [
    'extension/generic/form-detector.js',
    'extension/generic/field-mapper.js',
    'extension/generic/fill-executor.js',
    'extension/generic/identity-first-autofill.js',
  ];

  // linkedom: stub visibility geometry so isVisible passes for fixture inputs
  const Proto = window.HTMLElement.prototype;
  Proto.getClientRects = function getClientRects() {
    return [{ width: 120, height: 24, top: 0, left: 0, bottom: 24, right: 120 }];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 120, height: 24, top: 0, left: 0, bottom: 24, right: 120, x: 0, y: 0 };
  };

  for (const rel of scripts) {
    // eslint-disable-next-line no-new-func
    const run = new Function('window', 'document', 'globalThis', read(rel) + '\n//# sourceURL=' + rel);
    run(window, window.document, window);
  }
}

async function mainFixture() {
  const html = read('scripts/fixtures/phase112-email-first-step1.html');
  const { window, document } = parseHTML(html);
  // Ensure CSSOM helpers exist
  window.getComputedStyle = () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  });

  await loadScriptsIntoWindow(window);

  assert(typeof window.runIdentityFirstAutofill === 'function', 'runner on window');
  assert(typeof window.GenericFormDetector.detectVisibleIdentityStep === 'function');

  // linkedom Event quirks — use a deterministic fill stub that still mutates DOM value.
  window.GenericFillExecutor.fillField = function (element, value) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }
    element.value = String(value);
    return { ok: true, verified: true, actual: String(value) };
  };

  const result = window.runIdentityFirstAutofill({
    loginFields: [
      { id: 'username', label: 'אימייל', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    credentials: {
      username: 'user@example.com',
      password: 'secret-not-used-on-step1',
    },
  });

  assert(result.ok === true, `fixture fill ok expected, got ${JSON.stringify(result)}`);
  assert(result.filled >= 1, `D-112-21: filled≥1, got ${result.filled}`);
  assert(result.passwordAbsent === true, 'password absent from DOM expected');

  const emailInput = document.getElementById('email');
  assert(emailInput, 'email input present');
  assert(
    String(emailInput.value).trim() === 'user@example.com',
    `email field must receive vault value, got "${emailInput.value}"`,
  );

  // Prove mapping path ran (password field not required on DOM)
  const detection = window.GenericFormDetector.detectVisibleIdentityStep();
  assert(detection && detection.textInputs.length >= 1, 'identity detection finds email');
  assert(
    !detection.passwordInputs || detection.passwordInputs.length === 0,
    'fixture has no password inputs',
  );
  const mapped = window.GenericFieldMapper.mapIdentityFieldsOnly(
    [
      { id: 'username', label: 'אימייל', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    detection,
  );
  assert(mapped.ok && mapped.mappings.length >= 1, 'identity mapper maps email');

  assert(!/form\.submit\s*\(/.test(read('extension/generic/identity-first-autofill.js')));

  console.log('verifyPhase112IdentityFirst: fixture PASS (email field filled)');
}

try {
  mainStatic();
  await mainFixture();
  console.log('verifyPhase112IdentityFirst: PASS');
  console.log('Live UAT (operator): ≥1 email-first site step-1 fill — PENDING_OPERATOR');
} catch (error) {
  console.error('verifyPhase112IdentityFirst: FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
