/**
 * Phase 121.3 — MULTI_STEP execution (R-1, R-2, R-3, R-4, R-6, R-7; R-5 removed).
 *
 * Fixtures run the REAL extension/background.js orchestrator (router →
 * runSpecialLoginFlow) against the REAL page scripts injected into linkedom windows
 * (mock chrome.tabs / chrome.scripting only): same-page split, navigation split, step in
 * a depth-1 frame, navigation into a framed step, cross-origin transition, missing /
 * ambiguous transition, readiness timeout, R1 before fill. Hub gate ≡ Ext gate parity,
 * union credential subset, «המילוי נעצר בשלב N», fill-test route, «אשר מיפוי» guard.
 * Every rule has a mutation that must be caught.
 *
 * Usage: node scripts/verifyPhase121MultiStepRuntime.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const abs = (rel) => `./${rel}`;
const sha = (text) => createHash('sha256').update(text).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const LOGS = [];
const out = (line) => process.stdout.write(`${line}\n`);
function fmtLog(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...args) => {
    LOGS.push(fmtLog(args));
  };
}

let passed = 0;
function ok(label) {
  passed += 1;
  out(`  ✓ ${label}`);
}

const TOP_ORIGIN = 'https://accounts.example.test';
const FRAME_ORIGIN = 'https://auth-frame.example.test';
const OTHER_ORIGIN = 'https://elsewhere.example.test';
const ENTRY_URL = `${TOP_ORIGIN}/signin`;
const FRAME_LOCATOR = 'iframe#pwd-frame';
const CROSS_FRAME = { frameLocator: FRAME_LOCATOR, frameOrigin: FRAME_ORIGIN };
const CREDS = { username: 'ms-user-4k2q', password: 'ms-pass-Z8v-x91' };
const SECRETS = [CREDS.username, CREDS.password];

const STEP1_FORM =
  '<form id="id-form"><input id="user" type="email" name="identifier"><button id="next" type="button">Next</button></form>';
const PASS_FORM =
  '<form id="login-form"><input id="pass" type="password" name="p"><button id="login-btn" type="submit">Sign in</button></form>';
const page = (body) => `<!doctype html><html><head><title>Sign in</title></head><body><main>${body}</main></body></html>`;
const STEP1_HTML = page(STEP1_FORM);
const PASS_HTML = page(PASS_FORM);

// ---------------------------------------------------------------------------
// Sources + sandbox speed-ups
// ---------------------------------------------------------------------------
function replaceOnce(src, from, to, label) {
  assert(src.includes(from), `patch target missing: ${label}`);
  assert(src.split(from).length === 2, `patch target not unique: ${label}`);
  return src.replace(from, to);
}

const BG_SRC = read('extension/background.js');
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
const PAGE_SRC = Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(`extension/${rel}`)]));
const compiledPage = new Map();

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
  def(window, '__pvListeners', listeners);
  def(window, 'postMessage', (data) => {
    setTimeout(() => {
      for (const fn of (listeners.message || []).slice()) fn({ data, source: window.parent });
    }, 0);
  });
  def(window, 'crypto', globalThis.crypto);
  if (typeof window.HTMLElement.prototype.click !== 'function') {
    window.HTMLElement.prototype.click = function click() {
      this.dispatchEvent(new window.Event('click', { bubbles: true }));
    };
  }
  return window;
}

function loadPageScript(win, rel) {
  const src = PAGE_SRC[rel];
  assert(typeof src === 'string', `unknown page script ${rel}`);
  const key = `${rel}\n${sha(src)}`;
  let fn = compiledPage.get(key);
  if (!fn) {
    fn = new Function('window', 'document', 'globalThis', 'Event', 'InputEvent', 'KeyboardEvent', `${src}\n//# sourceURL=${rel}`);
    compiledPage.set(key, fn);
  }
  fn(
    win,
    win.document,
    win,
    win.Event || globalThis.Event,
    win.InputEvent || win.Event || globalThis.Event,
    win.KeyboardEvent || win.Event || globalThis.Event,
  );
  if (rel === 'generic/validated-autofill.js' && win.__ManagedA24) win.__ManagedA24.setBoundMs(20);
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
// Tab simulator (mock chrome.* only). Top navigation replaces frame 0; while a
// navigation is in flight every injection into the tab fails (as in Chrome).
// ---------------------------------------------------------------------------
class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.frames = new Map();
    this.nextId = 11;
    this.calls = [];
    this.events = [];
    this.tabCreates = [];
    this.pageErrors = [];
    this.counters = { next: 0, submit: 0, loginBtn: 0, formSubmitCall: 0 };
    this.updatedListeners = new Set();
    this.tab = null;
    this.topNavigating = false;
    this.readinessHookFired = false;
    this.listener = null;
    this.setTop(makeWin(cfg.topHtml || STEP1_HTML, TOP_ORIGIN));
    this.chrome = this.makeChrome();
  }

  setTop(win) {
    def(win, 'top', win);
    def(win, 'parent', win);
    this.top = win;
    for (const id of [...this.frames.keys()]) this.frames.delete(id);
    this.frames.set(0, { id: 0, parentId: null, win });
    this.wire(win);
  }

  wire(win) {
    for (const el of win.document.querySelectorAll('#next, .next')) {
      el.addEventListener('click', () => {
        this.counters.next += 1;
        const user = win.document.querySelector('#user');
        this.events.push(`click:next(user=${user ? user.value : ''})`);
        if (this.cfg.onNext) this.cfg.onNext(this);
      });
    }
    const form = win.document.querySelector('#login-form');
    const btn = win.document.querySelector('#login-btn');
    if (form) {
      form.addEventListener('submit', () => (this.counters.submit += 1));
      form.submit = () => (this.counters.formSubmitCall += 1);
      form.requestSubmit = () => (this.counters.formSubmitCall += 1);
    }
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

  addFrame(html, origin) {
    const el = this.top.document.createElement('iframe');
    el.setAttribute('id', 'pwd-frame');
    this.top.document.body.appendChild(el);
    const id = this.nextId++;
    const w = makeWin(html, origin);
    def(w, 'parent', this.top);
    def(w, 'top', this.top);
    const rec = { id, parentId: 0, el, win: w };
    this.frames.set(id, rec);
    Object.defineProperty(el, 'contentWindow', { get: () => rec.win, configurable: true });
    this.wire(w);
    return rec;
  }

  navigateTop(html, origin, url, gapMs, after) {
    this.topNavigating = true;
    setTimeout(() => {
      this.setTop(makeWin(html, origin));
      this.tab.url = url;
      this.topNavigating = false;
      if (after) after(this);
    }, gapMs);
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
          sim.tabCreates.push({ ...props });
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
    const ids = target.allFrames ? [...this.frames.keys()] : (target.frameIds || [0]).slice();
    setTimeout(async () => {
      if (this.topNavigating) {
        done('Frame with ID 0 is navigating');
        return;
      }
      if (!target.allFrames && ids.some((id) => !this.frames.has(id))) {
        done(`No frame with id ${ids.join(',')}`);
        return;
      }
      const argsJson = JSON.stringify(details.args || []);
      this.calls.push({ ids: ids.slice(), files: details.files ? details.files.slice() : null, argsJson });
      const opts = details.args && details.args[0];
      if (opts && typeof opts === 'object' && opts.credentials) {
        this.events.push(`fill:${Object.keys(opts.credentials).sort().join(',')}@${ids.join(',')}`);
      }
      if (details.files) {
        try {
          for (const id of ids) for (const rel of details.files) loadPageScript(this.frames.get(id).win, rel);
        } catch (err) {
          this.pageErrors.push(String((err && err.stack) || err));
        }
        done(null, ids.map((id) => ({ frameId: id, result: undefined })));
        return;
      }
      const results = [];
      for (const id of ids) {
        const rec = this.frames.get(id);
        if (!rec) continue;
        let result;
        try {
          result = await runInPage(rec.win, details.func, details.args || []);
        } catch (err) {
          this.pageErrors.push(String((err && err.stack) || err));
          result = undefined;
        }
        results.push({ frameId: id, result: result === undefined ? undefined : JSON.parse(JSON.stringify(result)) });
      }
      if (
        !this.readinessHookFired &&
        String(details.func).includes('isSpecialDeclaredReadinessMet') &&
        results.some((r) => r.result && r.result.met === true)
      ) {
        this.readinessHookFired = true;
        if (this.cfg.afterReadinessMet) this.cfg.afterReadinessMet(this);
      }
      done(null, results);
    }, 0);
  }

  credentialCalls() {
    return this.calls
      .filter((c) => SECRETS.some((s) => c.argsJson.includes(s)))
      .map((c) => ({ ids: c.ids, opts: JSON.parse(c.argsJson)[0] }));
  }
}

function loadBackground(sim, bgSrc) {
  const bgConsole = {
    log: (...a) => LOGS.push(fmtLog(a)),
    info: (...a) => LOGS.push(fmtLog(a)),
    warn: (...a) => LOGS.push(fmtLog(a)),
    error: (...a) => LOGS.push(fmtLog(a)),
  };
  const factory = new Function('chrome', 'console', `${speedUp(bgSrc)}\n;return { specialValidateRunPlan: specialValidateRunPlan };`);
  return factory(sim.chrome, bgConsole);
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

async function runExt(cfg, bgSrc = BG_SRC, overrides = {}) {
  const sim = new Sim(cfg);
  const api = loadBackground(sim, bgSrc);
  let listenerReturn;
  const message = {
    type: 'HUB_SPECIAL_LOGIN_FLOW',
    runId: 'ms-run-1',
    entryUrl: ENTRY_URL,
    allowedOrigin: TOP_ORIGIN,
    plan: JSON.parse(JSON.stringify(cfg.plan)),
    credentials: { ...CREDS },
    diagnosticPath: 'admin_test',
    ...overrides,
  };
  const response = await withDeadline(
    new Promise((resolve) => {
      listenerReturn = sim.listener(message, { tab: { id: 99, index: 2 } }, resolve);
    }),
    8000,
    cfg.name,
  );
  await sleep(40);
  return { sim, response, listenerReturn, api };
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
function frameOf(frame) {
  return frame ? { frame: { ...frame } } : {};
}

function exitAction(actionId, { locator = '#next', readiness = '#pass', timeoutMs = 2000, readinessFrame = null, frame = null } = {}) {
  return {
    actionId,
    kind: 'intermediate_transition',
    label: 'Next',
    locatorType: 'css',
    locator,
    approvedForRuntime: true,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: readiness, timeoutMs, ...frameOf(readinessFrame) },
    ...frameOf(frame),
  };
}

function multiPlan({ timeoutMs = 2000, step2Frame = null, exitLocator = '#next' } = {}) {
  return {
    planVersion: 5,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }],
        exitTransition: exitAction('exit-1', { locator: exitLocator, timeoutMs, readinessFrame: step2Frame }),
      },
      {
        stepId: 'step-2',
        fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass', ...frameOf(step2Frame) }],
      },
    ],
  };
}

function fourStepPlan() {
  const ids = ['username', 'tenant', 'otp', 'password'];
  const loc = ['#a', '#b', '#c', '#d'];
  return {
    planVersion: 2,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: ids.map((fieldId, i) => ({
      stepId: `step-${i + 1}`,
      fieldMappings: [{ fieldId, locatorType: 'css', locator: loc[i] }],
      ...(i < 3 ? { exitTransition: exitAction(`exit-${i + 1}`, { locator: `#next-${i + 1}`, readiness: loc[i + 1] }) } : {}),
    })),
  };
}

function floatingMultiPlan() {
  const plan = multiPlan();
  plan.pattern = 'FLOATING_SCREEN_MULTI_STEP';
  plan.preambleActions = [
    {
      actionId: 'opener-1',
      kind: 'floating_opener',
      label: 'Open',
      locatorType: 'css',
      locator: '#open-login',
      approvedForRuntime: true,
      readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 2000 },
    },
  ];
  return plan;
}

function floatingPlan() {
  return {
    planVersion: 3,
    pattern: 'FLOATING_SCREEN',
    preambleActions: floatingMultiPlan().preambleActions,
    steps: [
      {
        stepId: 'step-credentials',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/** [label, plan, extReason (null = runnable), hubReason (undefined = any failure)]. */
function gateCases() {
  const fiveSteps = fourStepPlan();
  fiveSteps.steps[3].exitTransition = exitAction('exit-4', { locator: '#next-4', readiness: '#e' });
  fiveSteps.steps.push({ stepId: 'step-5', fieldMappings: [{ fieldId: 'pin', locatorType: 'css', locator: '#e' }] });
  const oneStep = multiPlan();
  oneStep.steps = [{ stepId: 'step-1', fieldMappings: oneStep.steps[0].fieldMappings }];
  const preamble = multiPlan();
  preamble.preambleActions = floatingMultiPlan().preambleActions;
  const lastExit = multiPlan();
  lastExit.steps[1].exitTransition = exitAction('exit-2', { locator: '#done', readiness: '#pass' });
  const middleNoExit = fourStepPlan();
  delete middleNoExit.steps[1].exitTransition;
  const notApproved = multiPlan();
  notApproved.steps[0].exitTransition.approvedForRuntime = false;
  const wrongKind = multiPlan();
  wrongKind.steps[0].exitTransition.kind = 'floating_opener';
  const ownStep = multiPlan();
  ownStep.steps[1].fieldMappings.push({ fieldId: 'confirm', locatorType: 'css', locator: '#user' });
  ownStep.steps[0].exitTransition.readiness.locator = '#user';
  const self = multiPlan();
  self.steps[0].exitTransition.locator = '#pass';
  const pending = multiPlan();
  pending.steps[0].exitTransition.readiness.locator = '[data-pv-pending-reveal]';
  const dupField = multiPlan();
  dupField.steps[1].fieldMappings[0].fieldId = 'username';
  const mixed = multiPlan({ step2Frame: CROSS_FRAME });
  mixed.steps[1].fieldMappings.push({ fieldId: 'remember', locatorType: 'css', locator: '#remember' });
  const httpExitFrame = multiPlan();
  httpExitFrame.steps[0].exitTransition.frame = { frameLocator: FRAME_LOCATOR, frameOrigin: 'http://auth-frame.example.test' };
  const reserved = multiPlan();
  reserved.steps[0].exitTransition.kind = 'final_submit';
  const timeout0 = multiPlan();
  timeout0.steps[0].exitTransition.readiness.timeoutMs = 0;
  const cssless = multiPlan();
  cssless.steps[1].fieldMappings[0].locatorType = 'xpath';
  return [
    ['valid 2 steps (top)', multiPlan(), null],
    ['valid step 2 in a depth-1 frame (frames differ between steps)', multiPlan({ step2Frame: CROSS_FRAME }), null],
    ['valid 4 steps', fourStepPlan(), null],
    ['5 steps', fiveSteps, 'plan_shape_unsupported', 'plan_shape_unsupported'],
    ['1 step', oneStep, 'plan_shape_unsupported', 'plan_shape_unsupported'],
    ['preamble opener', preamble, 'plan_shape_unsupported', 'plan_shape_unsupported'],
    ['last step has an exit', lastExit, 'plan_shape_unsupported'],
    ['middle step without exit', middleNoExit, 'plan_shape_unsupported', 'plan_shape_unsupported'],
    ['exit not approvedForRuntime', notApproved, 'plan_shape_unsupported'],
    ['exit kind floating_opener', wrongKind, 'plan_shape_unsupported', 'plan_shape_unsupported'],
    ['readiness is a field of its own step', ownStep, 'readiness_invalid', 'readiness_invalid'],
    ['readiness is the transition itself', self, 'readiness_invalid', 'readiness_invalid'],
    ['pending-reveal readiness', pending, 'readiness_invalid', 'readiness_invalid'],
    // D-121-63 C: a repeated fieldId across steps is allowed (was plan_shape_unsupported in 121.3).
    ['fieldId in two steps', dupField, null],
    ['mixed frames in one step', mixed, 'frame_invalid', 'frame_invalid'],
    ['http exit frame', httpExitFrame, 'frame_invalid', 'frame_invalid'],
    ['reserved final_submit exit', reserved, 'reserved_action_kind', 'reserved_action_kind'],
    ['readiness timeout 0', timeout0, 'readiness_invalid', 'readiness_invalid'],
    ['non-css mapping', cssless, 'plan_shape_unsupported'],
    ['FLOATING_SCREEN_MULTI_STEP', floatingMultiPlan(), 'pattern_not_supported_yet', 'pattern_not_supported_yet'],
    ['FLOATING_SCREEN (121.2 parity)', floatingPlan(), null],
  ];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FIX = {
  SAME_PAGE: { name: 'MS-F-SAME-PAGE', plan: multiPlan(), onNext: (sim) => setTimeout(() => sim.revealPassword(), 40) },
  NAVIGATION: {
    name: 'MS-F-NAVIGATION',
    plan: multiPlan(),
    onNext: (sim) => sim.navigateTop(PASS_HTML, TOP_ORIGIN, `${TOP_ORIGIN}/challenge/pwd`, 120),
  },
  FRAME_STEP: {
    name: 'MS-F-FRAME-STEP',
    plan: multiPlan({ step2Frame: CROSS_FRAME }),
    onNext: (sim) =>
      setTimeout(() => {
        sim.top.document.querySelector('#id-form').remove();
        sim.addFrame(PASS_HTML, FRAME_ORIGIN);
      }, 40),
  },
  NAVIGATION_FRAME: {
    name: 'MS-F-NAVIGATION-FRAME',
    plan: multiPlan({ step2Frame: CROSS_FRAME }),
    onNext: (sim) =>
      sim.navigateTop(page('<p>Loading…</p>'), TOP_ORIGIN, `${TOP_ORIGIN}/challenge/pwd`, 150, (s) =>
        setTimeout(() => s.addFrame(PASS_HTML, FRAME_ORIGIN), 60),
      ),
  },
  CROSS_ORIGIN: {
    name: 'MS-F-CROSS-ORIGIN',
    plan: multiPlan({ timeoutMs: 600 }),
    onNext: (sim) => sim.navigateTop(PASS_HTML, OTHER_ORIGIN, `${OTHER_ORIGIN}/pwd`, 30),
  },
  MISSING: { name: 'MS-F-TRANSITION-MISSING', plan: multiPlan({ timeoutMs: 250 }), topHtml: page('<form id="id-form"><input id="user" type="email"></form>') },
  AMBIGUOUS: {
    name: 'MS-F-TRANSITION-AMBIGUOUS',
    plan: multiPlan({ timeoutMs: 250, exitLocator: '.next' }),
    topHtml: page(
      '<form id="id-form"><input id="user" type="email"><button class="next" type="button">A</button><button class="next" type="button">B</button></form>',
    ),
  },
  READINESS_TIMEOUT: { name: 'MS-F-READINESS-TIMEOUT', plan: multiPlan({ timeoutMs: 250 }) },
  R1_BEFORE_FILL: {
    name: 'MS-F-R1-BEFORE-FILL',
    plan: multiPlan(),
    onNext: (sim) => setTimeout(() => sim.revealPassword(), 40),
    afterReadinessMet: (sim) => {
      sim.tab.url = `${OTHER_ORIGIN}/hijack`;
    },
  },
};

function assertNoSubmit(sim, label) {
  const c = sim.counters;
  assert(c.submit === 0 && c.loginBtn === 0 && c.formSubmitCall === 0, `${label}: never submits (${JSON.stringify(c)})`);
}

function assertNoPageErrors(sim, label) {
  assert(sim.pageErrors.length === 0, `${label}: page script errors:\n${sim.pageErrors.join('\n')}`);
}

/** R-4: every credential call carries exactly one step's subset. */
function assertStepSubsets(sim, label) {
  for (const c of sim.credentialCalls()) {
    const keys = Object.keys(c.opts.credentials).sort().join(',');
    assert(keys === 'username' || keys === 'password', `${label}: a page injection received ${keys} (must be one step's subset)`);
    const fieldIds = c.opts.fieldMappings.map((m) => m.fieldId).sort().join(',');
    assert(fieldIds === keys, `${label}: mappings ${fieldIds} ≠ credentials ${keys}`);
  }
}

function assertSuccess(res, label) {
  const r = res.response;
  assert(r.ok === true && r.state === 'STOPPED_FOR_USER', `${label}: STOPPED_FOR_USER (${JSON.stringify(r)})`);
  assert(r.stage === 'fill' && r.stepId === 'step-2' && r.actionId === 'exit-1', `${label}: ends at step-2 via exit-1 (${r.stepId}/${r.actionId})`);
  assert(r.filled === 2, `${label}: filled 2 across steps (got ${r.filled})`);
  assert(res.listenerReturn === true, `${label}: async router`);
}

/** R-2: the transition is clicked only after step 1 was filled + verified. */
function assertOrder(sim, label, passFrameId = 0) {
  const e = sim.events;
  const fill1 = e.findIndex((x) => x.startsWith('fill:username@0'));
  const click = e.findIndex((x) => x.startsWith('click:next'));
  const fill2 = e.findIndex((x) => x.startsWith(`fill:password@${passFrameId}`));
  assert(fill1 >= 0 && click > fill1 && fill2 > click, `${label}: order fill(step 1) → click → fill(step 2): ${e.join(' | ')}`);
  assert(e[click] === `click:next(user=${CREDS.username})`, `${label}: step 1 value present when the transition was clicked`);
  assert(sim.counters.next === 1, `${label}: transition clicked exactly once`);
}

async function fixtureSamePage(bgSrc) {
  const res = await runExt(FIX.SAME_PAGE, bgSrc);
  const label = FIX.SAME_PAGE.name;
  assertNoPageErrors(res.sim, label);
  assertSuccess(res, label);
  assertOrder(res.sim, label);
  assertStepSubsets(res.sim, label);
  assert(res.sim.top.document.querySelector('#pass').value === CREDS.password, `${label}: password filled`);
  assert(res.response.userGestureDuringRun === false, `${label}: gesture evidence false`);
  assertNoSubmit(res.sim, label);
  return res;
}

async function fixtureNavigation(bgSrc) {
  const res = await runExt(FIX.NAVIGATION, bgSrc);
  const label = FIX.NAVIGATION.name;
  assertNoPageErrors(res.sim, label);
  assertSuccess(res, label);
  assertOrder(res.sim, label);
  assertStepSubsets(res.sim, label);
  assert(res.sim.top.document.querySelector('#pass').value === CREDS.password, `${label}: password filled in the new document`);
  assertNoSubmit(res.sim, label);
  return res;
}

async function fixtureFrameStep(fix, bgSrc) {
  const res = await runExt(fix, bgSrc);
  const label = fix.name;
  assertNoPageErrors(res.sim, label);
  assertSuccess(res, label);
  const frame = [...res.sim.frames.values()].find((r) => r.id !== 0);
  assertOrder(res.sim, label, frame.id);
  assertStepSubsets(res.sim, label);
  const pwdCall = res.sim.credentialCalls().find((c) => c.opts.credentials.password);
  assert(pwdCall.ids.length === 1 && pwdCall.ids[0] === frame.id, `${label}: password only into the declared frame`);
  assert(pwdCall.opts.allowedOrigin === FRAME_ORIGIN && pwdCall.opts.frameContext?.mode === 'declared_depth1', `${label}: frame runner options`);
  const userCall = res.sim.credentialCalls().find((c) => c.opts.credentials.username);
  assert(userCall.ids[0] === 0 && !('frameContext' in userCall.opts), `${label}: step 1 in top without frameContext`);
  assert(frame.win.document.querySelector('#pass').value === CREDS.password, `${label}: password filled in frame`);
  assertNoSubmit(res.sim, label);
  return res;
}

async function fixtureCrossOrigin(bgSrc) {
  const res = await runExt(FIX.CROSS_ORIGIN, bgSrc);
  const r = res.response;
  const label = FIX.CROSS_ORIGIN.name;
  assert(r.ok === false && r.reason === 'origin_mismatch', `${label}: origin_mismatch (got ${r.stage}/${r.reason})`);
  assert(r.stepId === 'step-2' && r.actionId === 'exit-1', `${label}: step-2 / exit-1 named`);
  assert(!res.sim.credentialCalls().some((c) => c.opts.credentials.password), `${label}: password never sent`);
  assert(res.sim.top.document.querySelector('#pass').value === '', `${label}: foreign document untouched`);
  return res;
}

async function fixtureMissing(bgSrc) {
  const res = await runExt(FIX.MISSING, bgSrc);
  const r = res.response;
  const label = FIX.MISSING.name;
  assert(r.ok === false && r.stage === 'transition' && r.reason === 'transition_missing', `${label}: transition/transition_missing (got ${r.stage}/${r.reason})`);
  assert(r.stepId === 'step-1' && r.actionId === 'exit-1' && r.locator === '#next', `${label}: step-1 / exit-1 / locator`);
  assert(res.sim.top.document.querySelector('#user').value === CREDS.username, `${label}: step 1 filled before the transition`);
  assert(!res.sim.credentialCalls().some((c) => c.opts.credentials.password), `${label}: step 2 values never sent`);
  return res;
}

async function fixtureAmbiguous(bgSrc) {
  const res = await runExt(FIX.AMBIGUOUS, bgSrc);
  const r = res.response;
  const label = FIX.AMBIGUOUS.name;
  assert(r.ok === false && r.stage === 'transition' && r.reason === 'transition_ambiguous', `${label}: transition_ambiguous (got ${r.stage}/${r.reason})`);
  assert(res.sim.counters.next === 0, `${label}: nothing clicked on ambiguity`);
  assert(r.stepId === 'step-1' && r.actionId === 'exit-1', `${label}: step-1 / exit-1`);
  return res;
}

async function fixtureReadinessTimeout(bgSrc) {
  const res = await runExt(FIX.READINESS_TIMEOUT, bgSrc);
  const r = res.response;
  const label = FIX.READINESS_TIMEOUT.name;
  assert(r.ok === false && r.stage === 'readiness' && r.reason === 'readiness_timeout', `${label}: readiness_timeout (got ${r.stage}/${r.reason})`);
  assert(r.stepId === 'step-2' && r.actionId === 'exit-1' && r.locator === '#pass' && r.frameKey === 'top', `${label}: step-2 / exit-1 / locator / frameKey`);
  assert(res.sim.counters.next === 1 && !res.sim.credentialCalls().some((c) => c.opts.credentials.password), `${label}: clicked once, no step 2 values`);
  return res;
}

async function fixtureR1BeforeFill(bgSrc) {
  const res = await runExt(FIX.R1_BEFORE_FILL, bgSrc);
  const r = res.response;
  const label = FIX.R1_BEFORE_FILL.name;
  assert(r.ok === false && r.stage === 'r1' && r.reason === 'origin_mismatch', `${label}: r1 origin_mismatch before the step-2 fill (got ${r.stage}/${r.reason})`);
  assert(r.stepId === 'step-2', `${label}: step-2 named`);
  assert(!res.sim.credentialCalls().some((c) => c.opts.credentials.password), `${label}: password never sent`);
  return res;
}

// ---------------------------------------------------------------------------
// Hub bundles
// ---------------------------------------------------------------------------
const BRIDGE_STUB = `
export const isExtensionAvailable = () => true;
export const openUrlInNewTab = (url) => { globalThis.__bridge.opens.push(url); };
export const sendExtensionMessageAsync = (message) => globalThis.__bridge.send(message);
export const sendExtensionMessage = (message, cb) => { if (cb) cb(null); };
export const getChromeRuntime = () => null;
export const getExtensionId = () => 'test-ext';
export const probeExtensionAvailable = async () => true;
`;
const HUB_STUBS = [
  [/(^|\/)extensionBridge$/, BRIDGE_STUB],
  [/(^|\/)browserIntegration$/, `export * from '${abs('src/browserIntegration/index.ts')}';\n${BRIDGE_STUB}`],
];

const bundle = (entry, name, opts) => withTempDir(`pv-1213ms-${name}-`, (outdir) => bundleIn(outdir, entry, name, opts));
async function bundleIn(outdir, entry, name, { stubs = HUB_STUBS, transforms = [] } = {}) {
  const outfile = join(outdir, `${name}.mjs`);
  const applied = new Set();
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
    logLevel: 'silent',
    jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [
      {
        name: 'pv-ms-stubs',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            const idx = stubs.findIndex(([re]) => re.test(args.path));
            if (idx < 0) return undefined;
            return { path: `stub-${idx}`, namespace: 'pv-stub' };
          });
          b.onLoad({ filter: /.*/, namespace: 'pv-stub' }, (args) => ({
            contents: stubs[Number(args.path.slice(5))][1],
            loader: 'ts',
            resolveDir: root,
          }));
          b.onLoad({ filter: /\.tsx?$/ }, (args) => {
            const p = args.path.replace(/\\/g, '/');
            const mine = transforms.filter(([suffix]) => p.endsWith(suffix));
            if (mine.length === 0) return undefined;
            let text = readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
            for (const [suffix, from, to] of mine) {
              assert(text.includes(from), `transform target missing in ${suffix}: ${from.slice(0, 70)}`);
              text = text.replace(from, to);
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
}

function resetHub(send) {
  const sends = [];
  globalThis.__bridge = {
    opens: [],
    sends,
    send: async (message) => {
      sends.push(JSON.parse(JSON.stringify(message)));
      return send ? send(message) : null;
    },
  };
  return globalThis.__bridge;
}

const OK_EXT = () => ({ ok: true, state: 'STOPPED_FOR_USER', stage: 'fill', tabOpened: true, filled: 2, userGestureDuringRun: false });

async function hubRun(hub, plan, credentials = CREDS, respond = OK_EXT) {
  const bridge = resetHub(respond);
  const outcome = await hub.executeSpecialLoginFlow({
    context: { kind: 'active', plan: clone(plan), activePlanVersion: plan.planVersion },
    entry: { authoringUrl: ENTRY_URL, allowedOrigin: TOP_ORIGIN },
    credentials: { ...credentials },
    executionKey: `ms-${Math.random().toString(36).slice(2)}`,
    diagnosticPath: 'admin_test',
  });
  return { outcome, bridge };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
async function gateParity({ hub, bgSrc = BG_SRC, lc }) {
  const ext = loadBackground(new Sim({ plan: multiPlan() }), bgSrc);
  for (const [label, plan, extReason, hubReason] of gateCases()) {
    const allCreds = Object.fromEntries(plan.steps.flatMap((s) => s.fieldMappings.map((m) => [m.fieldId, `v-${m.fieldId}`])));
    const extVerdict = ext.specialValidateRunPlan(clone(plan), { ...allCreds });
    if (extReason === null) {
      assert(extVerdict.ok === true, `GATE Ext ${label}: runnable (got ${extVerdict.reason})`);
    } else {
      assert(extVerdict.ok === false && extVerdict.reason === extReason, `GATE Ext ${label}: ${extReason} (got ${extVerdict.ok ? 'pass' : extVerdict.reason})`);
    }
    const { outcome, bridge } = await hubRun(hub, plan, allCreds);
    const hubPass = outcome.stage !== 'validate';
    assert(hubPass === (extReason === null), `GATE parity ${label}: Hub ${hubPass ? 'pass' : outcome.reason} vs Ext ${extVerdict.ok ? 'pass' : extVerdict.reason}`);
    assert(hubPass === (bridge.sends.length === 1), `GATE ${label}: Hub sends only when runnable`);
    if (hubReason) assert(outcome.reason === hubReason, `GATE Hub ${label}: ${hubReason} (got ${outcome.reason})`);
    if (lc && extReason === null) assert(lc.validateSpecialRunnable(clone(plan)).ok, `GATE lc ${label}`);
  }
  return ext;
}

function extCredentialChecks(ext) {
  const v = ext.specialValidateRunPlan(clone(multiPlan()), { ...CREDS });
  assert(v.ok && v.steps.length === 2, 'R-4 Ext: valid');
  assert(JSON.stringify(v.steps[0].credentials) === JSON.stringify({ username: CREDS.username }), 'R-4 Ext: step 1 gets only its subset');
  assert(JSON.stringify(v.steps[1].credentials) === JSON.stringify({ password: CREDS.password }), 'R-4 Ext: step 2 gets only its subset');
  const missing = ext.specialValidateRunPlan(clone(multiPlan()), { username: CREDS.username });
  assert(missing.ok === false && missing.reason === 'credentials_incomplete', 'R-4 Ext: step-2 value required (union)');
  const blank = ext.specialValidateRunPlan(clone(multiPlan()), { username: CREDS.username, password: '  ' });
  assert(blank.ok === false && blank.reason === 'credentials_incomplete', 'R-4 Ext: blank rejected');
  const extra = ext.specialValidateRunPlan(clone(multiPlan()), { ...CREDS, otp: '1' });
  assert(extra.ok === false && extra.reason === 'credentials_unexpected', 'R-4 Ext: extra key rejected');
}

async function hubCredentialChecks(hub) {
  const { outcome, bridge } = await hubRun(hub, multiPlan(), { ...CREDS, otp: '123456' });
  assert(outcome.ok === true && bridge.sends.length === 1, 'R-4 Hub: runnable MULTI_STEP sent');
  assert(Object.keys(bridge.sends[0].credentials).sort().join(',') === 'password,username', 'R-4 Hub: payload = union of all steps, nothing else');
  const miss = await hubRun(hub, multiPlan(), { username: CREDS.username });
  assert(miss.outcome.reason === 'credentials_incomplete' && miss.bridge.sends.length === 0, 'R-4 Hub: step-2 value required');
  assert(hub.buildSpecialCredentialSubset(multiPlan(), { username: 'u', password: ' ' }).ok === false, 'R-4 Hub: blank rejected');
}

async function copyChecks(hub, msg) {
  const STEP_READY = 'המילוי נעצר בשלב 2: השדות של השלב הזה לא הופיעו בזמן.';
  assert(msg.specialAdminMessage({ ok: false, reason: 'readiness_timeout', stepNumber: 2 }) === STEP_READY, 'R-6 copy: step readiness');
  assert(
    msg.specialAdminMessage({ ok: false, reason: 'transition_missing', stepNumber: 1 }) === `המילוי נעצר בשלב 1: ${msg.MSG_SPECIAL_ADMIN_TRANSITION}`,
    'R-6 copy: transition_missing',
  );
  assert(msg.specialAdminMessage({ ok: false, reason: 'transition_ambiguous', stepNumber: 1 }).startsWith('המילוי נעצר בשלב 1: '), 'R-6 copy: ambiguous');
  assert(msg.specialAdminMessage({ ok: false, reason: 'readiness_timeout' }) === msg.MSG_SPECIAL_ADMIN_READINESS_TIMEOUT, 'R-6 copy: single-step unchanged');
  assert(msg.specialAdminMessage({ ok: false, reason: 'origin_mismatch', stepNumber: 2 }) === `המילוי נעצר בשלב 2: ${msg.MSG_SPECIAL_ADMIN_ORIGIN_MISMATCH}`, 'R-6 copy: origin');
  for (const reason of ['transition_missing', 'transition_ambiguous', 'readiness_timeout', 'origin_mismatch']) {
    for (const stepNumber of [1, 2, undefined]) {
      const p = msg.specialAdminPresentation({ ok: false, reason, stepNumber, userGestureDuringRun: false });
      assert(p.kind === 'failure' && p.message !== msg.MSG_SPECIAL_ADMIN_FILL_OK, `R-6 failure never success: ${reason}`);
      assert(!/[a-z_]{6,}/.test(p.message), `R-6 plain Hebrew (no reason codes): ${p.message}`);
    }
    assert(msg.specialEndUserMessage({ ok: false, reason }) !== msg.MSG_SPECIAL_ADMIN_FILL_OK, `R-6 DH never success: ${reason}`);
  }
  const t = await hubRun(hub, multiPlan(), CREDS, () => ({
    ok: false,
    state: 'FAILED',
    stage: 'transition',
    reason: 'transition_missing',
    stepId: 'step-1',
    actionId: 'exit-1',
    locator: '#next',
    tabOpened: true,
  }));
  assert(t.outcome.stage === 'transition' && t.outcome.stepId === 'step-1' && t.outcome.actionId === 'exit-1' && t.outcome.stepNumber === 1, 'R-6 Hub: stage transition + stepId + actionId + stepNumber');
  assert(msg.specialAdminPresentation(t.outcome).message.startsWith('המילוי נעצר בשלב 1: '), 'R-6 Hub → Admin copy names the step');
  const f = await hubRun(hub, floatingPlan(), CREDS, () => ({ ok: false, state: 'FAILED', stage: 'readiness', reason: 'readiness_timeout', stepId: 'step-credentials', tabOpened: true }));
  assert(f.outcome.stepNumber === undefined && msg.specialAdminPresentation(f.outcome).message === msg.MSG_SPECIAL_ADMIN_READINESS_TIMEOUT, 'R-6 FLOATING_SCREEN copy unchanged');
  const view = read('src/admin/SpecialTestResultView.tsx');
  assert(view.includes('stepNumber: outcome.stepNumber,'), 'R-6 result view passes stepNumber');
}

async function routeChecks(ctx, lc) {
  const meta = (draft) => ({ [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft, active: null }) });
  const multi = ctx.fillTestRoute(meta(multiPlan()), 'MULTI_STEP');
  assert(multi.route === 'special' && multi.specialRunnable === true && multi.specialPatternLater === false, 'R-7 MULTI_STEP draft runnable in «בדיקת מילוי»');
  assert(multi.specialMappedFieldIds.join(',') === 'username,password', `R-7 temp inputs = mapped fieldIds of all steps (got ${multi.specialMappedFieldIds})`);
  const four = ctx.fillTestRoute(meta(fourStepPlan()), 'MULTI_STEP');
  assert(four.specialMappedFieldIds.join(',') === 'username,tenant,otp,password', 'R-7 four steps → four temp inputs');
  const fsms = ctx.fillTestRoute(meta(floatingMultiPlan()), 'FLOATING_SCREEN_MULTI_STEP');
  assert(fsms.specialRunnable === false && fsms.specialPatternLater === true, 'R-7 FLOATING_SCREEN_MULTI_STEP stays «בשלב מאוחר יותר»');
  const fs = ctx.fillTestRoute(meta(floatingPlan()), 'FLOATING_SCREEN');
  assert(fs.specialRunnable === true && fs.specialMappedFieldIds.join(',') === 'username,password', 'R-7 FLOATING_SCREEN unchanged');
}

function approveChecks(bar) {
  assert(bar.specialApproveGate(multiPlan()).allowed === true, 'R-7 approve: runnable MULTI_STEP allowed');
  assert(bar.specialApproveGate(floatingPlan()).allowed === true, 'R-7 approve: FLOATING_SCREEN allowed');
  const fsms = bar.specialApproveGate(floatingMultiPlan());
  assert(fsms.allowed === false && fsms.message === 'אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.', 'R-7 approve: FSMS blocked with the exact copy');
  // D-121-63 C made a repeated fieldId runnable; five steps is still complete but not runnable.
  const five = fourStepPlan();
  five.steps[3].exitTransition = exitAction('exit-4', { locator: '#next-4', readiness: '#e' });
  five.steps.push({ stepId: 'step-5', fieldMappings: [{ fieldId: 'pin', locatorType: 'css', locator: '#e' }] });
  const fiveGate = bar.specialApproveGate(five);
  assert(fiveGate.allowed === false && fiveGate.message === bar.SPECIAL_ACTION_BAR_HE.approveNotRunnable, 'R-7 approve: complete but not runnable → blocked');
  const none = bar.specialApproveGate(null);
  assert(none.allowed === false && none.message === null, 'R-7 approve: incomplete → blocked (completeness line explains)');
  const editor = read('src/admin/SpecialLoginDraftEditor.tsx');
  assert(editor.includes('disabled={busy || draftDirty || !draftCheck.complete || !approveGate.allowed}'), 'R-7 editor: button disabled by the gate');
  assert(editor.includes('if (!draft || busy || draftDirty || !draftCheck.complete || !approveGate.allowed) return;'), 'R-7 editor: confirm guarded');
  assert(editor.includes('if (!specialApproveGate(saved).allowed) return;'), 'R-7 editor: approve write guarded on the saved draft');
  assert(editor.includes('readLoginFlowPlanFromMetadata(row.metadata ?? {})?.draft ?? null'), 'R-7 editor: gate reads the saved draft');
}

function staticChecks() {
  const start = BG_SRC.indexOf('/**\n * Phase 121.2 — SPECIAL login flow runtime');
  const end = BG_SRC.indexOf('chrome.runtime.onMessageExternal.addListener');
  const block = BG_SRC.slice(start, end);
  const hubFiles = ['src/loginContract/runtimeGate.ts', 'src/execution/specialLoginFlow.ts', 'src/execution/specialLoginFlowMessages.ts', 'src/admin/fillTestContext.ts'];
  for (const [label, text] of [['runtime block', block], ...hubFiles.map((f) => [f, read(f)])]) {
    for (const bad of ['getFrameId', 'webNavigation', 'chrome.debugger', 'hostname', 'serviceId ===', '.submit(', 'requestSubmit', 'transitionSkipped', 'gmail', 'microsoft', 'live.com', 'paypal']) {
      assert(!text.toLowerCase().includes(bad.toLowerCase()), `STATIC ${label}: forbidden token ${bad}`);
    }
  }
  const click = block.slice(block.indexOf('      function clickAction('), block.indexOf('      function pollReadiness('));
  assert(click.includes("world: 'MAIN'") && click.includes('targets.length !== 1') && click.includes('targets[0].click();'), 'STATIC transition click = MAIN world exact-one');
  assert(block.includes('        return Math.min(Date.now() + ms, runDeadline);'), 'STATIC click / readiness deadlines within the operation deadline');
  const fillAttempt = block.slice(block.indexOf('      function fillAttempt('), block.indexOf('      // A transition is clicked only'));
  assert(fillAttempt.includes('checkR1(function () {'), 'STATIC R1 before every fill attempt');
  const transition = block.slice(block.indexOf('      function runTransition('));
  assert(transition.indexOf('checkR1(') < transition.indexOf('clickAction('), 'STATIC R1 before every transition click');
  assert(BG_SRC.includes("var SPECIAL_RESERVED_ACTION_KINDS = ['final_submit'];"), 'STATIC final_submit reserved');
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(!(manifest.permissions || []).some((p) => p === 'webNavigation' || p === 'debugger'), 'STATIC manifest unchanged (no webNavigation / debugger)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
out('Phase 121.3 — MULTI_STEP execution verification\n');

const LC = await bundle('src/loginContract/index.ts', 'lc');
const HUB = await bundle('src/execution/specialLoginFlow.ts', 'hub');
const MSG = await bundle('src/execution/specialLoginFlowMessages.ts', 'msg');
const CTX = await bundle('src/admin/fillTestContext.ts', 'ctx');
const BAR = await bundle('src/admin/specialActionBar.ts', 'bar');

await fixtureSamePage();
ok('MS-F-SAME-PAGE fill step 1 → verify → click «הבא» → readiness of step 2 → fill step 2 → STOPPED_FOR_USER; per-step subsets; never submits');
await fixtureNavigation();
ok('MS-F-NAVIGATION transition navigates (same origin): injections fail while navigating = not ready, then step 2 fills in the new document');
await fixtureFrameStep(FIX.FRAME_STEP);
ok('MS-F-FRAME-STEP step 1 top, step 2 in a cross-origin depth-1 frame (frames differ between steps; frameContext only for step 2)');
await fixtureFrameStep(FIX.NAVIGATION_FRAME);
ok('MS-F-NAVIGATION-FRAME framed step after a navigation: correlation unavailable while navigating = not ready, never success');
await fixtureCrossOrigin();
ok('MS-F-CROSS-ORIGIN transition to another origin → origin_mismatch (fail closed), step 2 values never sent');
await fixtureMissing();
ok('MS-F-TRANSITION-MISSING → stage transition, transition_missing, step-1 / exit-1 (fails closed, no blind fill)');
await fixtureAmbiguous();
ok('MS-F-TRANSITION-AMBIGUOUS → transition_ambiguous, nothing clicked');
await fixtureReadinessTimeout();
ok('MS-F-READINESS-TIMEOUT → readiness_timeout with step-2 / exit-1 / locator');
await fixtureR1BeforeFill();
ok('MS-F-R1-BEFORE-FILL tab origin changed after readiness → r1 origin_mismatch before the step-2 fill');

const EXT = await gateParity({ hub: HUB, lc: LC });
ok(`R-1 GATE Hub validateSpecialRunnable ≡ Ext specialValidateRunPlan on ${gateCases().length} plans (MULTI_STEP rules, FSMS pattern_not_supported_yet, FLOATING parity)`);
extCredentialChecks(EXT);
await hubCredentialChecks(HUB);
ok('R-4 required = union of all steps (non-blank); Hub sends the union only; each step receives only its own subset');
await copyChecks(HUB, MSG);
ok('R-6 stage transition + stepId/actionId; «המילוי נעצר בשלב N: …» in plain Hebrew; FLOATING_SCREEN copy unchanged');
await routeChecks(CTX, LC);
ok('R-7 «בדיקת מילוי»: MULTI_STEP runnable, temp inputs = all steps; FSMS «בשלב מאוחר יותר»');
approveChecks(BAR);
ok('R-7 «אשר מיפוי» only when the saved draft passes the runtime gate; FSMS → «אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.»');
staticChecks();
ok('STATIC no getFrameId / webNavigation / debugger / site branches / submit / R-5; MAIN-world exact-one click; R1 before each click + fill; deadlines capped');
{
  const leaked = LOGS.filter((line) => SECRETS.some((s) => line.includes(s)));
  assert(leaked.length === 0, `credential value logged:\n${leaked.slice(0, 3).join('\n')}`);
  assert(LOGS.some((l) => l.includes('specialRun') && l.includes('transition')), 'transition diag emitted');
  ok(`LOGS no credential value in ${LOGS.length} captured lines; transition diag emitted`);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
async function expectCaught(label, fn) {
  let caught = null;
  try {
    await fn();
  } catch (err) {
    caught = String((err && err.message) || err).split('\n')[0];
  }
  assert(caught, `MUTATION NOT CAUGHT: ${label}`);
  ok(`mutation caught: ${label}  [${caught.slice(0, 110)}]`);
}
const mutBg = (from, to, label) => replaceOnce(BG_SRC, from, to, label);

await expectCaught('X1 transition before the step fill → same-page order', () =>
  fixtureSamePage(mutBg('        fillAttempt(index, 0);\n      }', '        if (plan.steps[index].exit) {\n          runTransition(index);\n          return;\n        }\n        fillAttempt(index, 0);\n      }', 'X1')),
);
await expectCaught('X2 union credentials into every step → per-step subset', () =>
  fixtureSamePage(
    mutBg(
      '            credentials: step.credentials,',
      '            credentials: plan.steps.reduce(function (acc, s) { return Object.assign(acc, s.credentials); }, {}),',
      'X2',
    ),
  ),
);
await expectCaught('X3 Ext readiness may be a field of its own step → gate parity', () =>
  gateParity({ hub: HUB, bgSrc: mutBg('    (ownRows !== null && specialRuntimeHasField(ownRows, r.locator, frames.readinessFrame))\n', '    false\n', 'X3') }),
);
{
  const HUB_X4 = await bundle('src/execution/specialLoginFlow.ts', 'hubx4', {
    transforms: [['src/loginContract/runtimeGate.ts', '    (ownRows !== null && hasField(ownRows, readiness.locator, readiness.frame))\n', '    false\n']],
  });
  await expectCaught('X4 Hub readiness may be a field of its own step → gate parity', () => gateParity({ hub: HUB_X4 }));
}
await expectCaught('X5 navigating tab after a transition fails instead of pending → navigation-frame fixture', () =>
  fixtureFrameStep(FIX.NAVIGATION_FRAME, mutBg("var navigating = afterTransition && !r.ok && r.reason === 'frame_correlation_unavailable';", 'var navigating = false;', 'X5')),
);
await expectCaught('X6 no R1 before the fill → R1-before-fill fixture', () =>
  fixtureR1BeforeFill(mutBg('        checkR1(function () {\n          fillInDocument(index, attempt);\n        });', '        fillInDocument(index, attempt);', 'X6')),
);
await expectCaught('X7 transition reported as opener → missing fixture', () =>
  fixtureMissing(mutBg(": { none: 'transition_missing', many: 'transition_ambiguous' };", ": { none: 'opener_missing', many: 'opener_ambiguous' };", 'X7')),
);
await expectCaught('X8 Ext allows 5 steps → gate parity', () =>
  gateParity({ hub: HUB, bgSrc: mutBg('var SPECIAL_RUNTIME_MULTI_STEP_MAX = 4;', 'var SPECIAL_RUNTIME_MULTI_STEP_MAX = 5;', 'X8') }),
);
{
  const HUB_X10 = await bundle('src/execution/specialLoginFlow.ts', 'hubx10', {
    transforms: [['src/execution/specialLoginFlow.ts', 'plan.steps.flatMap((step) => step.fieldMappings ?? [])', '(plan.steps[0]?.fieldMappings ?? [])']],
  });
  await expectCaught('X10 Hub subset = steps[0] only → union check', () => hubCredentialChecks(HUB_X10));
}
{
  const HUB_X11 = await bundle('src/execution/specialLoginFlow.ts', 'hubx11', {
    transforms: [['src/loginContract/runtimeGate.ts', "  if (plan.pattern === 'MULTI_STEP') return validateMultiStep(plan, preamble);\n", '']],
  });
  await expectCaught('X11 Hub MULTI_STEP gate removed → gate parity', () => gateParity({ hub: HUB_X11 }));
}
{
  const CTX_X12 = await bundle('src/admin/fillTestContext.ts', 'ctxx12', {
    transforms: [['src/admin/fillTestContext.ts', "const RUNNABLE_SPECIAL_PATTERNS: readonly string[] = ['FLOATING_SCREEN', 'MULTI_STEP'];", "const RUNNABLE_SPECIAL_PATTERNS: readonly string[] = ['FLOATING_SCREEN'];"]],
  });
  await expectCaught('X12 fill test still FLOATING_SCREEN only → route', () => routeChecks(CTX_X12, LC));
}
{
  const CTX_X12B = await bundle('src/admin/fillTestContext.ts', 'ctxx12b', {
    transforms: [['src/admin/fillTestContext.ts', '(plan?.steps ?? []).flatMap((step) => step.fieldMappings ?? [])', '(plan?.steps[0]?.fieldMappings ?? [])']],
  });
  await expectCaught('X12b temp inputs = steps[0] only → route', () => routeChecks(CTX_X12B, LC));
}
{
  const BAR_X13 = await bundle('src/admin/specialActionBar.ts', 'barx13', {
    transforms: [['src/admin/specialActionBar.ts', '  if (runnable.ok) return { allowed: true };\n', '  return { allowed: true };\n']],
  });
  await expectCaught('X13 approve guard ignores the runtime gate → FSMS approvable', () => approveChecks(BAR_X13));
}
{
  const MSG_X14 = await bundle('src/execution/specialLoginFlowMessages.ts', 'msgx14', {
    transforms: [['src/execution/specialLoginFlowMessages.ts', '    return MSG_SPECIAL_ADMIN_STOPPED_AT_STEP(step, message);\n', '    return message;\n']],
  });
  await expectCaught('X14 «המילוי נעצר בשלב N» prefix removed → copy', () => copyChecks(HUB, MSG_X14));
}
await expectCaught('X15 Ext accepts an exit on the last step → gate parity', () =>
  gateParity({
    hub: HUB,
    bgSrc: mutBg("    if (i < last ? !specialRuntimeCssAction(exit, 'intermediate_transition') : exit) return shape;", "    if (i < last && !specialRuntimeCssAction(exit, 'intermediate_transition')) return shape;", 'X15'),
  }),
);
await expectCaught('X16 foreign origin after a transition treated as pending → cross-origin fixture', () =>
  fixtureCrossOrigin(mutBg("var navigating = afterTransition && !r.ok && r.reason === 'frame_correlation_unavailable';", 'var navigating = afterTransition && !r.ok;', 'X16')),
);
{
  const HUB_X17 = await bundle('src/execution/specialLoginFlow.ts', 'hubx17', {
    transforms: [['src/execution/specialLoginFlow.ts', "  'fill',\n  'transition',\n]);", "  'fill',\n]);"]],
  });
  await expectCaught('X17 Hub drops stage transition → copy / stage', () => copyChecks(HUB_X17, MSG));
}

out(`\nPhase 121.3 MULTI_STEP execution verification PASS (${passed} checks)`);
