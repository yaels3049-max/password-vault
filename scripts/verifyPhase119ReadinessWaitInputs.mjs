/**
 * Phase 119 — readiness_wait_inputs verification (AC-119-R-1 … R-8 signals).
 * Usage: node scripts/verifyPhase119ReadinessWaitInputs.mjs
 *
 * Live residual AC-119-R-9 (Bank Hapoalim) is Owner-executed — not claimed here.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertNoServiceBranch(src, label) {
  assert(
    !/\bhapoalim\b|\bclalit\b|\bbankhapoalim\b|\b#userCode\b/i.test(src),
    `${label}: no Hapoalim/service-specific selectors or ids`,
  );
  assert(
    !/if\s*\([^)]*serviceId|switch\s*\([^)]*serviceId|serviceId\s*===|serviceId\s*!==/i.test(
      src,
    ),
    `${label}: no serviceId branching`,
  );
  assert(
    !/hostname\s*===|hostname\s*!==/i.test(src),
    `${label}: no hostname equality branching`,
  );
}

function loadInspectIntoWindow(html) {
  const { window, document } = parseHTML(html);
  // linkedom location defaults — pin https origin for origin bind tests
  const loc = {
    href: 'https://example.test/login',
    origin: 'https://example.test',
    protocol: 'https:',
    hostname: 'example.test',
    pathname: '/login',
  };
  Object.defineProperty(window, 'location', {
    configurable: true,
    get() {
      return loc;
    },
  });
  window.getComputedStyle = () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  });
  const proto = window.Element.prototype;
  proto.getBoundingClientRect = function () {
    return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100 };
  };
  globalThis.CSS = {
    escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1'),
  };
  const inspectSrc = read('extension/generic/page-structure-inspect.js');
  // eslint-disable-next-line no-new-func
  const run = new Function(
    'window',
    'globalThis',
    'CSS',
    `${inspectSrc}; return window;`,
  );
  const g = run(window, globalThis, globalThis.CSS);
  return { window: g, document, loc };
}

function fixturePage(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    finalUrl: 'https://example.test/login',
    origin: 'https://example.test',
    inputs: [],
    limits: { truncated: false, maxInputsApplied: 40 },
    ...overrides,
  };
}

async function loadAssistedModule() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-119r-')), 'assisted.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

async function main() {
  const inspectSrc = read('extension/generic/page-structure-inspect.js');
  const bgSrc = read('extension/background.js');
  const capsSrc = read('src/assistedMapping/capabilities.ts');
  const presentHtml = read('scripts/fixtures/phase119-readiness-present.html');
  const delayedHtml = read('scripts/fixtures/phase119-readiness-delayed.html');
  const neverHtml = read('scripts/fixtures/phase119-readiness-never.html');

  // --- T-R1 / AC-119-R-1: poll + early-exit architecture (not sleep-only) ---
  assert(
    inspectSrc.includes('collectSafePageStructureWithReadiness'),
    'T-R1 readiness helper exists',
  );
  assert(
    inspectSrc.includes('pollIntervalMs') &&
      inspectSrc.includes('maxTotalWaitMs') &&
      inspectSrc.includes('earlyExit'),
    'T-R1 poll/early-exit fields present',
  );
  assert(
    !/sleep\s*\(\s*ADMIN_INSPECT_READINESS_MAX_WAIT|setTimeout\s*\(\s*[^,]+,\s*ADMIN_INSPECT_READINESS_MAX_WAIT_MS\s*\)/.test(
      bgSrc,
    ),
    'T-R1 Admin inspect does not sole-sleep max wait',
  );
  assert(
    bgSrc.includes('ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10000'),
    'T-R1 max wait constant 10000',
  );
  assert(
    bgSrc.includes('ADMIN_INSPECT_READINESS_POLL_MS = 250'),
    'T-R1 poll constant 250',
  );
  assert(
    bgSrc.includes('collectSafePageStructureWithReadiness'),
    'T-R1 background calls readiness helper',
  );
  assert(
    capsSrc.includes('ADMIN_INSPECT_READINESS_ENABLED = true') &&
      capsSrc.includes('ADMIN_INSPECT_READINESS_CAPABILITY_ID') &&
      capsSrc.includes("'readiness_wait_inputs'"),
    'T-R1 catalog marks readiness_wait_inputs as Admin inspect timing',
  );
  assert(
    capsSrc.includes('SUPPORTED_INSPECTION_CAPABILITIES') &&
      /SUPPORTED_INSPECTION_CAPABILITIES\s*=\s*\[[^\]]*INSPECTION_CAPABILITY_SINGLE_PAGE_TOP[^\]]*\]/s.test(
        capsSrc,
      ),
    'T-R1 Analyze propose capability remains single_page_top only',
  );

  // --- T-R5 / AC-119-R-5: top-doc + no unauthorized structural paths ---
  const adminInspectSlice = bgSrc.slice(
    bgSrc.indexOf('admin-login-page-inspect'),
    bgSrc.indexOf('function openPageAndManagedAutofill'),
  );
  assert(
    adminInspectSlice.includes('frameIds: [0]'),
    'T-R5 Admin inspect uses frameIds: [0]',
  );
  assert(
    !/allFrames:\s*true|shadowRoot|openShadow|iframe|modal_activation|multi_step/i.test(
      inspectSrc,
    ),
    'T-R5 inspect script has no iframe/shadow/modal/multi-step',
  );
  assert(
    !/\biframe\b|\bshadowRoot\b|modal_activation|multi_step_sequence/.test(
      adminInspectSlice,
    ),
    'T-R5 Admin inspect path has no iframe/shadow/modal/multi-step',
  );

  // --- T-R6 / AC-119-R-6: no hostname/service/Hapoalim branches in readiness ---
  assertNoServiceBranch(inspectSrc, 'T-R6 page-structure-inspect');
  // Background readiness constants + Admin inspect slice only (full bg has legacy URL helpers)
  const readinessBgSnippet = [
    bgSrc.match(/ADMIN_INSPECT_READINESS_MAX_WAIT_MS[\s\S]*?ADMIN_INSPECT_READINESS_POLL_MS = 250/)?.[0] ||
      '',
    adminInspectSlice,
  ].join('\n');
  assert(
    !/\bhapoalim\b|\bclalit\b|\bbankhapoalim\b|\b#userCode\b/i.test(readinessBgSnippet),
    'T-R6 Admin readiness wiring has no Hapoalim selectors',
  );
  assert(
    !/serviceId\s*===|serviceId\s*!==/i.test(readinessBgSnippet),
    'T-R6 Admin readiness wiring has no serviceId branching',
  );
  assertNoServiceBranch(capsSrc, 'T-R6 capabilities');

  // --- T-R7 / AC-119-R-7: no .value / cookies / submit in inspect ---
  assert(
    !/\.value\b|document\.cookie|localStorage|sessionStorage|requestSubmit|\.submit\s*\(/.test(
      inspectSrc,
    ),
    'T-R7 inspect never reads values/cookies/storage or submits',
  );
  assert(
    inspectSrc.includes('Never read the live typed contents') ||
      inspectSrc.includes('Never reads typed input contents'),
    'T-R7 value-free affirmation present',
  );

  // --- T-R2 / AC-119-R-2: inputs present → early exit, truncated wait ---
  {
    const { window } = loadInspectIntoWindow(presentHtml);
    assert(
      typeof window.collectSafePageStructureWithReadiness === 'function',
      'T-R2 readiness fn exported',
    );
    const t0 = Date.now();
    const result = await window.collectSafePageStructureWithReadiness({
      expectedOrigin: 'https://example.test',
      maxTotalWaitMs: 10000,
      pollIntervalMs: 250,
    });
    const elapsed = Date.now() - t0;
    assert(result.ok === true, 'T-R2 ok');
    assert(
      result.page && result.page.inputs && result.page.inputs.length >= 2,
      'T-R2 structure non-empty',
    );
    assert(
      result.page.inputs.some((i) =>
        (i.locatorCandidates || []).some((c) => c.locator === '#ready-user'),
      ),
      'T-R2 includes #ready-user',
    );
    assert(result.readiness && result.readiness.earlyExit === true, 'T-R2 earlyExit');
    assert(result.readiness.timedOut === false, 'T-R2 not timedOut');
    assert(
      elapsed < 2000,
      `T-R2 duration ≪ max wait (elapsed=${elapsed}ms)`,
    );
    assert(
      result.readiness.waitedMs < 2000,
      `T-R2 waitedMs truncated (waitedMs=${result.readiness.waitedMs})`,
    );
  }

  // --- T-R3 / AC-119-R-3: delayed appear within window ---
  {
    const { window, document } = loadInspectIntoWindow(delayedHtml);
    const insertAt = 400;
    setTimeout(() => {
      const mount = document.getElementById('mount');
      const input = document.createElement('input');
      input.id = 'delayed-user';
      input.name = 'username';
      input.type = 'text';
      input.setAttribute('autocomplete', 'username');
      // linkedom disabled quirks
      input.disabled = false;
      input.readOnly = false;
      mount.appendChild(input);
    }, insertAt);

    const t0 = Date.now();
    const result = await window.collectSafePageStructureWithReadiness({
      expectedOrigin: 'https://example.test',
      maxTotalWaitMs: 3000,
      pollIntervalMs: 100,
    });
    const elapsed = Date.now() - t0;
    assert(result.ok === true, 'T-R3 ok');
    assert(
      result.page && result.page.inputs && result.page.inputs.length >= 1,
      'T-R3 structure non-empty after delay',
    );
    assert(
      result.page.inputs.some((i) =>
        (i.locatorCandidates || []).some((c) => c.locator === '#delayed-user'),
      ),
      'T-R3 captured #delayed-user',
    );
    assert(result.readiness.earlyExit === true, 'T-R3 earlyExit after appear');
    assert(elapsed >= insertAt - 50, 'T-R3 waited until inputs appeared');
    assert(elapsed < 3000, 'T-R3 finished before full window');
  }

  // --- T-R4 / AC-119-R-4: never appear → empty + D-118-14 zero provider ---
  {
    const { window } = loadInspectIntoWindow(neverHtml);
    const result = await window.collectSafePageStructureWithReadiness({
      expectedOrigin: 'https://example.test',
      maxTotalWaitMs: 600,
      pollIntervalMs: 100,
    });
    assert(result.ok === true, 'T-R4 ok with empty structure');
    assert(
      result.page && Array.isArray(result.page.inputs) && result.page.inputs.length === 0,
      'T-R4 zero eligible inputs',
    );
    assert(result.readiness.timedOut === true, 'T-R4 timedOut');
    assert(result.readiness.earlyExit === false, 'T-R4 not earlyExit');

    const mod = await loadAssistedModule();
    let providerCalls = 0;
    const countingProvider = {
      async proposeMappings() {
        providerCalls += 1;
        return { proposals: [] };
      },
    };
    const proposal = await mod.proposeFieldMappings({
      requestId: 'r-readiness-empty',
      serviceId: 'svc',
      schema: [
        { fieldId: 'user', label: 'User' },
        { fieldId: 'password', label: 'Password', type: 'password' },
      ],
      page: fixturePage({ inputs: result.page.inputs }),
      provider: countingProvider,
    });
    assert(providerCalls === 0, 'T-R4 D-118-14 zero provider calls');
    assert(
      proposal.status === 'no_confident_mapping' ||
        (proposal.warnings && proposal.warnings.includes('no_observed_inputs')),
      'T-R4 fail-closed empty-input path',
    );
  }

  // --- Origin mismatch fail-closed (AC-119-R-5) ---
  {
    const { window } = loadInspectIntoWindow(presentHtml);
    const bad = await window.collectSafePageStructureWithReadiness({
      expectedOrigin: 'https://other.test',
      maxTotalWaitMs: 500,
      pollIntervalMs: 100,
    });
    assert(bad.ok === false && bad.reason === 'origin_mismatch', 'T-R5 origin mismatch');
  }

  assert(
    capsSrc.includes('ADMIN_INSPECT_READINESS_ENABLED = true'),
    'AC-119-R readiness enabled flag',
  );
  assert(
    !isSupportedAsProposeMode(capsSrc, 'readiness_wait_inputs'),
    'readiness_wait_inputs is timing-only (not SUPPORTED_INSPECTION_CAPABILITIES)',
  );

  console.log('verifyPhase119ReadinessWaitInputs: PASS');
  console.log('  - AC-119-R-1 poll/early-exit architecture');
  console.log('  - AC-119-R-2 present → early exit');
  console.log('  - AC-119-R-3 delayed appear → captured');
  console.log('  - AC-119-R-4 timeout empty → D-118-14 zero provider');
  console.log('  - AC-119-R-5 frameIds [0] + origin fail-closed');
  console.log('  - AC-119-R-6 no Hapoalim/hostname/serviceId in readiness');
  console.log('  - AC-119-R-7 no values/cookies/submit');
  console.log('  - AC-119-R-8 signals covered here; run 117/118/119.1/119.2 + tsc externally');
  console.log('  - AC-119-R-9 Owner live residual — NOT claimed');
}

function isSupportedAsProposeMode(capsSrc, id) {
  const m = capsSrc.match(
    /SUPPORTED_INSPECTION_CAPABILITIES\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  if (!m) return false;
  return m[1].includes(`'${id}'`) || m[1].includes(`"${id}"`);
}

main().catch((err) => {
  console.error('verifyPhase119ReadinessWaitInputs: FAIL');
  console.error(err);
  process.exit(1);
});
