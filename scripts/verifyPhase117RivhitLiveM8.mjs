/**
 * Phase 117 M8 — Operator-only Rivhit functional validation (no production activation).
 *
 * Fetches the live Login Entry HTML, confirms configured locators, and runs the
 * Managed Autofill runner against an in-memory copy of that document.
 *
 * Does NOT:
 * - persist supportState=validated
 * - POST / submit to Rivhit
 * - transmit or log credential values
 * - enable Managed Autofill for other users
 *
 * Usage: node scripts/verifyPhase117RivhitLiveM8.mjs
 * TLS: respects NODE_EXTRA_CA_CERTS or npm `cafile`.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = JSON.parse(readFileSync(join(root, 'scripts/fixtures/phase117-rivhit-e2e-gate.json'), 'utf8'));

function resolveCaPath() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) {
    return extra;
  }
  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8', cwd: root }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      return cafile;
    }
  } catch {
    // ignore
  }
  return null;
}

const caPath = resolveCaPath();
if (caPath) {
  process.env.NODE_EXTRA_CA_CERTS = caPath;
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function summarizeLocator(document, locator) {
  const nodes = document.querySelectorAll(locator);
  const el = nodes.length === 1 ? nodes[0] : null;
  return {
    locator,
    count: nodes.length,
    tag: el ? el.tagName : null,
    inputType: el ? el.getAttribute('type') || null : null,
    hidden: el ? el.type === 'hidden' || el.hidden === true : null,
    disabled: el ? Boolean(el.disabled) : null,
    readOnly: el ? Boolean(el.readOnly) : null,
  };
}

function loadManagedDom(html, origin, href) {
  const { window, document } = parseHTML(html);
  Object.defineProperty(window, 'location', {
    value: { origin, href },
    configurable: true,
  });
  window.top = window;
  window.getComputedStyle = () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  });
  const Proto = window.HTMLElement.prototype;
  Proto.getClientRects = function getClientRects() {
    return [{ width: 120, height: 24, top: 0, left: 0, bottom: 24, right: 120 }];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 120, height: 24, top: 0, left: 0, bottom: 24, right: 120, x: 0, y: 0 };
  };
  const scripts = [
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
  ];
  for (const rel of scripts) {
    const run = new Function('window', 'document', 'globalThis', `${read(rel)}\n//# sourceURL=${rel}`);
    run(window, window.document, window);
  }
  window.GenericFillExecutor.fillField = function (element, value) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }
    if (!window.GenericFillExecutor.isSafeFillTarget(element)) {
      return { ok: false, reason: 'hidden_or_unsafe_target' };
    }
    element.value = String(value);
    return { ok: true, verified: true, actual: String(value) };
  };
  return { window, document };
}

async function main() {
  const loginEntryUrl = GATE.loginEntryUrl;
  const allowedOrigin = GATE.allowedOrigin;
  const mappings = Object.entries(GATE.knownSliceLocators).map(([fieldId, locator]) => ({
    fieldId,
    locatorType: 'css',
    locator,
  }));

  const response = await fetch(loginEntryUrl, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  assert(response.ok, `M8 live fetch HTTP ${response.status}`);
  const finalUrl = response.url || loginEntryUrl;
  const finalOrigin = new URL(finalUrl).origin;
  assert(finalOrigin === allowedOrigin, 'M8 final origin must match allowedOrigin');
  const html = await response.text();
  assert(html.length > 0, 'M8 live HTML empty');

  const { window, document } = loadManagedDom(html, allowedOrigin, loginEntryUrl);

  const locatorEvidence = {};
  for (const mapping of mappings) {
    const summary = summarizeLocator(document, mapping.locator);
    locatorEvidence[mapping.fieldId] = summary;
    assert(summary.count === 1, `M8 ${mapping.fieldId} must match exactly one node`);
    assert(summary.tag === 'INPUT', `M8 ${mapping.fieldId} must be an input`);
    assert(summary.hidden === false, `M8 ${mapping.fieldId} must not be hidden`);
    assert(summary.disabled === false && summary.readOnly === false, `M8 ${mapping.fieldId} must be editable`);
  }
  const remember = summarizeLocator(document, '#remember');
  assert(remember.count === 1, 'M8 #remember exists and must stay unmapped');

  let submitInvoked = false;
  for (const form of document.querySelectorAll('form')) {
    form.submit = function submit() {
      submitInvoked = true;
    };
  }

  const placeholders = { username: 'm8u', password: 'm8p', business_id: '1' };
  const result = window.runManagedAutofill({
    allowedOrigin,
    fieldMappings: mappings,
    credentials: placeholders,
  });
  assert(result.ok === true && result.filled === 3, `M8 runner failed: ${result.reason || 'unknown'}`);

  const filledFlags = {};
  for (const mapping of mappings) {
    const el = document.querySelector(mapping.locator);
    const raw = el && typeof el.value === 'string' ? el.value : '';
    filledFlags[mapping.fieldId] = raw.length > 0;
    assert(raw.length > 0, `M8 ${mapping.fieldId} empty after fill`);
  }
  const rememberChecked = Boolean(document.getElementById('remember') && document.getElementById('remember').checked);
  assert(rememberChecked === false, 'M8 #remember must not be filled');
  assert(submitInvoked === false, 'M8 must not auto-submit');

  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        mode: 'operator_only_functional_validation',
        productionValidated: false,
        securityApproval: 'pending',
        broadProductionActivation: 'blocked',
        tlsCa: Boolean(caPath),
        httpStatus: response.status,
        finalUrl,
        allowedOrigin,
        locators: locatorEvidence,
        rememberUnmapped: true,
        rememberCheckedAfterFill: rememberChecked,
        runner: { ok: result.ok, reason: result.reason, filled: result.filled },
        fieldsFilled: filledFlags,
        submitInvoked,
        credentialValuesLogged: false,
        credentialValuesTransmitted: false,
      },
      null,
      2,
    ),
  );
}

await main();
