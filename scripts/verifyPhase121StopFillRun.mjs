/**
 * D-121-72 — stop a fill run; a closed tab ends the run.
 * Real `extension/background.js` (chrome.* mocked) + the real Hub modules (managedAutofill,
 * specialLoginFlow, specialLoginFlowMessages, fillRunControl) in ONE bundle (shared lock),
 * wired end-to-end: the Hub's extension bridge calls the background's external router.
 * In-memory mutations prove each guard is load-bearing. No credential value is ever logged.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const abs = (rel) => join(root, rel).replace(/\\/g, '/');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function ok(msg) {
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ORIGIN = 'https://login.example.test';
const ENTRY_URL = `${ORIGIN}/signin`;
const SECRET_USER = 'stop-user-Q7';
const SECRET_PASS = 'stop-pass-Z9k';
const SECRETS = [SECRET_USER, SECRET_PASS];
const LOGS = [];

// ---------------------------------------------------------------------------
// Extension harness — mocked chrome.*, the real background.js
// ---------------------------------------------------------------------------
const BG_SRC = read('extension/background.js');

class Ext {
  constructor({ bgSrc = BG_SRC, page = {} } = {}) {
    this.page = { standardReady: false, step2Ready: false, ...page };
    this.calls = [];
    this.fills = [];
    this.removed = [];
    this.tab = null;
    this.updated = new Set();
    this.removedListeners = new Set();
    this.timers = new Set();
    this.listener = null;
    this.seq = 0;
    this.chrome = this.makeChrome();
    const timers = this.timers;
    const st = (fn, ms, ...args) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn(...args);
      }, ms);
      timers.add(t);
      return t;
    };
    const ct = (t) => {
      timers.delete(t);
      clearTimeout(t);
    };
    const bgConsole = { log: (...a) => LOGS.push(a), info: (...a) => LOGS.push(a), warn: (...a) => LOGS.push(a), error: (...a) => LOGS.push(a) };
    new Function('chrome', 'console', 'setTimeout', 'clearTimeout', `${bgSrc}\n;`)(this.chrome, bgConsole, st, ct);
    assert(typeof this.listener === 'function', 'background registered its external router');
    this.baselineTimers = this.timers.size;
  }

  makeChrome() {
    const ext = this;
    const runtime = {
      lastError: null,
      onMessageExternal: { addListener: (fn) => (ext.listener = fn) },
    };
    function fire(err, cb, value) {
      runtime.lastError = err ? { message: err } : null;
      try {
        if (cb) cb(value);
      } finally {
        runtime.lastError = null;
      }
    }
    return {
      runtime,
      tabs: {
        create(props, cb) {
          ext.tab = { id: 7, url: props.url, status: 'loading' };
          setTimeout(() => fire(null, cb, { id: 7, index: 0 }), 0);
          setTimeout(() => {
            if (!ext.tab) return;
            ext.tab.status = 'complete';
            for (const fn of [...ext.updated]) fn(7, { status: 'complete' }, { ...ext.tab });
          }, 5);
        },
        get(id, cb) {
          setTimeout(() => {
            if (!ext.tab || id !== ext.tab.id) fire(`No tab with id: ${id}`, cb, undefined);
            else fire(null, cb, { ...ext.tab });
          }, 0);
        },
        remove(id, cb) {
          ext.removed.push(id);
          if (cb) setTimeout(() => fire(null, cb), 0);
        },
        onUpdated: { addListener: (fn) => ext.updated.add(fn), removeListener: (fn) => ext.updated.delete(fn) },
        onRemoved: { addListener: (fn) => ext.removedListeners.add(fn), removeListener: (fn) => ext.removedListeners.delete(fn) },
      },
      scripting: {
        executeScript(details, cb) {
          // Issue order: a call issued before a cancel / close may still land in the page.
          const seq = ++ext.seq;
          setTimeout(() => {
            if (!ext.tab) {
              fire('No tab with id: 7', cb, undefined);
              return;
            }
            fire(null, cb, ext.respond(details, seq));
          }, 0);
        },
      },
    };
  }

  /** Page stand-in: answers by the injected function's shape; a "fill" = credentials reached the page. */
  respond(details, seq) {
    const src = details.func ? String(details.func) : '';
    const name = details.func ? details.func.name : '';
    const argsJson = JSON.stringify(details.args || []);
    const at = seq;
    this.calls.push({ at, files: Boolean(details.files), name, argsJson });
    const one = (result) => [{ frameId: 0, result }];
    if (details.files) return one(undefined);
    if (name === 'specialFrameProbe') return one({ origin: ORIGIN, protocol: 'https:', frameId: 0 });
    if (/specialGestureWatch/.test(name)) return one({ ok: true, seen: false });
    if (src.includes('runManagedAutofill(opts)')) {
      const opts = (details.args || [])[0] || {};
      const creds = opts.credentials || {};
      const carries = Object.values(creds).some((v) => SECRETS.includes(v));
      if (carries) this.fills.push({ at, locators: (opts.fieldMappings || []).map((m) => m.locator) });
      const locators = (opts.fieldMappings || []).map((m) => m.locator);
      if (locators.includes('#user') && !this.page.standardFlow) return one({ ok: true, filled: 1 });
      if (this.page.standardReady) return one({ ok: true, filled: locators.length });
      return one({ ok: false, reason: 'targets_not_ready', fieldId: 'username' });
    }
    if (src.includes('targets[0].click()')) return one({ ok: true });
    if (src.includes('isSpecialDeclaredReadinessMet')) {
      this.readinessPolls = (this.readinessPolls || 0) + 1;
      return one({ met: this.page.step2Ready === true });
    }
    return one(undefined);
  }

  closeTab() {
    const id = this.tab.id;
    this.tab = null;
    for (const fn of [...this.removedListeners]) fn(id, { isWindowClosing: false });
  }

  /** Hub → extension: resolves with the router's answer (external messaging). */
  send(message) {
    return new Promise((resolve) => {
      const keep = this.listener(JSON.parse(JSON.stringify(message)), { tab: { id: 99, index: 2 }, origin: 'https://hub.test' }, resolve);
      if (keep !== true) {
        // Synchronous answer or none: the router already called resolve (or never will).
      }
    });
  }

  pendingRunTimers() {
    return this.timers.size - this.baselineTimers;
  }

  /** Calls / fills (`at` = issue sequence) issued after the mark. */
  callsAfter(mark) {
    return this.calls.filter((c) => c.at > mark);
  }

  mark() {
    return this.seq;
  }
}

function withDeadline(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: no answer within ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const STANDARD_MESSAGE = (runId) => ({
  type: 'HUB_MANAGED_AUTOFILL',
  runId,
  url: ENTRY_URL,
  allowedOrigin: ORIGIN,
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#login-user' },
    { fieldId: 'password', locatorType: 'css', locator: '#login-pass' },
  ],
  credentials: { username: SECRET_USER, password: SECRET_PASS },
  diagnosticPath: 'admin_test',
});

// ---------------------------------------------------------------------------
// Hub bundle — real modules, only the browser bridge stubbed (it routes to an Ext harness)
// ---------------------------------------------------------------------------
const BRIDGE_STUB = `
export const isExtensionAvailable = () => true;
export const openUrlInNewTab = (url) => { globalThis.__hub.opens.push(url); };
export const sendExtensionMessageAsync = (message) => globalThis.__hub.send(message);
export const sendExtensionMessage = () => { throw new Error('legacy send'); };
export const getChromeRuntime = () => null;
export const getExtensionId = () => 'test-ext';
export const probeExtensionAvailable = async () => true;
`;
const ENTRY = `
export * as MA from '${abs('src/execution/managedAutofill.ts')}';
export * as SLF from '${abs('src/execution/specialLoginFlow.ts')}';
export * as MSG from '${abs('src/execution/specialLoginFlowMessages.ts')}';
export * as FRC from '${abs('src/execution/fillRunControl.ts')}';
`;

async function bundleHub(name, transforms = []) {
  return withTempDir(`pv-12172-${name}-`, async (outdir) => {
    const outfile = join(outdir, `${name}.mjs`);
    const applied = new Set();
    await build({
      stdin: { contents: ENTRY, resolveDir: root, loader: 'ts', sourcefile: 'entry.ts' },
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      write: true,
      packages: 'external',
      logLevel: 'silent',
      define: { 'import.meta.env.DEV': 'false' },
      plugins: [
        {
          name: 'pv-12172',
          setup(b) {
            b.onResolve({ filter: /(^|\/)extensionBridge$/ }, () => ({ path: 'bridge', namespace: 'pv-stub' }));
            b.onResolve({ filter: /(^|\/)browserIntegration$/ }, () => ({ path: 'integration', namespace: 'pv-stub' }));
            b.onLoad({ filter: /.*/, namespace: 'pv-stub' }, (args) => ({
              contents: args.path === 'bridge' ? BRIDGE_STUB : `export * from '${abs('src/browserIntegration/index.ts')}';\n${BRIDGE_STUB}`,
              loader: 'ts',
              resolveDir: root,
            }));
            b.onLoad({ filter: /\.tsx?$/ }, (args) => {
              const p = args.path.replace(/\\/g, '/');
              const mine = transforms.filter(([suffix]) => p.endsWith(suffix));
              if (mine.length === 0) return undefined;
              let text = readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
              for (const [suffix, from, to] of mine) {
                assert(text.split(from).length === 2, `transform target present once in ${suffix}: ${from.slice(0, 60)}`);
                text = text.replace(from, () => to);
                applied.add(`${suffix}:${from}`);
              }
              return { contents: text, loader: p.endsWith('.tsx') ? 'tsx' : 'ts' };
            });
          },
        },
      ],
    });
    assert(applied.size === transforms.length, `${name}: every transform applied (${applied.size}/${transforms.length})`);
    return import(pathToFileURL(outfile).href);
  });
}

/** Hub bridge → a live Ext harness (end-to-end), or a manual answer function. */
function wireHub(target) {
  const hub = { opens: [], sends: [] };
  hub.send = (message) => {
    hub.sends.push({ at: Date.now(), type: message.type, runId: message.runId });
    return typeof target === 'function' ? target(message) : target.send(message);
  };
  globalThis.__hub = hub;
  return hub;
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

const SAVED_PROFILE = {
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#login-user' },
    { fieldId: 'password', locatorType: 'css', locator: '#login-pass' },
  ],
  loginEntryUrl: ENTRY_URL,
  allowedOrigin: ORIGIN,
  configVersion: 1,
};
const LOGIN_FIELDS = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Password', type: 'password', required: true },
];
const TEMP = { username: SECRET_USER, password: SECRET_PASS };

function adminManagedRun(H, serviceId = 'svc-stop') {
  return H.MA.executeAdminManagedAutofillTest({ serviceId, savedProfile: SAVED_PROFILE, loginFields: LOGIN_FIELDS, tempCredentials: { ...TEMP } });
}

function dhManagedRun(H, serviceId = 'svc-stop', profile = 'profile-1') {
  return H.MA.sendManagedAutofillPayloadAndAwait({
    url: ENTRY_URL,
    allowedOrigin: ORIGIN,
    fieldMappings: SAVED_PROFILE.fieldMappings,
    credentials: { ...TEMP },
    executionKey: H.MA.managedAutofillExecutionKey(serviceId, profile),
  });
}

function exitAction(actionId) {
  return {
    actionId,
    kind: 'intermediate_transition',
    label: 'Next',
    locatorType: 'css',
    locator: '#next',
    approvedForRuntime: true,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#pass', timeoutMs: 20000 },
  };
}
function multiPlan() {
  return {
    planVersion: 5,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      { stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }], exitTransition: exitAction('exit-1') },
      { stepId: 'step-2', fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass' }] },
    ],
  };
}
function specialRun(H, executionKey, diagnosticPath) {
  return H.SLF.executeSpecialLoginFlow({
    context: { kind: 'active', plan: multiPlan(), activePlanVersion: 5 },
    entry: { authoringUrl: ENTRY_URL, allowedOrigin: ORIGIN },
    credentials: { ...TEMP },
    executionKey,
    diagnosticPath,
  });
}

async function untilTrue(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(10);
  }
  throw new Error(`${label}: condition not reached within ${ms}ms`);
}

// ---------------------------------------------------------------------------
// Checks (each takes the sources / bundles so mutations can re-run them)
// ---------------------------------------------------------------------------

/** E1 STANDARD: tab closed mid-wait → tab_closed promptly; listeners + timers detached; no fill after. */
async function checkStandardTabClosed(bgSrc = BG_SRC) {
  const ext = new Ext({ bgSrc });
  const answer = ext.send(STANDARD_MESSAGE('run-close'));
  await untilTrue(() => ext.fills.length >= 2, 3000, 'E1 retries started (page never ready)');
  assert(ext.removedListeners.size >= 1, 'E1 the run watches its tab (onRemoved)');
  const closedAt = Date.now();
  const mark = ext.mark();
  ext.closeTab();
  const r = await withDeadline(answer, 1000, 'E1 tab closed');
  const latency = Date.now() - closedAt;
  assert(r && r.ok === false && r.reason === 'tab_closed', `E1 answer = tab_closed (got ${JSON.stringify(r)})`);
  assert(latency < 200, `E1 answered promptly (${latency}ms)`);
  await sleep(900);
  assert(ext.seq === mark, `E1 nothing issued to the page after the tab closed (${ext.seq - mark} executeScript calls)`);
  assert(ext.removedListeners.size === 0 && ext.updated.size === 0, `E1 every tab listener detached (onRemoved ${ext.removedListeners.size}, onUpdated ${ext.updated.size})`);
  assert(ext.pendingRunTimers() === 0, `E1 no run timer left (${ext.pendingRunTimers()})`);
}

/** E2 cancel mid-wait → cancelled; no fill after the cancel; tab not closed. E3 unknown / finished → no-op. */
async function checkStandardCancel(bgSrc = BG_SRC) {
  const ext = new Ext({ bgSrc });
  const answer = ext.send(STANDARD_MESSAGE('run-cancel'));
  await untilTrue(() => ext.fills.length >= 2, 3000, 'E2 retries started');
  const unknown = await ext.send({ type: 'HUB_MANAGED_AUTOFILL_CANCEL', runId: 'no-such-run' });
  assert(unknown && unknown.ok === true && unknown.cancelled === false, `E3 unknown run id → no-op (${JSON.stringify(unknown)})`);
  const blank = await ext.send({ type: 'HUB_MANAGED_AUTOFILL_CANCEL' });
  assert(blank && blank.cancelled === false, 'E3 missing run id → no-op');
  const before = ext.fills.length;
  await sleep(350);
  assert(ext.fills.length > before, 'E3 the run kept going after the no-op cancels');
  const mark = ext.mark();
  const c = await ext.send({ type: 'HUB_MANAGED_AUTOFILL_CANCEL', runId: 'run-cancel' });
  assert(c && c.ok === true && c.cancelled === true, `E2 cancel acknowledged (${JSON.stringify(c)})`);
  const r = await withDeadline(answer, 1000, 'E2 cancel');
  assert(r && r.ok === false && r.reason === 'cancelled', `E2 answer = cancelled (got ${JSON.stringify(r)})`);
  await sleep(900);
  assert(ext.fills.filter((f) => f.at > mark).length === 0, `E2 no fill issued after the cancel (${ext.fills.filter((f) => f.at > mark).length})`);
  assert(ext.seq === mark, `E2 nothing issued to the page after the cancel (${ext.seq - mark})`);
  assert(ext.removed.length === 0 && ext.tab !== null, 'E2 the tab is not closed');
  assert(ext.removedListeners.size === 0 && ext.updated.size === 0 && ext.pendingRunTimers() === 0, 'E2 listeners + timers detached');
  const again = await ext.send({ type: 'HUB_MANAGED_AUTOFILL_CANCEL', runId: 'run-cancel' });
  assert(again && again.cancelled === false, 'E3 cancel of a finished run → no-op');

  const done = new Ext({ bgSrc, page: { standardReady: true, standardFlow: true } });
  const ok1 = await withDeadline(done.send(STANDARD_MESSAGE('run-done')), 2000, 'E3 finished run');
  assert(ok1 && ok1.ok === true, `E3 a run that finishes still answers ok (${JSON.stringify(ok1)})`);
  const late = await done.send({ type: 'HUB_MANAGED_AUTOFILL_CANCEL', runId: 'run-done' });
  assert(late && late.cancelled === false && done.removed.length === 0, 'E3 cancel after success → no-op, tab untouched');
}

/** E4 SPECIAL: tab closed between steps (step 1 filled, waiting for step 2) → tab_closed; step 2 never filled. */
async function checkSpecialTabClosed(H, bgSrc = BG_SRC) {
  for (const [key, path, expected] of [
    ['svc-sp::admin_test', 'admin_test', H.FRC.MSG_ADMIN_FILL_TEST_TAB_CLOSED],
    ['svc-sp::profile-1', 'digital_home', H.FRC.MSG_FILL_RUN_STOPPED],
  ]) {
    const ext = new Ext({ bgSrc });
    wireHub(ext);
    const pending = specialRun(H, key, path);
    await untilTrue(() => ext.fills.some((f) => f.locators.includes('#user')), 3000, 'E4 step 1 filled');
    await untilTrue(() => (ext.readinessPolls || 0) >= 2, 3000, 'E4 polling step 2 readiness');
    const closedAt = Date.now();
    const mark = ext.mark();
    ext.closeTab();
    const o = await withDeadline(pending, 1000, `E4 SPECIAL ${path}`);
    assert(Date.now() - closedAt < 200, 'E4 answered promptly');
    assert(o.ok === false && o.reason === 'tab_closed', `E4 ${path} → tab_closed (got ${o.reason})`);
    const message = path === 'admin_test' ? H.MSG.specialAdminMessage(o) : H.MSG.specialEndUserMessage(o);
    assert(message === expected, `E4 ${path} copy (got ${message})`);
    assert(H.FRC.isFillRunActive('special', key) === false, 'E4 Hub lock released');
    await sleep(600);
    assert(!ext.fills.some((f) => f.locators.includes('#pass')), 'E4 step 2 never filled');
    assert(ext.seq === mark, `E4 nothing issued to the page after the tab closed (${ext.seq - mark})`);
    assert(ext.removedListeners.size === 0 && ext.updated.size === 0 && ext.pendingRunTimers() === 0, 'E4 listeners + timers detached');
  }
}

/** H1 «עצור»: cancel by token → lock released at once, new run allowed, the late answer ignored. */
async function checkHubStop(H) {
  const ext = new Ext();
  const hub = wireHub(ext);
  const first = adminManagedRun(H);
  await untilTrue(() => ext.fills.length >= 2, 3000, 'H1 run in flight');
  const runMsg = hub.sends.find((s) => s.type === 'HUB_MANAGED_AUTOFILL');
  assert(runMsg && typeof runMsg.runId === 'string' && runMsg.runId.length > 0, 'H1 the run carries its token as runId');
  assert(H.MA.managedAutofillInFlightCount() === 1, 'H1 lock held while running');
  const stopMark = ext.mark();
  assert(H.MA.stopAdminFillTest('svc-stop') === true, 'H1 stop → true');
  assert(H.MA.managedAutofillInFlightCount() === 0, 'H1 lock released synchronously by «עצור»');
  const cancelMsg = hub.sends.find((s) => s.type === 'HUB_MANAGED_AUTOFILL_CANCEL');
  assert(cancelMsg && cancelMsg.runId === runMsg.runId, 'H1 cancel names the run token');
  const o1 = await withDeadline(first, 200, 'H1 stopped run');
  assert(o1.ok === false && o1.reason === 'cancelled' && o1.userMessage === H.FRC.MSG_ADMIN_FILL_TEST_STOPPED, `H1 outcome cancelled + «הבדיקה נעצרה.» (got ${o1.reason} / ${o1.userMessage})`);
  assert(H.MA.formatAdminManagedTestResultSummary(o1) === H.FRC.MSG_ADMIN_FILL_TEST_STOPPED, 'H1 Admin summary is the plain stop copy');
  await sleep(400);
  assert(ext.seq === stopMark, `H1 nothing issued to the page after «עצור» (extension cancelled; ${ext.seq - stopMark})`);
  assert(ext.removed.length === 0, 'H1 tab not closed by «עצור»');
  const second = adminManagedRun(H);
  await untilTrue(() => hub.sends.filter((s) => s.type === 'HUB_MANAGED_AUTOFILL').length === 2, 1000, 'H1 a new run starts (not busy)');
  assert(H.MA.managedAutofillInFlightCount() === 1, 'H1 new run holds the lock');
  const fillsBefore = ext.fills.length;
  await untilTrue(() => ext.fills.length >= fillsBefore + 2, 3000, 'H1 new run in flight');
  ext.closeTab();
  const o2 = await withDeadline(second, 1000, 'H1 second run');
  assert(o2.reason === 'tab_closed' && o2.userMessage === H.FRC.MSG_ADMIN_FILL_TEST_TAB_CLOSED, `H1 second run tab_closed copy (got ${o2.reason} / ${o2.userMessage})`);
  assert(H.MA.managedAutofillInFlightCount() === 0, 'H1 lock released after tab_closed');
  assert(H.MA.stopAdminFillTest('svc-stop') === false, 'H1 stop with no run → false');
}

/** H1b late answer of a stopped token is ignored, also while a new run of the same key is in flight. */
async function checkHubLateAnswerIgnored(H) {
  const answers = [];
  const hub = wireHub((message) => {
    if (message.type === 'HUB_MANAGED_AUTOFILL_CANCEL') return Promise.resolve({ ok: true, cancelled: true });
    const d = deferred();
    answers.push(d);
    return d.promise;
  });
  const first = adminManagedRun(H, 'svc-late');
  await untilTrue(() => answers.length === 1, 500, 'H1b first sent');
  H.MA.stopAdminFillTest('svc-late');
  const second = adminManagedRun(H, 'svc-late');
  await untilTrue(() => answers.length === 2, 500, 'H1b second sent');
  answers[0].resolve({ ok: true, filled: 2 });
  const o1 = await first;
  assert(o1.ok === false && o1.reason === 'cancelled', `H1b late success of the stopped token ignored (got ${JSON.stringify(o1.reason)})`);
  await sleep(30);
  assert(H.MA.managedAutofillInFlightCount() === 1, 'H1b the late answer did not release the new run');
  answers[1].resolve({ ok: true, filled: 2 });
  const o2 = await second;
  assert(o2.ok === true, 'H1b the new run gets its own answer');
  assert(hub.opens.length === 0, 'H1b nothing opened');
}

/** H2 Hub bound (bundle with a short bound): lock released, timeout copy, late answer ignored. */
async function checkHubBound(HB) {
  for (const [run, expected] of [
    [() => adminManagedRun(HB, 'svc-bound'), HB.FRC.MSG_ADMIN_FILL_TEST_TIMEOUT],
    [() => dhManagedRun(HB, 'svc-bound'), HB.FRC.MSG_FILL_RUN_TIMEOUT],
  ]) {
    const answers = [];
    const hub = wireHub((message) => {
      if (message.type === 'HUB_MANAGED_AUTOFILL_CANCEL') return Promise.resolve({ ok: true, cancelled: true });
      const d = deferred();
      answers.push(d);
      return d.promise;
    });
    const o = await withDeadline(run(), 1500, 'H2 bound');
    assert(o.ok === false && o.reason === 'run_timeout' && o.userMessage === expected, `H2 STANDARD bound → run_timeout + copy (got ${o.reason} / ${o.userMessage})`);
    assert(HB.MA.managedAutofillInFlightCount() === 0, 'H2 lock released by the bound');
    const runMsg = hub.sends.find((s) => s.type === 'HUB_MANAGED_AUTOFILL');
    const cancel = hub.sends.find((s) => s.type === 'HUB_MANAGED_AUTOFILL_CANCEL');
    assert(cancel && cancel.runId === runMsg.runId, 'H2 the bound also cancels the run in the extension');
    answers[0].resolve({ ok: true, filled: 2 });
    await sleep(20);
    assert(HB.MA.managedAutofillInFlightCount() === 0 && hub.opens.length === 0, 'H2 late answer ignored, nothing opened');
  }
  for (const [key, path, expected] of [
    ['svc-bsp::admin_test', 'admin_test', HB.FRC.MSG_ADMIN_FILL_TEST_TIMEOUT],
    ['svc-bsp::profile-1', 'digital_home', HB.FRC.MSG_FILL_RUN_TIMEOUT],
  ]) {
    const hub = wireHub((message) => (message.type === 'HUB_MANAGED_AUTOFILL_CANCEL' ? Promise.resolve({ ok: true }) : new Promise(() => {})));
    const o = await withDeadline(specialRun(HB, key, path), 1500, 'H2 SPECIAL bound');
    assert(o.ok === false && o.reason === 'run_timeout', `H2 SPECIAL ${path} bound → run_timeout (got ${o.reason})`);
    const message = path === 'admin_test' ? HB.MSG.specialAdminMessage(o) : HB.MSG.specialEndUserMessage(o);
    assert(message === expected, `H2 SPECIAL ${path} copy (got ${message})`);
    assert(HB.FRC.isFillRunActive('special', key) === false && hub.opens.length === 0, 'H2 SPECIAL lock released, no entry opened');
    assert(hub.sends.some((s) => s.type === 'HUB_MANAGED_AUTOFILL_CANCEL'), 'H2 SPECIAL bound cancels the run');
  }
}

/** H3 Digital Home inherits tab_closed (STANDARD convergence, end-to-end) with neutral copy. */
async function checkDigitalHomeTabClosed(H) {
  const ext = new Ext();
  wireHub(ext);
  const pending = dhManagedRun(H, 'svc-dh');
  await untilTrue(() => ext.fills.length >= 1, 3000, 'H3 DH run in flight');
  assert(H.MA.isManagedAutofillInFlightFor('svc-dh', 'profile-1') === true, 'H3 DH lock held');
  assert(H.MA.stopAdminFillTest('svc-dh') === false, 'H3 «עצור» (Admin) never stops a Digital Home run');
  ext.closeTab();
  const o = await withDeadline(pending, 1000, 'H3 DH tab closed');
  assert(o.ok === false && o.reason === 'tab_closed' && o.userMessage === H.FRC.MSG_FILL_RUN_STOPPED, `H3 DH tab_closed neutral copy (got ${o.reason} / ${o.userMessage})`);
  assert(!/בדיקה/.test(o.userMessage), 'H3 DH copy never mentions the Admin test');
  assert(H.MA.isManagedAutofillInFlightFor('svc-dh', 'profile-1') === false, 'H3 DH lock released');
}

function checkBoundConstants(H) {
  const n = (name) => Number((BG_SRC.match(new RegExp(`(?:const|var) ${name} = (\\d+);`)) || [])[1]);
  const tabLoad = n('GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS');
  const operation = n('GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS');
  assert(tabLoad > 0 && operation > 0, 'extension worst-case constants found');
  assert(H.FRC.FILL_RUN_HUB_BOUND_MS > tabLoad + operation, `Hub bound ${H.FRC.FILL_RUN_HUB_BOUND_MS} > extension worst case ${tabLoad + operation}`);
  assert(H.FRC.FILL_RUN_HUB_BOUND_MS - (tabLoad + operation) <= 30000, 'Hub bound margin is bounded (≤ 30s)');
  assert(H.SLF.SPECIAL_HUB_RESPONSE_TIMEOUT_MS === H.FRC.FILL_RUN_HUB_BOUND_MS, 'SPECIAL uses the same Hub bound');
}

function checkStatic() {
  const control = read('src/execution/fillRunControl.ts');
  for (const bad of ['hostname', 'serviceId ===', 'dropbox', '.submit(', 'requestSubmit']) {
    assert(!control.toLowerCase().includes(bad.toLowerCase()), `fillRunControl.ts: forbidden token ${bad}`);
  }
  assert(!/dropbox/i.test(BG_SRC), 'background.js: no site name');
  assert(!/credential|password/i.test(control.replace(/^\s*(\/\/|\*).*$/gm, '')), 'fillRunControl handles no credentials');
  const cancelRouter = BG_SRC.indexOf("message.type === 'HUB_MANAGED_AUTOFILL_CANCEL'");
  assert(cancelRouter > 0 && !/chrome\.tabs\.remove/.test(BG_SRC.slice(BG_SRC.indexOf('function cancelHubFillRun'), BG_SRC.indexOf('function openGenericRealSiteTab'))), 'cancel never closes the tab');
  const leak = LOGS.map((a) => { try { return JSON.stringify(a); } catch { return String(a); } }).filter((l) => SECRETS.some((s) => l.includes(s)));
  assert(leak.length === 0, `no credential value in ${LOGS.length} background log lines`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const H = await bundleHub('hub');
const BOUND_FROM = 'export const FILL_RUN_HUB_BOUND_MS =\n  EXT_RUN_TAB_LOAD_MAX_MS + EXT_RUN_OPERATION_MAX_MS + FILL_RUN_BOUND_MARGIN_MS;';
const FAST_BOUND = [
  ['src/execution/fillRunControl.ts', BOUND_FROM, 'export const FILL_RUN_HUB_BOUND_MS = 80;'],
  ['src/execution/specialLoginFlow.ts', 'SPECIAL_HUB_RESPONSE_TIMEOUT_MS = 260000;', 'SPECIAL_HUB_RESPONSE_TIMEOUT_MS = 80;'],
];
const HB = await bundleHub('hubbound', FAST_BOUND);

console.log('D-121-72 — stop a fill run; a closed tab ends the run');
await checkStandardTabClosed();
ok('E1 STANDARD tab closed mid-wait → tab_closed < 200ms; onRemoved / onUpdated detached; no run timer; no fill after');
await checkStandardCancel();
ok('E2/E3 cancel mid-wait → cancelled, no fill after, tab kept; unknown / missing / finished run id → no-op');
await checkSpecialTabClosed(H);
ok('E4 SPECIAL tab closed between steps → tab_closed (Admin copy / neutral DH copy); step 2 never filled; detached');
await checkHubStop(H);
ok('H1 «עצור»: cancel by token, lock released synchronously, new run allowed, no fill after, tab kept');
await checkHubLateAnswerIgnored(H);
ok('H1b a late answer of a stopped token is ignored (also while a new run of the same key is in flight)');
await checkHubBound(HB);
ok('H2 Hub bound → run_timeout, lock released, extension cancelled, late answer ignored (STANDARD + SPECIAL, Admin + DH copy)');
await checkDigitalHomeTabClosed(H);
ok('H3 Digital Home inherits tab_closed (neutral copy); «עצור» never touches a DH run');
checkBoundConstants(H);
ok(`H4 Hub bound ${H.FRC.FILL_RUN_HUB_BOUND_MS}ms = extension tab load + operation + margin; SPECIAL shares it`);
checkStatic();
ok('static: no site branches, no credentials in run control, cancel never closes the tab, no credential in logs');

// ---------------------------------------------------------------------------
// Mutations — each must be caught
// ---------------------------------------------------------------------------
async function expectCaught(label, fn) {
  try {
    await fn();
  } catch (err) {
    ok(`mutation caught: ${label}  [${String(err.message).slice(0, 110)}]`);
    return;
  }
  throw new Error(`mutation NOT caught: ${label}`);
}
function mutateBg(from, to, src = BG_SRC) {
  assert(src.split(from).length === 2, `bg mutation target present once: ${from.slice(0, 60)}`);
  return src.replace(from, () => to);
}

await expectCaught('M1 onRemoved only logs (closed tab does not end the run)', () =>
  checkStandardTabClosed(mutateBg("finishSession({ ok: false, reason: 'tab_closed' });", "console.log('tab removed');")),
);
await expectCaught('M2 cancel ignored (the run never stops at its checkpoints)', () =>
  checkStandardCancel(
    mutateBg("      cancel: function () {\n        finishSession({ ok: false, reason: 'cancelled' });\n      },", '      cancel: function () {},'),
  ),
);
await expectCaught('M3 a fill after the cancel (no checkpoint before the fill; retries outlive the run)', () => {
  let mutated = mutateBg(
    '  if (run && !run.active()) {\n    return;\n  }\n  var retryLater = run ? run.later : setTimeout;',
    '  var retryLater = setTimeout;',
  );
  mutated = mutateBg('    function () {\n      if (run && !run.active()) {\n        return;\n      }\n', '    function () {\n', mutated);
  return checkStandardCancel(mutated);
});
await expectCaught('M3b SPECIAL keeps polling after the tab closed (checkpoints ignore the run, timers outlive it)', async () => {
  let mutated = mutateBg('        return !done && run.active();\n', '        return !done;\n');
  mutated = mutateBg(
    '    later: function (fn, ms) {\n      var timer = setTimeout(function () {\n        var at = runTimers.indexOf(timer);\n        if (at >= 0) runTimers.splice(at, 1);\n        if (!settled) fn();\n      }, ms);\n      runTimers.push(timer);\n    },',
    '    later: function (fn, ms) {\n      setTimeout(fn, ms);\n    },',
    mutated,
  );
  await checkSpecialTabClosed(H, mutated);
});
{
  const HL = await bundleHub('hublate', [['src/execution/fillRunControl.ts', '  sendFillRunCancel(entry.token);\n  entry.stop();\n', '  sendFillRunCancel(entry.token);\n']]);
  await expectCaught('M4 late answer not ignored (stop does not settle the waiting run)', () => checkHubLateAnswerIgnored(HL));
}
{
  const HN = await bundleHub('hubnobound', [
    ...FAST_BOUND,
    ['src/execution/fillRunControl.ts', '          finish({ kind: \'timeout\' });\n', ''],
  ]);
  await expectCaught('M5 no Hub bound (timeout never settles the run)', () => checkHubBound(HN));
}
{
  const HC = await bundleHub('hubnocancel', [['src/execution/fillRunControl.ts', '  sendFillRunCancel(entry.token);\n  entry.stop();\n', '  entry.stop();\n']]);
  await expectCaught('M6 «עצור» never tells the extension (run keeps filling)', () => checkHubStop(HC));
}

console.log(`\nD-121-72 stop-fill-run verification PASS (${passed} checks)`);
// Mutated extension runs leave their own long timers (e.g. the 120s operation timeout) behind.
process.exit(0);
