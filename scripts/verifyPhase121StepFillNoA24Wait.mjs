/**
 * Phase 121 D-121-70 — a SPECIAL step with an exit fills without the A2.4 post-runtime
 * observation window (`skipPostRuntimeObserve`), so its transition is clicked right after
 * the verified fill. The last step keeps A2.4; STANDARD / other callers never send the flag.
 *
 * - Page level (REAL validated-autofill + fill scripts in linkedom): ok / reason / filled and
 *   the non-A2.4 stamps are identical with and without the flag; the flag drops only the
 *   post_runtime_a24* stamps and the bound wait; A2.3 post_verify_* stamps stay.
 * - Orchestrator (REAL extension/background.js runSpecialLoginFlow, mock chrome.* only):
 *   MULTI_STEP on admin_test and digital_home: step 1 sends the flag, no A2.4 stamps, click
 *   before the bound; the last step sends no flag and keeps A2.4 stamps; R-2 order kept.
 * - STANDARD (REAL runManagedAutofillOnTab): no flag, A2.4 stamps present.
 * - Static: one flag site in background.js (inside runSpecialLoginFlow, guarded by the exit);
 *   the validated-autofill revert = pinned pre-slice bytes; Hub / manifest untouched.
 * Every rule has a mutation that must be caught.
 *
 * Usage: node scripts/verifyPhase121StepFillNoA24Wait.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';
import { revertD12170ValidatedAutofillEdits } from './lib/phase121D70ValidatedAutofillEdits.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const out = (line) => process.stdout.write(`${line}\n`);
for (const level of ['log', 'info', 'warn', 'error', 'debug']) console[level] = () => {};

let passed = 0;
function ok(label) {
  passed += 1;
  out(`  ✓ ${label}`);
}

/** A2.4 bound used by the fixtures (the product default is 5000 ms). */
const A24_TEST_BOUND_MS = 500;
/** Pre-slice validated-autofill.js (LF), as pinned by the D-121-52 verify. */
const VA_PRE_SLICE_SHA = '37b0358a387157d64137f17b757efb743654e3070f4e10994f94ece93e210275';

const TOP_ORIGIN = 'https://accounts.example.test';
const ENTRY_URL = `${TOP_ORIGIN}/signin`;
const CREDS = { username: 'nf-user-7h3w', password: 'nf-pass-Q2m-p55' };
const SECRETS = [CREDS.username, CREDS.password];

const STEP1_FORM =
  '<form id="id-form"><input id="user" type="email" name="identifier"><button id="next" type="button">Next</button></form>';
const PASS_FORM =
  '<form id="login-form"><input id="pass" type="password" name="p"><button id="login-btn" type="submit">Sign in</button></form>';
const page = (body) => `<!doctype html><html><head><title>Sign in</title></head><body><main>${body}</main></body></html>`;
const STEP1_HTML = page(STEP1_FORM);

function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}

function speedUp(src) {
  let s = src;
  s = replaceOnce(s, 'var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 25;', 'poll');
  s = replaceOnce(s, 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 10;', 'handshake');
  s = replaceOnce(s, 'const MANAGED_AUTOFILL_RETRY_DELAY_MS = 300;', 'const MANAGED_AUTOFILL_RETRY_DELAY_MS = 10;', 'retry');
  s = replaceOnce(s, 'const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 120000;', 'const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 300;', 'tab load');
  return s;
}

const PAGE_FILES = [
  'generic/managed-target-eligibility.js',
  'generic/form-detector.js',
  'generic/fill-executor.js',
  'generic/validated-autofill.js',
  'generic/locator-determinism.js',
  'generic/page-structure-inspect.js',
  'generic/frame-correlation.js',
];

function def(obj, key, value) {
  Object.defineProperty(obj, key, { value, configurable: true, writable: true, enumerable: false });
}

function isolatedWindow(html) {
  const { window: view, document } = parseHTML(html);
  const own = {};
  const win = new Proxy(own, {
    get(t, key) {
      if (Object.prototype.hasOwnProperty.call(t, key)) return t[key];
      if (key === 'window' || key === 'self') return win;
      if (key === 'document') return document;
      return view[key];
    },
    set(t, key, value) {
      t[key] = value;
      return true;
    },
    has(t, key) {
      return key in t || key in view;
    },
  });
  return win;
}

function makeWin(html, origin) {
  const window = isolatedWindow(html);
  def(window, 'location', { origin, protocol: 'https:', href: `${origin}/` });
  installManagedDomGeometry(window);
  const listeners = {};
  def(window, 'addEventListener', (type, fn) => {
    (listeners[type] ||= []).push(fn);
  });
  def(window, 'removeEventListener', (type, fn) => {
    listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
  });
  def(window, 'postMessage', (data) => {
    setTimeout(() => {
      for (const fn of (listeners.message || []).slice()) fn({ data, source: window.parent });
    }, 0);
  });
  def(window, 'crypto', globalThis.crypto);
  def(window, 'top', window);
  def(window, 'parent', window);
  if (typeof window.HTMLElement.prototype.click !== 'function') {
    window.HTMLElement.prototype.click = function click() {
      this.dispatchEvent(new window.Event('click', { bubbles: true }));
    };
  }
  return window;
}

function loadPageScript(win, rel, pageSrc) {
  const src = pageSrc[rel];
  assert(typeof src === 'string', `unknown page script ${rel}`);
  new Function('window', 'document', 'globalThis', 'Event', 'InputEvent', 'KeyboardEvent', `${src}\n//# sourceURL=${rel}`)(
    win,
    win.document,
    win,
    win.Event || globalThis.Event,
    win.InputEvent || win.Event || globalThis.Event,
    win.KeyboardEvent || win.Event || globalThis.Event,
  );
  if (rel === 'generic/validated-autofill.js' && win.__ManagedA24) win.__ManagedA24.setBoundMs(A24_TEST_BOUND_MS);
}

function runInPage(win, func, args) {
  const scope = new Proxy(
    {},
    {
      has(_t, key) {
        if (typeof key !== 'string') return false;
        if (key === 'window' || key === 'document' || key === 'location') return true;
        return Object.prototype.hasOwnProperty.call(win, key) && !(key in globalThis);
      },
      get(_t, key) {
        if (key === Symbol.unscopables) return undefined;
        if (key === 'window') return win;
        return win[key];
      },
      set(_t, key, value) {
        win[key] = value;
        return true;
      },
    },
  );
  return new Function('__scope', '__args', `with (__scope) { return (${String(func)}).apply(null, __args); }`)(scope, args);
}

// ---------------------------------------------------------------------------
// Tab simulator (mock chrome.* only), one top document.
// ---------------------------------------------------------------------------
class Sim {
  constructor(cfg, pageSrc) {
    this.cfg = cfg;
    this.pageSrc = pageSrc;
    this.fills = [];
    this.events = [];
    this.pageErrors = [];
    this.counters = { next: 0, submit: 0, loginBtn: 0 };
    this.clickAt = null;
    this.updatedListeners = new Set();
    this.tab = null;
    this.listener = null;
    this.top = makeWin(cfg.topHtml || STEP1_HTML, TOP_ORIGIN);
    this.wire(this.top);
    this.chrome = this.makeChrome();
  }

  wire(win) {
    for (const el of win.document.querySelectorAll('#next')) {
      el.addEventListener('click', () => {
        this.counters.next += 1;
        this.clickAt = Date.now();
        const user = win.document.querySelector('#user');
        this.events.push(`click:next(user=${user ? user.value : ''})`);
        if (this.cfg.onNext) this.cfg.onNext(this);
      });
    }
    const form = win.document.querySelector('#login-form');
    if (form) form.addEventListener('submit', () => (this.counters.submit += 1));
    const btn = win.document.querySelector('#login-btn');
    if (btn) btn.addEventListener('click', () => (this.counters.loginBtn += 1));
  }

  revealPassword() {
    const f = this.top.document.querySelector('#id-form');
    if (f) f.remove();
    const div = this.top.document.createElement('div');
    div.innerHTML = PASS_FORM;
    this.top.document.body.appendChild(div);
    this.wire(this.top);
  }

  makeChrome() {
    const sim = this;
    const runtime = {
      lastError: null,
      onMessageExternal: {
        addListener(fn) {
          sim.listener = fn;
        },
      },
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
          sim.tab = { id: 1, url: props.url, status: 'loading' };
          setTimeout(() => fire(null, cb, { id: 1, index: 0 }), 0);
          setTimeout(() => {
            sim.tab.status = 'complete';
            for (const fn of [...sim.updatedListeners]) fn(1, { status: 'complete' }, { ...sim.tab });
          }, 5);
        },
        get(id, cb) {
          setTimeout(() => {
            if (!sim.tab || id !== 1) fire('No tab with id: ' + id, cb, undefined);
            else fire(null, cb, { ...sim.tab });
          }, 0);
        },
        onUpdated: {
          addListener(fn) {
            sim.updatedListeners.add(fn);
          },
          removeListener(fn) {
            sim.updatedListeners.delete(fn);
          },
        },
        onRemoved: { addListener() {}, removeListener() {} },
      },
      scripting: {
        executeScript(details, cb) {
          sim.executeScript(details, (err, res) => fire(err, cb, res));
        },
      },
    };
  }

  executeScript(details, done) {
    const target = details.target || {};
    const ids = target.allFrames ? [0] : (target.frameIds || [0]).slice();
    setTimeout(async () => {
      if (ids.some((id) => id !== 0)) {
        done(`No frame with id ${ids.join(',')}`);
        return;
      }
      if (details.files) {
        try {
          for (const rel of details.files) loadPageScript(this.top, rel, this.pageSrc);
        } catch (err) {
          this.pageErrors.push(String((err && err.stack) || err));
        }
        done(null, [{ frameId: 0, result: undefined }]);
        return;
      }
      const opts = details.args && details.args[0];
      const isFill = Boolean(opts && typeof opts === 'object' && opts.credentials);
      const t0 = Date.now();
      if (isFill) this.events.push(`fill:${Object.keys(opts.credentials).sort().join(',')}`);
      let result;
      try {
        result = await runInPage(this.top, details.func, details.args || []);
      } catch (err) {
        this.pageErrors.push(String((err && err.stack) || err));
        result = undefined;
      }
      const copy = result === undefined ? undefined : JSON.parse(JSON.stringify(result));
      if (isFill) this.fills.push({ opts: JSON.parse(JSON.stringify(opts)), result: copy, t0, t1: Date.now() });
      done(null, [{ frameId: 0, result: copy }]);
    }, 0);
  }
}

function loadBackground(sim, bgSrc) {
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  const factory = new Function(
    'chrome',
    'console',
    `${speedUp(bgSrc)}\n;return { runManagedAutofillOnTab: runManagedAutofillOnTab };`,
  );
  return factory(sim.chrome, quiet);
}

function withDeadline(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: no response within ${ms}ms`)), ms);
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

function exitAction(actionId, locator, readiness) {
  return {
    actionId,
    kind: 'intermediate_transition',
    label: 'Next',
    locatorType: 'css',
    locator,
    approvedForRuntime: true,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: readiness, timeoutMs: 2000 },
  };
}

function multiPlan() {
  return {
    planVersion: 5,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }],
        exitTransition: exitAction('exit-1', '#next', '#pass'),
      },
      { stepId: 'step-2', fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass' }] },
    ],
  };
}

const SAME_PAGE = { name: 'NF-SAME-PAGE', plan: multiPlan(), onNext: (sim) => setTimeout(() => sim.revealPassword(), 20) };

async function runExt(ctx, cfg, diagnosticPath) {
  const sim = new Sim(cfg, ctx.pageSrc);
  loadBackground(sim, ctx.bgSrc);
  const message = {
    type: 'HUB_SPECIAL_LOGIN_FLOW',
    runId: 'nf-run-1',
    entryUrl: ENTRY_URL,
    allowedOrigin: TOP_ORIGIN,
    plan: JSON.parse(JSON.stringify(cfg.plan)),
    credentials: { ...CREDS },
    diagnosticPath,
  };
  const response = await withDeadline(
    new Promise((resolve) => {
      sim.listener(message, { tab: { id: 99, index: 2 } }, resolve);
    }),
    8000,
    cfg.name,
  );
  await sleep(20);
  return { sim, response };
}

const stagesOf = (result) => ((result && result.fillDiagnostics && result.fillDiagnostics.stamps) || []).map((s) => s.stage);
const hasA24 = (result) => stagesOf(result).some((s) => /^post_runtime_a24/.test(s));
const hasA23 = (result) => ['post_verify_microtask', 'post_verify_raf', 'post_verify_timeout_0'].every((s) => stagesOf(result).includes(s));

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
async function pageLevelChecks(ctx) {
  const run = async (path, flag) => {
    const win = makeWin(STEP1_HTML, TOP_ORIGIN);
    for (const rel of PAGE_FILES) loadPageScript(win, rel, ctx.pageSrc);
    const opts = {
      allowedOrigin: TOP_ORIGIN,
      fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }],
      credentials: { username: CREDS.username },
      diagnosticPath: path,
      ...(flag === undefined ? {} : { skipPostRuntimeObserve: flag }),
    };
    const t0 = Date.now();
    const result = await runInPage(win, (o) => runManagedAutofill(o), [opts]);
    return { result: JSON.parse(JSON.stringify(result)), ms: Date.now() - t0, value: win.document.querySelector('#user').value };
  };
  for (const path of ['admin_test', 'digital_home']) {
    const without = await run(path, undefined);
    const withFlag = await run(path, true);
    for (const r of [without, withFlag]) {
      assert(r.result.ok === true && r.result.filled === 1 && r.value === CREDS.username, `${path}: verified fill (${JSON.stringify({ ok: r.result.ok, reason: r.result.reason, filled: r.result.filled })})`);
    }
    const shape = (r) => ({ ok: r.ok, reason: r.reason ?? null, filled: r.filled, detail: r.detail ?? null, path: r.fillDiagnostics.path });
    assert(JSON.stringify(shape(without.result)) === JSON.stringify(shape(withFlag.result)), `${path}: ok / reason / filled identical with and without the flag`);
    assert(hasA24(without.result) && without.ms >= A24_TEST_BOUND_MS * 0.9, `${path} without the flag: A2.4 stamps + bound wait (${without.ms} ms)`);
    assert(!hasA24(withFlag.result) && withFlag.ms < A24_TEST_BOUND_MS / 2, `${path} with the flag: no post_runtime_a24* stamps, no bound wait (${withFlag.ms} ms)`);
    assert(hasA23(withFlag.result) && hasA23(without.result), `${path}: A2.3 post_verify_* stamps kept with the flag`);
    const nonA24 = (r) => stagesOf(r).filter((s) => !/^post_runtime_a24/.test(s));
    assert(JSON.stringify(nonA24(without.result)) === JSON.stringify(nonA24(withFlag.result)), `${path}: every non-A2.4 stamp identical`);
  }
  const falsy = await run('admin_test', 'yes');
  assert(hasA24(falsy.result), 'only skipPostRuntimeObserve === true skips A2.4');
  const other = await run('unknown', true);
  assert(!hasA24(other.result) && other.result.ok === true, 'non-diagnostic path: no A2.4 either way (unchanged)');
}

async function orchestratorChecks(ctx) {
  for (const path of ['admin_test', 'digital_home']) {
    const { sim, response } = await runExt(ctx, SAME_PAGE, path);
    const label = `${SAME_PAGE.name} (${path})`;
    assert(sim.pageErrors.length === 0, `${label}: page errors ${sim.pageErrors.join('\n')}`);
    assert(response.ok === true && response.state === 'STOPPED_FOR_USER' && response.filled === 2, `${label}: success (${JSON.stringify({ ok: response.ok, reason: response.reason, filled: response.filled })})`);
    assert(sim.fills.length === 2, `${label}: two step fills (${sim.fills.length})`);
    const [s1, s2] = sim.fills;
    assert(s1.opts.skipPostRuntimeObserve === true && s1.opts.fieldMappings[0].fieldId === 'username', `${label}: step 1 (has an exit) sends skipPostRuntimeObserve`);
    assert(!hasA24(s1.result) && hasA23(s1.result), `${label}: step 1 has no post_runtime_a24* stamps, A2.3 kept`);
    assert(sim.clickAt !== null && sim.clickAt - s1.t0 < A24_TEST_BOUND_MS / 2, `${label}: transition dispatched without the A2.4 bound (${sim.clickAt - s1.t0} ms after the fill started)`);
    assert(!('skipPostRuntimeObserve' in s2.opts) && s2.opts.fieldMappings[0].fieldId === 'password', `${label}: the last step sends no flag`);
    assert(hasA24(s2.result), `${label}: the last step keeps its A2.4 stamps`);
    const e = sim.events;
    const fill1 = e.indexOf('fill:username');
    const click = e.findIndex((x) => x.startsWith('click:next'));
    const fill2 = e.indexOf('fill:password');
    assert(fill1 >= 0 && click > fill1 && fill2 > click && e[click] === `click:next(user=${CREDS.username})`, `${label}: R-2 order fill → click (value present) → fill: ${e.map((x) => x.replace(/user=.*\)/, 'user=…)')).join(' | ')}`);
    assert(sim.counters.next === 1 && sim.counters.submit === 0 && sim.counters.loginBtn === 0, `${label}: one transition click, never submits`);
  }
}

async function standardChecks(ctx) {
  const sim = new Sim({ name: 'NF-STANDARD' }, ctx.pageSrc);
  const api = loadBackground(sim, ctx.bgSrc);
  const result = await withDeadline(
    new Promise((resolve) =>
      api.runManagedAutofillOnTab(
        1,
        {
          allowedOrigin: TOP_ORIGIN,
          fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }],
          credentials: { username: CREDS.username },
          diagnosticPath: 'admin_test',
        },
        0,
        resolve,
      ),
    ),
    8000,
    'STANDARD',
  );
  assert(result && result.ok === true, `STANDARD fill ok (${JSON.stringify(result && { ok: result.ok, reason: result.reason })})`);
  assert(sim.fills.length === 1 && !('skipPostRuntimeObserve' in sim.fills[0].opts), 'STANDARD runManagedAutofillOnTab never sends the flag');
  assert(hasA24(sim.fills[0].result), 'STANDARD keeps its A2.4 stamps');
}

function listSrc() {
  const outList = [];
  const rec = (absDir, rel) => {
    for (const name of readdirSync(absDir)) {
      const p = join(absDir, name);
      const r = `${rel}/${name}`;
      if (statSync(p).isDirectory()) rec(p, r);
      else if (/\.(ts|tsx)$/.test(name)) outList.push(r);
    }
  };
  rec(join(root, 'src'), 'src');
  return outList;
}

/** Reads the files on disk, so mutations are caught by behavior only. */
function staticChecks() {
  const bg = read('extension/background.js');
  assert(bg.split('skipPostRuntimeObserve').length - 1 === 1, 'background.js: one flag site');
  const flowStart = bg.indexOf('function runSpecialLoginFlow(');
  const flowEnd = bg.indexOf('\n}\n', flowStart);
  const at = bg.indexOf('skipPostRuntimeObserve');
  assert(flowStart > 0 && at > flowStart && at < flowEnd, 'the flag is sent only from runSpecialLoginFlow');
  assert(bg.includes('          if (step.exit) runOptions.skipPostRuntimeObserve = true;\n'), 'the flag is guarded by the step exit');
  const va = read('extension/generic/validated-autofill.js');
  assert(sha(revertD12170ValidatedAutofillEdits(va)) === VA_PRE_SLICE_SHA, 'validated-autofill.js: only the recorded D-121-70 edit (A2.4 code itself untouched)');
  for (const rel of listSrc()) {
    assert(!read(rel).includes('skipPostRuntimeObserve'), `${rel}: the Hub never sends the flag`);
  }
  assert(execSync('git diff HEAD -- extension/manifest.json', { cwd: root }).toString() === '', 'manifest / permissions unchanged');
  const edit = bg.slice(at - 200, at + 80) + va.slice(va.indexOf('D-121-70'), va.indexOf('D-121-70') + 300);
  assert(!/hostname|serviceId|\.co\.il|\.com\b/.test(edit), 'no site / hostname / serviceId branches');
}

async function runAll(ctx) {
  await pageLevelChecks(ctx);
  await orchestratorChecks(ctx);
  await standardChecks(ctx);
}

function baseCtx() {
  return {
    bgSrc: read('extension/background.js'),
    pageSrc: Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(`extension/${rel}`)])),
  };
}

out('Phase 121 D-121-70 — no post-fill observation window before a step transition\n');
const ctx0 = baseCtx();
await pageLevelChecks(ctx0);
ok('page level: outcome + non-A2.4 stamps identical with / without the flag; the flag drops only post_runtime_a24* and the bound wait; A2.3 kept');
await orchestratorChecks(ctx0);
ok('orchestrator (MULTI_STEP, admin_test + digital_home): step 1 flag → no A2.4, click before the bound; last step no flag → A2.4 stamps; R-2 order');
await standardChecks(ctx0);
ok('STANDARD runManagedAutofillOnTab: no flag, A2.4 stamps present');
staticChecks();
ok('static: one flag site (runSpecialLoginFlow, exit-guarded); validated-autofill revert = pre-slice bytes; Hub / manifest untouched; no site branches');

async function expectCaught(label, mutate) {
  const ctx = baseCtx();
  mutate(ctx);
  let caught = null;
  try {
    await runAll(ctx);
  } catch (err) {
    caught = String((err && err.message) || err).split('\n')[0];
  }
  assert(caught, `MUTATION NOT CAUGHT: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  ok(`mutation caught: ${label}  [${caught.slice(0, 110)}]`);
}
const VA = 'generic/validated-autofill.js';
const vaMut = (from, to) => (ctx) => {
  ctx.pageSrc[VA] = replaceOnce(ctx.pageSrc[VA], from, to, from.slice(0, 40));
};
const bgMut = (from, to) => (ctx) => {
  ctx.bgSrc = replaceOnce(ctx.bgSrc, from, to, from.slice(0, 40));
};

await expectCaught('N1 flag ignored (the bound waits again)', vaMut('    var skipA24 = Boolean(options && options.skipPostRuntimeObserve === true);', '    var skipA24 = false;'));
await expectCaught('N2 flag also skips A2.3', vaMut('    return observePostVerifyAsync(bag, filledTrail, outcome).then(function () {\n      var runA24 =', '    return (skipA24 ? Promise.resolve() : observePostVerifyAsync(bag, filledTrail, outcome)).then(function () {\n      var runA24 ='));
await expectCaught('N3 flag also sent on the last step (A2.4 stamps missing)', bgMut('          if (step.exit) runOptions.skipPostRuntimeObserve = true;', '          runOptions.skipPostRuntimeObserve = true;'));
await expectCaught('N4 flag never sent (intermediate step waits)', bgMut('          if (step.exit) runOptions.skipPostRuntimeObserve = true;\n', ''));
await expectCaught('N5 flag sent from the STANDARD path', bgMut('              credentials: payload.credentials,\n              diagnosticPath:\n', '              credentials: payload.credentials,\n              skipPostRuntimeObserve: true,\n              diagnosticPath:\n'));

out(`\nPASS — Phase 121 D-121-70 step fill without the A2.4 wait (4 check groups, ${passed - 4} mutations caught)`);
process.exit(0);
