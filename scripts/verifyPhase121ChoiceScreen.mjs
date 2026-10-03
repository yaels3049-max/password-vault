/**
 * Phase 121 D-121-63 — choice screens and repeated fields in MULTI_STEP.
 *
 * Screen A: ID + «המשך». Screen B (choice): SMS / voice / «כניסה עם סיסמה», no credential
 * fields. Screen C: ID (empty again) + password.
 * - Runtime (REAL extension/background.js + REAL page scripts in linkedom, mock chrome.* only):
 *   A → B → C same page and with navigations; readiness into B = B's exit (a button);
 *   the ID is filled on A and on C; B is never filled; nothing is submitted.
 * - Gate: Hub validateSpecialPlanComplete + validateSpecialRunnable ≡ Ext specialValidateRunPlan
 *   (action-only rules A, readiness rule B, repeated fieldId rule C).
 * - Authoring (REAL authoringClickApprovedAction): actions_only only when the tested button is
 *   gone AND a fresh vocabulary action appeared; declared readiness on a button.
 * - Editor (REAL SpecialLoginDraftEditor, minimal hooks runtime): choice screen → action-only
 *   step 2 with the follow-up «כניסה עם סיסמה» → step 3 → auto-Analyze proposes C's new ID
 *   element, never the same element.
 * Every rule has a mutation that must be caught.
 *
 * Usage: node scripts/verifyPhase121ChoiceScreen.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
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
const ENTRY_URL = `${TOP_ORIGIN}/signin`;
const CROSS_FRAME = { frameLocator: 'iframe#pwd-frame', frameOrigin: FRAME_ORIGIN };
const CREDS = { username: 'ch-id-3k9w', password: 'ch-pass-Q7t-x42' };
const SECRETS = [CREDS.username, CREDS.password];

const A_FORM =
  '<form id="id-form"><input id="user" type="text" name="id" autocomplete="username"><button id="next" type="button">המשך</button></form>';
const B_PLAIN_BUTTONS = '<button id="sms" type="button">קוד ב-SMS</button><button id="voice" type="button">קוד בשיחה קולית</button>';
const B_FORM = `<div id="choice">${B_PLAIN_BUTTONS}<button id="pw-login" type="button">כניסה עם סיסמה</button></div>`;
const B_PLAIN = `<div id="choice">${B_PLAIN_BUTTONS}</div>`;
const C_FORM =
  '<form id="login-form"><input id="id2" type="text" name="id" autocomplete="username"><input id="pass" type="password" name="p"><button id="login-btn" type="submit">כניסה</button></form>';
const page = (body) => `<!doctype html><html><head><title>Sign in</title></head><body><main>${body}</main></body></html>`;

// ---------------------------------------------------------------------------
// Sources + sandbox speed-ups
// ---------------------------------------------------------------------------
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert(start >= 0, `fixture: function ${name} present`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`fixture: unterminated ${name}`);
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
// Tab simulator (mock chrome.* only). Same model as verifyPhase121MultiStepRuntime.
// ---------------------------------------------------------------------------
class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.frames = new Map();
    this.calls = [];
    this.events = [];
    this.pageErrors = [];
    this.counters = { next: 0, pw: 0, choiceOther: 0, submit: 0, loginBtn: 0, formSubmitCall: 0 };
    this.wired = new WeakSet();
    this.updatedListeners = new Set();
    this.tab = null;
    this.topNavigating = false;
    this.listener = null;
    this.setTop(makeWin(cfg.topHtml || page(A_FORM), TOP_ORIGIN));
    this.chrome = this.makeChrome();
  }

  setTop(win) {
    def(win, 'top', win);
    def(win, 'parent', win);
    this.top = win;
    this.frames.clear();
    this.frames.set(0, { id: 0, parentId: null, win });
    this.wire(win);
  }

  wire(win) {
    const on = (sel, fn) => {
      for (const el of win.document.querySelectorAll(sel)) {
        if (this.wired.has(el)) continue;
        this.wired.add(el);
        el.addEventListener('click', () => fn(el));
      }
    };
    on('#next', () => {
      this.counters.next += 1;
      const u = win.document.querySelector('#user');
      this.events.push(`click:next(user=${u ? u.value : ''})`);
      if (this.cfg.onNext) this.cfg.onNext(this);
    });
    on('#pw-login', () => {
      this.counters.pw += 1;
      const u = win.document.querySelector('#id2');
      this.events.push(`click:pw(id2=${u ? u.value : ''})`);
      if (this.cfg.onPw) this.cfg.onPw(this);
    });
    on('#sms, #voice', () => (this.counters.choiceOther += 1));
    on('#login-btn', () => (this.counters.loginBtn += 1));
    const form = win.document.querySelector('#login-form');
    if (form && !this.wired.has(form)) {
      this.wired.add(form);
      form.addEventListener('submit', () => (this.counters.submit += 1));
      form.submit = () => (this.counters.formSubmitCall += 1);
      form.requestSubmit = () => (this.counters.formSubmitCall += 1);
    }
  }

  /** Same-page screen change: the main content is replaced. */
  showScreen(html) {
    this.top.document.querySelector('main').innerHTML = html;
    this.wire(this.top);
  }

  append(html) {
    const div = this.top.document.createElement('div');
    div.innerHTML = html;
    this.top.document.body.appendChild(div);
    this.wire(this.top);
  }

  navigateTop(html, url, gapMs) {
    this.topNavigating = true;
    setTimeout(() => {
      this.setTop(makeWin(html, TOP_ORIGIN));
      this.tab.url = url;
      this.topNavigating = false;
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
      done(null, results);
    }, 0);
  }

  credentialCalls() {
    return this.calls
      .filter((c) => SECRETS.some((s) => c.argsJson.includes(s)))
      .map((c) => ({ ids: c.ids, opts: JSON.parse(c.argsJson)[0] }));
  }
}

const AUTHORING_TAB_STUBS = `
function ensureSpecialAuthoringTab(_m, cb) { cb({ ok: true, tabId: 1, reused: true }); }
function activateSpecialAuthoringTab(_t, cb) { cb(true); }
`;

function loadBackground(sim, bgSrc, { authoring = false } = {}) {
  const bgConsole = {
    log: (...a) => LOGS.push(fmtLog(a)),
    info: (...a) => LOGS.push(fmtLog(a)),
    warn: (...a) => LOGS.push(fmtLog(a)),
    error: (...a) => LOGS.push(fmtLog(a)),
  };
  const factory = new Function(
    'chrome',
    'console',
    `${speedUp(bgSrc)}\n${authoring ? AUTHORING_TAB_STUBS : ''}\n;return { specialValidateRunPlan: specialValidateRunPlan, authoringClick: authoringClickApprovedAction };`,
  );
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

async function runExt(cfg, bgSrc = BG_SRC) {
  const sim = new Sim(cfg);
  loadBackground(sim, bgSrc);
  const message = {
    type: 'HUB_SPECIAL_LOGIN_FLOW',
    runId: 'ch-run-1',
    entryUrl: ENTRY_URL,
    allowedOrigin: TOP_ORIGIN,
    plan: JSON.parse(JSON.stringify(cfg.plan)),
    credentials: { ...CREDS },
    diagnosticPath: 'admin_test',
  };
  const response = await withDeadline(
    new Promise((resolve) => {
      sim.listener(message, { tab: { id: 99, index: 2 } }, resolve);
    }),
    8000,
    cfg.name,
  );
  await sleep(40);
  return { sim, response };
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
const clone = (x) => JSON.parse(JSON.stringify(x));
const frameOf = (frame) => (frame ? { frame: { ...frame } } : {});
const map = (fieldId, locator, frame = null) => ({ fieldId, locatorType: 'css', locator, ...frameOf(frame) });

function exitAction(actionId, { locator, readiness, timeoutMs = 2000, readinessFrame = null, frame = null }) {
  return {
    actionId,
    kind: 'intermediate_transition',
    label: 'Next',
    locatorType: 'css',
    locator,
    approvedForAuthoringContinuation: true,
    approvedForRuntime: true,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: readiness, timeoutMs, ...frameOf(readinessFrame) },
    ...frameOf(frame),
  };
}

/** A (ID) → «המשך» → B (choice, action-only) → «כניסה עם סיסמה» → C (ID again + password). */
function choicePlan({ timeoutMs = 2000 } = {}) {
  return {
    planVersion: 7,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      { stepId: 'step-1', fieldMappings: [map('username', '#user')], exitTransition: exitAction('exit-1', { locator: '#next', readiness: '#pw-login', timeoutMs }) },
      { stepId: 'step-2', fieldMappings: [], exitTransition: exitAction('exit-2', { locator: '#pw-login', readiness: '#id2', timeoutMs }) },
      { stepId: 'step-3', fieldMappings: [map('username', '#id2'), map('password', '#pass')] },
    ],
  };
}

/** 121.3 Gmail shape: username → «הבא» → password. */
function gmailPlan() {
  return {
    planVersion: 5,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      { stepId: 'step-1', fieldMappings: [map('username', '#user')], exitTransition: exitAction('exit-1', { locator: '#next', readiness: '#pass' }) },
      { stepId: 'step-2', fieldMappings: [map('password', '#pass')] },
    ],
  };
}

/** [label, plan, extReason (null = runnable), complete (validator; undefined = not asserted)]. */
function gateCases() {
  const c = () => clone(choicePlan());
  const lastActionOnly = c();
  lastActionOnly.steps = lastActionOnly.steps.slice(0, 2);
  delete lastActionOnly.steps[1].exitTransition;
  const lastActionOnlyWithExit = c();
  lastActionOnlyWithExit.steps = lastActionOnlyWithExit.steps.slice(0, 2);
  const noExit = c();
  delete noExit.steps[1].exitTransition;
  const step1Empty = c();
  step1Empty.steps[0].fieldMappings = [];
  const selfA = c();
  selfA.steps[0].exitTransition.readiness.locator = '#next';
  const sameAsA = c();
  sameAsA.steps[1].exitTransition.locator = '#next';
  sameAsA.steps[0].exitTransition.readiness.locator = '#next';
  const cField = c();
  cField.steps[0].exitTransition.readiness.locator = '#id2';
  const wrongFrame = c();
  wrongFrame.steps[0].exitTransition.readiness.frame = { ...CROSS_FRAME };
  const pending = c();
  pending.steps[0].exitTransition.readiness.locator = '[data-pv-pending-reveal]';
  const selfB = c();
  selfB.steps[1].exitTransition.readiness.locator = '#pw-login';
  const notApproved = c();
  notApproved.steps[1].exitTransition.approvedForRuntime = false;
  const finalSubmit = c();
  finalSubmit.steps[1].exitTransition.kind = 'final_submit';
  const twoChoices = {
    planVersion: 8,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      { stepId: 'step-1', fieldMappings: [map('username', '#user')], exitTransition: exitAction('exit-1', { locator: '#next', readiness: '#b1' }) },
      { stepId: 'step-2', fieldMappings: [], exitTransition: exitAction('exit-2', { locator: '#b1', readiness: '#b2' }) },
      { stepId: 'step-3', fieldMappings: [], exitTransition: exitAction('exit-3', { locator: '#b2', readiness: '#id2' }) },
      { stepId: 'step-4', fieldMappings: [map('username', '#id2'), map('password', '#pass')] },
    ],
  };
  const repeated = gmailPlan();
  repeated.steps[0].exitTransition.readiness.locator = '#user2';
  repeated.steps[1].fieldMappings = [map('username', '#user2'), map('password', '#pass')];
  const repeatedSameElement = gmailPlan();
  repeatedSameElement.steps[0].exitTransition.readiness.locator = '#user';
  repeatedSameElement.steps[1].fieldMappings = [map('username', '#user'), map('password', '#pass')];
  const floatingEmpty = {
    planVersion: 3,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [
      { actionId: 'opener-1', kind: 'floating_opener', label: 'Open', locatorType: 'css', locator: '#open', approvedForRuntime: true, readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#next', timeoutMs: 2000 } },
    ],
    steps: [{ stepId: 'step-credentials', fieldMappings: [] }],
  };
  return [
    ['choice A → B → C (action-only middle step, repeated ID)', choicePlan(), null, true],
    ['two consecutive choice screens', twoChoices, null, true],
    ['repeated fieldId, different element (readiness = step 2 ID)', repeated, null, true],
    ['Gmail shape (121.3) unchanged', gmailPlan(), null, true],
    ['action-only LAST step', lastActionOnly, 'plan_shape_unsupported', false],
    ['action-only last step with an exit', lastActionOnlyWithExit, 'plan_shape_unsupported', false],
    ['action-only step without an exit', noExit, 'plan_shape_unsupported', false],
    ['step 1 without fields', step1Empty, 'plan_shape_unsupported', false],
    ['readiness into B = the action itself (A exit)', selfA, 'readiness_invalid', false],
    ['B exit = A exit (readiness = the action itself)', sameAsA, 'readiness_invalid', false],
    ['readiness into B = a field of C (not B exit)', cField, 'readiness_invalid', false],
    ['readiness into B in another frame than B exit', wrongFrame, 'readiness_invalid', false],
    ['readiness into B = pending marker', pending, 'readiness_invalid', false],
    ['B exit readiness = itself', selfB, 'readiness_invalid', false],
    ['B exit not approvedForRuntime', notApproved, 'plan_shape_unsupported', false],
    ['B exit final_submit (reserved)', finalSubmit, 'reserved_action_kind', false],
    ['repeated fieldId, same element as own step (readiness exclusion by locator)', repeatedSameElement, 'readiness_invalid', undefined],
    ['FLOATING_SCREEN empty step unchanged', floatingEmpty, 'plan_shape_unsupported', false],
  ];
}

// ---------------------------------------------------------------------------
// Runtime fixtures
// ---------------------------------------------------------------------------
const FIX = {
  SAME_PAGE: {
    name: 'CH-F-SAME-PAGE',
    plan: choicePlan(),
    onNext: (sim) => setTimeout(() => sim.showScreen(B_FORM), 40),
    onPw: (sim) => setTimeout(() => sim.showScreen(C_FORM), 40),
  },
  NAVIGATION: {
    name: 'CH-F-NAVIGATION',
    plan: choicePlan(),
    onNext: (sim) => sim.navigateTop(page(B_FORM), `${TOP_ORIGIN}/choice`, 120),
    onPw: (sim) => sim.navigateTop(page(C_FORM), `${TOP_ORIGIN}/password`, 120),
  },
  B_EXIT_MISSING: {
    name: 'CH-F-B-EXIT-MISSING',
    plan: choicePlan({ timeoutMs: 250 }),
    onNext: (sim) => setTimeout(() => sim.showScreen(B_PLAIN), 40),
  },
};

function assertNoPageErrors(sim, label) {
  assert(sim.pageErrors.length === 0, `${label}: page script errors:\n${sim.pageErrors.join('\n')}`);
}

function assertNoSubmit(sim, label) {
  const c = sim.counters;
  assert(c.submit === 0 && c.loginBtn === 0 && c.formSubmitCall === 0, `${label}: never submits (${JSON.stringify(c)})`);
  assert(c.choiceOther === 0, `${label}: SMS / voice never clicked`);
}

async function fixtureChoice(fix, bgSrc) {
  const res = await runExt(fix, bgSrc);
  const { sim, response: r } = res;
  const label = fix.name;
  assertNoPageErrors(sim, label);
  assert(r.ok === true && r.state === 'STOPPED_FOR_USER', `${label}: STOPPED_FOR_USER (${JSON.stringify(r)})`);
  assert(r.stepId === 'step-3' && r.actionId === 'exit-2', `${label}: ends at step-3 via exit-2 (${r.stepId}/${r.actionId})`);
  assert(r.filled === 3, `${label}: filled 1 (A) + 2 (C) (got ${r.filled})`);
  const e = sim.events;
  const fillA = e.indexOf('fill:username@0');
  const clickA = e.findIndex((x) => x.startsWith('click:next'));
  const clickB = e.findIndex((x) => x.startsWith('click:pw'));
  const fillC = e.indexOf('fill:password,username@0');
  assert(fillA >= 0 && clickA > fillA && clickB > clickA && fillC > clickB, `${label}: fill A → «המשך» → «כניסה עם סיסמה» → fill C: ${e.join(' | ')}`);
  assert(e[clickA] === `click:next(user=${CREDS.username})`, `${label}: ID present on A when «המשך» was clicked`);
  assert(e[clickB] === 'click:pw(id2=)', `${label}: C not filled before B's exit`);
  assert(!e.slice(clickA + 1, clickB).some((x) => x.startsWith('fill:')), `${label}: action-only step B is never filled`);
  assert(sim.counters.next === 1 && sim.counters.pw === 1, `${label}: each transition clicked once`);
  const readinessIntoB = sim.calls.filter((c) => c.argsJson.includes('"#pw-login","action"'));
  assert(readinessIntoB.length > 0, `${label}: readiness into B = B's exit, checked as a button (target action)`);
  assert(!sim.calls.some((c) => c.argsJson.includes('"#pw-login","field"')), `${label}: B's exit never checked as a field`);
  for (const c of sim.credentialCalls()) {
    const keys = Object.keys(c.opts.credentials).sort().join(',');
    const ids = c.opts.fieldMappings.map((m) => m.fieldId).sort().join(',');
    assert(keys === 'username' || keys === 'password,username', `${label}: a page injection received ${keys}`);
    assert(ids === keys, `${label}: mappings ${ids} ≠ credentials ${keys} (per-step subset)`);
  }
  const doc = sim.top.document;
  assert(doc.querySelector('#id2').value === CREDS.username, `${label}: ID filled on C (repeated fieldId)`);
  assert(doc.querySelector('#pass').value === CREDS.password, `${label}: password filled on C`);
  assertNoSubmit(sim, label);
  return res;
}

async function fixtureBExitMissing(bgSrc) {
  const { sim, response: r } = await runExt(FIX.B_EXIT_MISSING, bgSrc);
  const label = FIX.B_EXIT_MISSING.name;
  assert(r.ok === false && r.stage === 'readiness' && r.reason === 'readiness_timeout', `${label}: readiness_timeout (got ${r.stage}/${r.reason})`);
  assert(r.stepId === 'step-2' && r.actionId === 'exit-1' && r.locator === '#pw-login', `${label}: step-2 / exit-1 / #pw-login named`);
  assert(!sim.credentialCalls().some((c) => c.opts.credentials.password), `${label}: C values never sent`);
  assertNoSubmit(sim, label);
}

// ---------------------------------------------------------------------------
// Authoring (real authoringClickApprovedAction)
// ---------------------------------------------------------------------------
const PENDING = { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '[data-pv-pending-reveal]', timeoutMs: 400 };

async function runAuthoring(cfg, extra = {}, bgSrc = BG_SRC) {
  const sim = new Sim(cfg);
  sim.tab = { id: 1, url: ENTRY_URL, status: 'complete' };
  const api = loadBackground(sim, bgSrc, { authoring: true });
  const message = {
    type: 'ADMIN_AUTHORING_CLICK_APPROVED',
    requestId: 'r-1',
    allowedOrigin: TOP_ORIGIN,
    authoringUrl: ENTRY_URL,
    kind: 'intermediate_transition',
    locator: cfg.locator || '#next',
    locatorType: 'css',
    approvedForAuthoringContinuation: true,
    readinessMode: 'reveal',
    readiness: PENDING,
    reopenLoginEntry: false,
    fillCredentials: false,
    submitForm: false,
    ...extra,
  };
  const response = await withDeadline(new Promise((resolve) => api.authoringClick(message, resolve)), 8000, cfg.name);
  return { sim, response };
}

const AO = {
  ACCEPT: { name: 'AO-CHOICE', onNext: (s) => setTimeout(() => s.showScreen(B_FORM), 40) },
  HIDDEN: {
    name: 'AO-HIDDEN',
    onNext: (s) =>
      setTimeout(() => {
        s.top.document.querySelector('#next').setAttribute('style', 'display:none');
        s.append(B_FORM);
      }, 40),
  },
  NO_CHANGE: { name: 'AO-NO-CHANGE' },
  GONE_NO_ACTION: { name: 'AO-GONE-NO-VOCABULARY', onNext: (s) => setTimeout(() => s.showScreen(B_PLAIN), 40) },
  ACTION_TESTED_PRESENT: { name: 'AO-TESTED-STILL-THERE', onNext: (s) => setTimeout(() => s.append(B_FORM), 40) },
  PREEXISTING: {
    name: 'AO-ACTION-NOT-FRESH',
    topHtml: page(`${A_FORM}<nav><button id="hdr" type="button">כניסה עם סיסמה</button></nav>`),
    onNext: (s) =>
      setTimeout(() => {
        s.top.document.querySelector('#id-form').remove();
        s.append(B_PLAIN);
      }, 40),
  },
  FRESH_FIELD: { name: 'AO-FRESH-FIELD', onNext: (s) => setTimeout(() => s.showScreen(C_FORM), 40) },
};

async function authoringChecks(bgSrc = BG_SRC) {
  const allow = { allowActionsOnly: true };
  let r = (await runAuthoring(AO.ACCEPT, allow, bgSrc)).response;
  assert(r.ok === true && r.actionsOnly === true && r.revealed && r.revealed.frame === null, `D1 choice screen: tested button gone + fresh «כניסה עם סיסמה» → actions_only (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.HIDDEN, allow, bgSrc)).response;
  assert(r.ok === true && r.actionsOnly === true, `D1 tested button hidden (not interactable) counts as gone (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.NO_CHANGE, allow, bgSrc)).response;
  assert(r.ok === false && r.reason === 'surface_not_revealed', `D2 same screen, no change → surface_not_revealed (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.GONE_NO_ACTION, allow, bgSrc)).response;
  assert(r.ok === false && r.reason === 'surface_not_revealed', `D2 button gone but only plain actions (SMS / voice) → surface_not_revealed (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.ACTION_TESTED_PRESENT, allow, bgSrc)).response;
  assert(r.ok === false && r.reason === 'surface_not_revealed', `D2 fresh vocabulary action while the tested button is still there → fail (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.PREEXISTING, allow, bgSrc)).response;
  assert(r.ok === false && r.reason === 'surface_not_revealed', `D2 vocabulary action that was eligible before the click is not fresh → fail (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.ACCEPT, {}, bgSrc)).response;
  assert(r.ok === false && r.reason === 'surface_not_revealed', `D3 not requested (FLOATING / opener tests) → today's failure (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.ACCEPT, { ...allow, requirePasswordSurface: true }, bgSrc)).response;
  assert(r.ok === false && r.actionsOnly !== true, `D3 requirePasswordSurface (single-step floating) never actions_only (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.FRESH_FIELD, allow, bgSrc)).response;
  assert(r.ok === true && r.actionsOnly !== true && r.revealed && r.revealed.frame === null, `D4 fresh credential input still wins first (no actions_only) (got ${JSON.stringify(r)})`);
  const declared = { readinessMode: 'declared', readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#pw-login', timeoutMs: 400 } };
  r = (await runAuthoring(AO.ACCEPT, { ...declared, readinessTarget: 'action' }, bgSrc)).response;
  assert(r.ok === true && r.readinessMode === 'declared', `B1 declared readiness on B's exit (target action) → met (got ${JSON.stringify(r)})`);
  r = (await runAuthoring(AO.ACCEPT, declared, bgSrc)).response;
  assert(r.ok === false && r.reason === 'readiness_timeout', `B1 a button is never a met field readiness (got ${JSON.stringify(r)})`);
  r = (await runAuthoring({ name: 'AO-SELF', locator: '#pw-login' }, { ...declared, readinessTarget: 'action' }, bgSrc)).response;
  assert(r.ok === false && r.reason === 'readiness_is_self', `B1 readiness = the action itself rejected (got ${JSON.stringify(r)})`);
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
  [/(^|\/)browserIntegration$/, `export * from './src/browserIntegration/index.ts';\n${BRIDGE_STUB}`],
];

const bundle = (entry, name, opts) => withTempDir(`pv-121ch-${name}-`, (dir) => bundleIn(dir, entry, name, opts));

async function bundleIn(dir, entry, name, { transforms = [] } = {}) {
  const outfile = join(dir, `${name}.mjs`);
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
        name: 'pv-ch-stubs',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            const idx = HUB_STUBS.findIndex(([re]) => re.test(args.path));
            if (idx < 0) return undefined;
            return { path: `stub-${idx}`, namespace: 'pv-stub' };
          });
          b.onLoad({ filter: /.*/, namespace: 'pv-stub' }, (args) => ({
            contents: HUB_STUBS[Number(args.path.slice(5))][1],
            loader: 'ts',
            resolveDir: root,
          }));
          b.onLoad({ filter: /\.tsx?$/ }, (args) => {
            const p = args.path.replace(/\\/g, '/');
            const mine = transforms.filter(([suffix]) => p.endsWith(suffix));
            if (mine.length === 0) return undefined;
            let text = readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
            for (const [suffix, from, to] of mine) {
              text = replaceOnce(text, from, to, `${suffix} transform`);
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

function resetHub() {
  const sends = [];
  globalThis.__bridge = {
    opens: [],
    sends,
    send: async (message) => {
      sends.push(JSON.parse(JSON.stringify(message)));
      return { ok: true, state: 'STOPPED_FOR_USER', stage: 'fill', tabOpened: true, filled: 3, userGestureDuringRun: false };
    },
  };
  return globalThis.__bridge;
}

async function hubRun(hub, plan, credentials) {
  const bridge = resetHub();
  const outcome = await hub.executeSpecialLoginFlow({
    context: { kind: 'active', plan: clone(plan), activePlanVersion: plan.planVersion },
    entry: { authoringUrl: ENTRY_URL, allowedOrigin: TOP_ORIGIN },
    credentials: { ...credentials },
    executionKey: `ch-${Math.random().toString(36).slice(2)}`,
    diagnosticPath: 'admin_test',
  });
  return { outcome, bridge };
}

/** R-1 parity: Hub validator + runtime gate + Hub run ≡ Ext specialValidateRunPlan. */
async function gateParity({ hub, lc, bar, bgSrc = BG_SRC }) {
  const ext = loadBackground(new Sim({}), bgSrc);
  for (const [label, plan, extReason, complete] of gateCases()) {
    const allCreds = Object.fromEntries(plan.steps.flatMap((s) => s.fieldMappings.map((m) => [m.fieldId, `v-${m.fieldId}`])));
    const extVerdict = ext.specialValidateRunPlan(clone(plan), { ...allCreds });
    if (extReason === null) {
      assert(extVerdict.ok === true, `GATE Ext ${label}: runnable (got ${extVerdict.reason})`);
    } else {
      assert(extVerdict.ok === false && extVerdict.reason === extReason, `GATE Ext ${label}: ${extReason} (got ${extVerdict.ok ? 'pass' : extVerdict.reason})`);
    }
    const gate = lc.validateSpecialRunnable(clone(plan));
    assert(gate.ok === (extReason === null), `GATE parity ${label}: Hub gate ${gate.ok ? 'pass' : gate.reason} vs Ext ${extVerdict.ok ? 'pass' : extVerdict.reason}`);
    if (extReason !== null && extReason !== 'plan_shape_unsupported') {
      assert(gate.reason === extReason, `GATE Hub ${label}: ${extReason} (got ${gate.reason})`);
    }
    if (complete !== undefined) {
      const v = lc.validateSpecialPlanComplete(clone(plan));
      assert(v.ok === complete, `COMPLETE ${label}: validator ${complete ? 'accepts' : 'rejects'} (got ${v.ok ? 'ok' : v.code})`);
      // The completeness line normalizes draft readiness first (A1), so only shape verdicts must agree.
      if (extReason === null || extReason === 'plan_shape_unsupported') {
        assert(bar.checkSpecialDraft(clone(plan)).complete === complete, `COMPLETE ${label}: completeness line agrees with the validator`);
      }
    }
    const { outcome, bridge } = await hubRun(hub, plan, allCreds);
    const hubPass = outcome.stage !== 'validate';
    assert(hubPass === (extReason === null), `GATE parity ${label}: Hub run ${hubPass ? 'pass' : outcome.reason} vs Ext ${extVerdict.ok ? 'pass' : extVerdict.reason}`);
    assert(hubPass === (bridge.sends.length === 1), `GATE ${label}: Hub sends only when runnable`);
    if (hubPass) {
      const sent = Object.keys(bridge.sends[0].credentials).sort().join(',');
      const union = [...new Set(plan.steps.flatMap((s) => s.fieldMappings.map((m) => m.fieldId)))].sort().join(',');
      assert(sent === union, `C ${label}: Hub sends the unique union of fieldIds (${sent} vs ${union})`);
    }
  }
  const good = ext.specialValidateRunPlan(clone(choicePlan()), { ...CREDS });
  assert(good.ok && good.steps[1].fieldMappings.length === 0 && Object.keys(good.steps[1].credentials).length === 0, 'A Ext run plan: action-only step carries no mappings / credentials');
  assert(Object.keys(good.steps[0].credentials).join() === 'username' && Object.keys(good.steps[2].credentials).sort().join() === 'password,username', 'C Ext run plan: the repeated ID goes to step 1 AND step 3 (own subsets)');
  assert(good.steps[0].exit.readiness.target === 'action' && good.steps[1].exit.readiness.target === 'field', 'B Ext run plan: readiness into B targets a button, into C a field');
  assert(bar.specialApproveGate(choicePlan()).allowed === true, 'R-7 «אשר מיפוי» allowed for the choice plan');
}

// ---------------------------------------------------------------------------
// Editor harness (REAL SpecialLoginDraftEditor; I/O seams only)
// ---------------------------------------------------------------------------
const MINI_REACT = `
let cur = null;
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
function slot() { return cur.i++; }
export function useState(init) {
  const h = cur, i = slot();
  if (!(i in h.s)) h.s[i] = typeof init === 'function' ? init() : init;
  return [h.s[i], (v) => { const next = typeof v === 'function' ? v(h.s[i]) : v; if (!Object.is(next, h.s[i])) { h.s[i] = next; h.dirty = true; } }];
}
export function useRef(init) { const h = cur, i = slot(); if (!(i in h.s)) h.s[i] = { current: init }; return h.s[i]; }
export function useMemo(fn, deps) { const h = cur, i = slot(); const p = h.s[i]; if (p && same(p.deps, deps)) return p.v; const v = fn(); h.s[i] = { deps, v }; return v; }
export function useCallback(fn, deps) { return useMemo(() => fn, deps); }
export function useEffect(fn, deps) {
  const h = cur, i = slot(); const p = h.s[i];
  if (p && deps && same(p.deps, deps)) return;
  h.fx.push(() => { if (p && typeof p.cleanup === 'function') p.cleanup(); h.s[i] = { deps, cleanup: fn() }; });
}
export const Fragment = Symbol('Fragment');
export function jsx(type, props, key) { return { type, props: props ?? {}, key }; }
export const jsxs = jsx;
export function mount(Component, props) {
  const h = { s: {}, fx: [], dirty: false, i: 0, tree: null, props };
  const render = () => {
    for (let n = 0; n < 50; n += 1) {
      h.dirty = false; h.i = 0; cur = h;
      h.tree = Component(h.props);
      cur = null;
      const fx = h.fx.splice(0);
      fx.forEach((f) => f());
      if (!h.dirty) return h.tree;
    }
    throw new Error('render loop');
  };
  render();
  return {
    get tree() { return h.tree; },
    setProps(p) { h.props = { ...h.props, ...p }; render(); },
    async settle() { for (let n = 0; n < 8; n += 1) { await new Promise((r) => setTimeout(r, 0)); render(); } },
  };
}
export default { useState, useRef, useMemo, useCallback, useEffect, Fragment };
`;

function apiStub() {
  const src = read('src/admin/adminRegistryApi.ts');
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}(...a) { return globalThis.__api(${JSON.stringify(n)}, a); }`).join('\n');
}

const SEAMS = [
  ['analyzeSpecialCurrentSurface', 'export async function analyzeSpecialCurrentSurface(input: {', '__analyze'],
  ['startCurrentTabVisualMapping', 'export async function startCurrentTabVisualMapping(input: {', '__pick'],
  ['performApprovedAuthoringClick', 'export async function performApprovedAuthoringClick(input: {', '__click'],
];

const loadEditor = (overrides = {}) => withTempDir('pv-121ch-ui-', (outdir) => loadEditorIn(outdir, overrides));

async function loadEditorIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const seamFile = abs('src/assistedMapping/currentTabAuthoring.ts');
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const plugin = {
    name: 'verify-seams',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (key === apiFile) return { contents: apiStub(), loader: 'js' };
        if (key === seamFile) {
          let src = readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
          for (const [name, anchor, hook] of SEAMS) {
            src = replaceOnce(
              src,
              anchor,
              `export async function ${name}(input: any): Promise<any> { return (globalThis as any).${hook}(input); }\nasync function real_${name}(input: {`,
              `seam ${name}`,
            );
          }
          return { contents: src, loader: 'ts', resolveDir: dirname(args.path) };
        }
        if (overridden.has(key)) {
          return { contents: overridden.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: {
      contents: `
        export { mount } from ${JSON.stringify(reactPath.replace(/\\/g, '/'))};
        export { default as SpecialEditor, SPECIAL_EDITOR_COPY_HE } from './src/admin/SpecialLoginDraftEditor.tsx';
        export * as lc from './src/loginContract/index.ts';
        export * as bar from './src/admin/specialActionBar.ts';
        export * as routing from './src/assistedMapping/specialAnalyzeRouting.ts';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    plugins: [plugin],
  });
  return import(pathToFileURL(outfile).href);
}

function walk(node, visit) {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') return visit(String(node));
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  visit(node);
  walk(node.props?.children, visit);
}
function findAll(tree, pred) {
  const found = [];
  walk(tree, (n) => typeof n === 'object' && pred(n) && found.push(n));
  return found;
}
function textOf(tree) {
  const parts = [];
  walk(tree, (n) => typeof n === 'string' && parts.push(n));
  return parts.join('\n');
}
function one(tree, action, extra = () => true) {
  const found = findAll(tree, (n) => n.props?.['data-action'] === action).filter(extra);
  assert(found.length === 1, `fixture: expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}
function stepItems(tree) {
  const sidebars = findAll(tree, (n) => n.props?.['data-panel'] === 'steps-sidebar');
  if (sidebars.length === 0) return null;
  return findAll(sidebars[0], (n) => n.props?.['data-action'] === 'special-select-step');
}
function clickStep(tree, stepId) {
  const items = (stepItems(tree) ?? []).filter((n) => n.props['data-step-id'] === stepId);
  assert(items.length === 1, `fixture: one «שלבי התהליך» item for ${stepId}`);
  items[0].props.onClick();
}
function currentStep(tree) {
  const items = stepItems(tree);
  if (!items) return null;
  return items.find((n) => n.props['aria-current'] === 'step')?.props['data-step-id'] ?? null;
}

const HUB_ORIGIN = 'https://id.example.test';
function makeRow() {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${HUB_ORIGIN}/login`,
    login_url: `${HUB_ORIGIN}/login`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: [
      { id: 'username', label: 'ת"ז', type: 'text', required: true },
      { id: 'password', label: 'סיסמה', type: 'password', required: true },
    ],
    metadata: {},
  };
}
const ready = (fieldId, locator, frame = null) => ({ fieldId, locator, frame, state: 'ready' });
const proposal = (lc, actionId, kind, locator, label) => ({ action: lc.createActionCandidate({ actionId, kind, label, locator }) });
const analyzeResult = (fields, actions = []) => ({ ok: true, actionProposals: actions, fieldAnalyze: { ok: true }, framedFieldProposals: fields });
const locs = (step) => (step?.fieldMappings ?? []).map((f) => `${f.fieldId}=${f.locator}`).join(',');

function harness(m, pattern) {
  const writes = [];
  const clicks = [];
  const queue = [];
  const clickQueue = [];
  globalThis.__api = async (name, args) => {
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    writes.push(args[1].metadata);
    return { updatedRows: 1, writerUserId: 'admin', writtenSpecialVersion: null };
  };
  globalThis.__analyze = async () => {
    assert(queue.length > 0, 'fixture: unexpected Analyze call');
    return queue.shift();
  };
  globalThis.__click = async (input) => {
    clicks.push({
      action: input.action,
      mode: m.lc.readinessModeFor(input.action),
      allowActionsOnly: input.allowActionsOnly,
      readinessTarget: input.readinessTarget,
    });
    const r = clickQueue.shift() ?? { ok: true };
    // The real helper / extension only report actions_only when it was requested.
    if (r.actionsOnly && input.allowActionsOnly !== true) return { ok: false, reason: 'surface_not_revealed', message: 'המסך לא נפתח' };
    return r;
  };
  globalThis.__pick = async (input) => ({ ok: true, locator: `#visual-${input.fieldId}`, frame: null });
  const view = m.mount(m.SpecialEditor, { row: makeRow(), onSaved: async () => {}, selectedPattern: pattern });
  return {
    view,
    clicks,
    enqueue: (r) => queue.push(r),
    clickNext: (r) => clickQueue.push(r),
    async analyze() {
      one(view.tree, 'special-analyze-current-tab').props.onClick();
      await view.settle();
    },
    async test(slot = 'primary') {
      one(view.tree, 'authoring-continue-click', (n) => n.props['data-slot'] === slot).props.onClick();
      await view.settle();
      await view.settle();
    },
    hasSlot(slot) {
      return findAll(view.tree, (n) => n.props?.['data-action'] === 'authoring-continue-click' && n.props['data-slot'] === slot).length === 1;
    },
    selectStep(stepId) {
      clickStep(view.tree, stepId);
      view.setProps({});
    },
    selectedStep() {
      return currentStep(view.tree);
    },
    text() {
      return textOf(view.tree);
    },
    async draft() {
      one(view.tree, 'save-special-draft').props.onClick();
      await view.settle();
      return writes.at(-1)[m.lc.LOGIN_FLOW_PLAN_META_KEY].draft;
    },
  };
}

/** Maccabi-shape authoring: «זהה» on A → «בדוק» «המשך» → choice screen → «בדוק» «כניסה עם סיסמה» → C. */
async function editorChoiceFlow(m, cIdLocator) {
  const { lc, bar } = m;
  const h = harness(m, 'MULTI_STEP');
  h.enqueue(analyzeResult([ready('username', '#id')], [proposal(lc, 'cont', 'intermediate_transition', '#cont', 'המשך')]));
  await h.analyze();

  h.clickNext({ ok: true, actionsOnly: true, revealedFrame: null });
  h.enqueue(
    analyzeResult(
      [ready('username', '#search')],
      [
        proposal(lc, 'pw', 'intermediate_transition', '#pwLogin', 'כניסה עם סיסמה'),
        proposal(lc, 'sms', 'intermediate_transition', '#sms', 'קוד ב-SMS'),
      ],
    ),
  );
  await h.test();
  const c1 = h.clicks[0];
  assert(c1 && c1.action.locator === '#cont' && c1.mode === 'reveal', `E1 «המשך» tested in reveal mode (got ${c1?.mode})`);
  assert(c1.allowActionsOnly === true && c1.readinessTarget === 'field', `E1 MULTI_STEP transition test requests actions_only (got ${c1.allowActionsOnly} / ${c1.readinessTarget})`);
  assert(h.text().includes(m.SPECIAL_EDITOR_COPY_HE.choiceScreenWithAction), 'E3 choice-screen copy shown');
  let d = await h.draft();
  assert(d.steps.length === 2, `E2 choice screen: step 2 created (got ${d.steps.length})`);
  assert(d.steps[0].exitTransition?.locator === '#cont' && bar.actionSelected(d.steps[0].exitTransition), 'E2 «המשך» chosen as step 1 exit (same as success)');
  assert(d.steps[1].fieldMappings.length === 0, `E2 step 2 stays action-only — no field written on the choice screen (got "${locs(d.steps[1])}")`);
  assert(locs(d.steps[0]) === 'username=#id', 'E2 step 1 unchanged');
  assert(lc.readinessModeFor(d.steps[0].exitTransition) === 'reveal', 'E2 readiness stays the pending marker until B\'s exit is chosen');
  assert(h.selectedStep() === 'step-2', `E2 selector on the choice step (got ${h.selectedStep()})`);
  assert(h.hasSlot('followUp'), 'E3 follow-up panel shows B\'s exit');

  h.clickNext({ ok: true, revealedFrame: null });
  h.enqueue(analyzeResult([ready('username', cIdLocator), ready('password', '#pass')]));
  await h.test('followUp');
  const c2 = h.clicks[1];
  assert(c2 && c2.action.locator === '#pwLogin', `E3 the follow-up is «כניסה עם סיסמה» (got ${c2?.action.locator})`);
  assert(c2.mode === 'reveal' && c2.allowActionsOnly === true, 'E3 B\'s exit tested in reveal mode');
  d = await h.draft();
  assert(d.steps.length === 3, `E4 B's exit creates step 3 (got ${d.steps.length})`);
  assert(d.steps[1].exitTransition?.locator === '#pwLogin' && bar.actionSelected(d.steps[1].exitTransition), 'E4 «כניסה עם סיסמה» = step 2 exitTransition (D-121-58 placement)');
  assert(d.steps[1].fieldMappings.length === 0, 'E4 step 2 still action-only');
  const exit1 = d.steps[0].exitTransition;
  assert(exit1.readiness.locator === '#pwLogin' && !exit1.readiness.frame, `B readiness into B = B's exit (got ${exit1.readiness.locator})`);
  assert(lc.readinessTargetFor(d, exit1) === 'action', 'B readiness target of «המשך» = action');
  assert(h.selectedStep() === 'step-3', `E4 selector on step 3 (got ${h.selectedStep()})`);
  return { h, d };
}

async function editorChecks(m) {
  const { lc, bar } = m;
  // E: C's ID is a new element → proposed and written; readiness of B's exit = C's ID.
  const { h, d } = await editorChoiceFlow(m, '#id2');
  assert(locs(d.steps[2]) === 'username=#id2,password=#pass', `E5 auto-Analyze writes C's new ID element + password (got "${locs(d.steps[2])}")`);
  assert(d.steps[1].exitTransition.readiness.locator === '#id2', `C readiness of B's exit = C's ID (same fieldId as step 1, other element) (got ${d.steps[1].exitTransition.readiness.locator})`);
  assert(lc.validateSpecialPlanComplete(d).ok && lc.validateSpecialRunnable(d).ok, `E6 authored draft complete + runnable (${JSON.stringify(lc.validateSpecialRunnable(d))})`);
  assert(bar.specialApproveGate(d).allowed === true, 'E6 «אשר מיפוי» allowed');

  // Re-test «המשך» with B's exit chosen: declared readiness on a button.
  h.selectStep('step-1');
  h.clickNext({ ok: true });
  h.enqueue(analyzeResult([], [proposal(lc, 'pw2', 'intermediate_transition', '#pwLogin', 'כניסה עם סיסמה')]));
  // D-121-67 A/B: «המשך» is step 1's stored exit → re-tested from step 1's own panel.
  await h.test('step');
  const c3 = h.clicks[2];
  assert(c3 && c3.action.locator === '#cont' && c3.mode === 'declared' && c3.readinessTarget === 'action', `B re-test «המשך»: declared, target action (got ${c3?.mode} / ${c3?.readinessTarget})`);
  const again = await h.draft();
  assert(again.steps[1].fieldMappings.length === 0 && lc.validateSpecialRunnable(again).ok, 'B re-test keeps step 2 action-only and runnable');

  // E: C's ID is the SAME element as A's → not proposed again.
  const same = await editorChoiceFlow(m, '#id');
  assert(locs(same.d.steps[2]) === 'password=#pass', `E5 the same element as step 1 is not proposed again (got "${locs(same.d.steps[2])}")`);

  // Choice screen with no proposed exit → the manual-pick copy.
  const n = harness(m, 'MULTI_STEP');
  n.enqueue(analyzeResult([ready('username', '#id')], [proposal(lc, 'cont', 'intermediate_transition', '#cont', 'המשך')]));
  await n.analyze();
  n.clickNext({ ok: true, actionsOnly: true, revealedFrame: null });
  n.enqueue(analyzeResult([], []));
  await n.test();
  assert(n.text().includes(m.SPECIAL_EDITOR_COPY_HE.choiceScreenNoAction), 'E7 manual-pick copy shown');
  const nd = await n.draft();
  assert(nd.steps.length === 2 && nd.steps[1].fieldMappings.length === 0 && !n.hasSlot('followUp'), 'E7 no exit found → action-only step 2, no follow-up');

  // FLOATING_SCREEN opener: actions_only never requested.
  const fs = harness(m, 'FLOATING_SCREEN');
  fs.enqueue(analyzeResult([], [proposal(lc, 'opener-1', 'floating_opener', '#logInBtn', 'כניסה')]));
  await fs.analyze();
  fs.enqueue(analyzeResult([ready('username', '#user'), ready('password', '#pass')]));
  await fs.test();
  assert(fs.clicks[0].allowActionsOnly === false, `D FLOATING_SCREEN opener never requests actions_only (got ${fs.clicks[0].allowActionsOnly})`);
}

// ---------------------------------------------------------------------------
// Pure (loginContract / action bar / routing)
// ---------------------------------------------------------------------------
function pureChecks(m) {
  const { lc, bar, routing } = m;
  const A = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#user')]);
  const t1 = lc.createActionCandidate({ actionId: 't1', kind: 'intermediate_transition', label: 'המשך', locator: '#next' });
  const t2 = lc.createActionCandidate({ actionId: 't2', kind: 'intermediate_transition', label: 'כניסה עם סיסמה', locator: '#pw-login' });
  const d1 = lc.rederiveRevealReadiness(lc.placeTransitionAsStepExit(A, 'step-1', bar.actionAfterTestSuccess(t1)));
  assert(d1.steps.length === 2 && !lc.isActionOnlyStep(d1, 1), 'P1 an empty LAST step is not action-only');
  assert(lc.readinessModeFor(d1.steps[0].exitTransition) === 'reveal', 'P1 unmapped step 2 → pending marker (reveal)');
  const d2 = lc.rederiveRevealReadiness(lc.placeTransitionAsStepExit(d1, 'step-2', bar.actionForTestPress(t2)));
  assert(d2.steps.length === 3 && lc.isActionOnlyStep(d2, 1), 'P2 step 2 with an exit and no fields is action-only');
  assert(lc.readinessModeFor(d2.steps[0].exitTransition) === 'reveal', 'P2 B\'s exit not chosen yet → readiness stays pending');
  assert(lc.readinessTargetFor(d2, d2.steps[0].exitTransition) === 'field', 'P2 target field while pending');
  const d3 = lc.rederiveRevealReadiness(lc.setStepExitTransition(d2, 'step-2', bar.actionAfterTestSuccess(t2)));
  const e1 = d3.steps[0].exitTransition;
  assert(e1.readiness.locator === '#pw-login' && !e1.readiness.frame && lc.readinessModeFor(e1) === 'declared', `P3 B's exit chosen → readiness of «המשך» = B's exit (got ${e1.readiness.locator})`);
  assert(lc.readinessTargetFor(d3, e1) === 'action', 'P3 readiness target = action');
  assert(bar.checkSpecialDraft(d3).complete === false, 'P3 step 3 unmapped → incomplete');
  const d4 = lc.rederiveRevealReadiness(lc.upsertStepFieldMappings(d3, 'step-3', [map('username', '#id2'), map('password', '#pass')]));
  assert(d4.steps[1].exitTransition.readiness.locator === '#id2' && lc.readinessTargetFor(d4, d4.steps[1].exitTransition) === 'field', 'P4 B\'s exit readiness = C\'s first field (target field)');
  assert(d4.steps[0].exitTransition.readiness.locator === '#pw-login', 'P4 «המשך» readiness unchanged');
  assert(lc.validateSpecialPlanComplete(d4).ok && lc.validateSpecialRunnable(d4).ok && bar.checkSpecialDraft(d4).complete, 'P4 complete + runnable');
  assert(lc.normalizeLegacyDraftReadiness(d4).steps[0].exitTransition.readiness.locator === '#pw-login', 'P4 draft normalization keeps the button readiness');
  const self = { ...bar.actionAfterTestSuccess(t2), locator: '#next' };
  const d5 = lc.rederiveRevealReadiness(lc.setStepExitTransition(d2, 'step-2', self));
  assert(d5.steps[0].exitTransition.readiness.locator === '[data-pv-pending-reveal]', `P5 B's exit = the action itself → never readiness (pending) (got ${d5.steps[0].exitTransition.readiness.locator})`);
  const fsms = { ...lc.deepClonePlanDocument(d4), pattern: 'FLOATING_SCREEN_MULTI_STEP' };
  assert(!lc.isActionOnlyStep(fsms, 1) && !lc.isActionOnlyStep(d4, 0) && !lc.isActionOnlyStep(d4, 2), 'P6 action-only = MULTI_STEP middle steps only');
  const rep = lc.rederiveRevealReadiness(lc.upsertStepFieldMappings(d1, 'step-2', [map('username', '#user2'), map('password', '#pass')]));
  assert(rep.steps[0].exitTransition.readiness.locator === '#user2', 'P7 C: a later step\'s element for the same fieldId is valid readiness');
  const repSame = lc.rederiveRevealReadiness(lc.upsertStepFieldMappings(d1, 'step-2', [map('username', '#user'), map('password', '#pass')]));
  assert(repSame.steps[0].exitTransition.readiness.locator === '#pass', 'P7 C: the same element as step 1 is skipped (locator + frame)');
  const obs = (id, visibleText) => ({ actionCandidateId: id, tagName: 'button', locator: `#${id}`, locatorType: 'css', matchCount: 1, label: visibleText, visibleText });
  const ranked = routing.proposeSpecialActionCandidates({ pattern: 'MULTI_STEP', actionCandidates: [obs('sms', 'קוד ב-SMS'), obs('voice', 'קוד בשיחה קולית'), obs('pw', 'כניסה עם סיסמה')] });
  assert(ranked[0].actionCandidateId === 'pw', `P8 Analyze ranks «כניסה עם סיסמה» first on the choice screen (got ${ranked.map((p) => p.actionCandidateId)})`);
}

// ---------------------------------------------------------------------------
// Static
// ---------------------------------------------------------------------------
function staticChecks() {
  const fns = ['collectSpecialRevealActions', 'specialAuthoringActionGone'].map((n) => extractFunction(BG_SRC, n)).join('\n');
  assert(!/hostname|serviceId|maccabi|getFrameId|webNavigation|debugger/i.test(fns), 'S1 no site / host / frame-id APIs in the actions_only helpers');
  assert(!/\.submit\(|requestSubmit|\.click\(/.test(fns), 'S1 actions_only helpers never click / submit');
  assert(fns.includes('collectSpecialAuthoringActionCandidates') && fns.includes('helpers.actionRankTier'), 'S2 fresh actions use the Analyze collector + vocabulary tiers');
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  assert(!/maccabi|מכבי/i.test(ui), 'S1 no site names in the editor');
  const helper = read('src/assistedMapping/currentTabAuthoring.ts');
  assert(helper.includes("...(input.allowActionsOnly === true && readinessMode === 'reveal' ? { allowActionsOnly: true } : {}),"), 'S3 Hub requests actions_only in reveal mode only');
  assert(helper.includes('...(response.actionsOnly === true && input.allowActionsOnly === true ? { actionsOnly: true } : {}),'), 'S3 Hub accepts actions_only only when it asked');
  assert(BG_SRC.includes("var SPECIAL_RESERVED_ACTION_KINDS = ['final_submit'];"), 'S4 final_submit reserved');
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(!(manifest.permissions || []).some((p) => p === 'webNavigation' || p === 'debugger'), 'S4 manifest: no webNavigation / debugger');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
out('Phase 121 D-121-63 — choice screens and repeated fields in MULTI_STEP\n');

const LC = await bundle('src/loginContract/index.ts', 'lc');
const BAR = await bundle('src/admin/specialActionBar.ts', 'bar');
const HUB = await bundle('src/execution/specialLoginFlow.ts', 'hub');
const UI = await loadEditor();

await fixtureChoice(FIX.SAME_PAGE);
ok('CH-F-SAME-PAGE A → B → C: ID on A, «המשך», readiness = B\'s exit (button), B not filled, «כניסה עם סיסמה», ID + password on C; never submits');
await fixtureChoice(FIX.NAVIGATION);
ok('CH-F-NAVIGATION same flow with a navigation after each transition');
await fixtureBExitMissing();
ok('CH-F-B-EXIT-MISSING choice screen without B\'s exit → readiness_timeout at step 2 / exit-1, C values never sent');

await gateParity({ hub: HUB, lc: LC, bar: BAR });
ok(`A/B/C GATE validator + completeness line + Hub gate + Hub run ≡ Ext on ${gateCases().length} plans; union credentials; own subsets`);

await authoringChecks();
ok('D actions_only only when the tested button is gone AND a fresh vocabulary action appeared; no-change / plain-only / still-there / not-fresh fail; fresh field wins; declared button readiness');

pureChecks(UI);
ok('B/C derive: pending until B\'s exit is chosen, then B\'s exit (never the action itself); repeated fieldId readiness by locator + frame; Analyze ranks «כניסה עם סיסמה» first');

await editorChecks(UI);
ok('D/E editor: choice screen → chosen «המשך», action-only step 2, follow-up «כניסה עם סיסמה» → step 3 → C\'s new ID written, same element not; re-test declared on the button; FLOATING unchanged');

staticChecks();
ok('STATIC no site branches / frame-id APIs; Analyze vocabulary reused; Hub flag gating; final_submit reserved; manifest unchanged');
{
  const leaked = LOGS.filter((line) => SECRETS.some((s) => line.includes(s)));
  assert(leaked.length === 0, `credential value logged:\n${leaked.slice(0, 3).join('\n')}`);
  ok(`LOGS no credential value in ${LOGS.length} captured lines`);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
out('\nMutations');
async function expectCaught(label, fn) {
  let caught = null;
  try {
    await fn();
  } catch (err) {
    caught = String((err && err.message) || err).split('\n')[0];
  }
  assert(caught, `MUTATION NOT CAUGHT: ${label}`);
  assert(!caught.startsWith('fixture:') && !caught.includes('anchor "'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  ok(`mutation caught: ${label}  [${caught.slice(0, 110)}]`);
}
const mutBg = (from, to, label) => replaceOnce(BG_SRC, from, to, label);
const parityWith = (bgSrc) => gateParity({ hub: HUB, lc: LC, bar: BAR, bgSrc });

await expectCaught('MX1 Ext fills the action-only step → same-page fixture', () =>
  fixtureChoice(FIX.SAME_PAGE, mutBg('        if (step.fieldMappings.length === 0) {\n          runTransition(index);\n          return;\n        }\n', '', 'MX1')),
);
await expectCaught('MX2 Ext allows an action-only LAST step → gate parity', () =>
  parityWith(mutBg('specialRuntimeStepRows(steps[s].fieldMappings, s > 0 && s < last)', 'specialRuntimeStepRows(steps[s].fieldMappings, s > 0)', 'MX2')),
);
await expectCaught('MX3 Ext allows step 1 without fields → gate parity', () =>
  parityWith(mutBg('specialRuntimeStepRows(steps[s].fieldMappings, s > 0 && s < last)', 'specialRuntimeStepRows(steps[s].fieldMappings, s < last)', 'MX3')),
);
await expectCaught('MX4 Ext readiness into an action-only step may be any element → gate parity', () =>
  parityWith(mutBg('      r.locator === revealedExit.locator &&\n', '      true &&\n', 'MX4')),
);
await expectCaught('MX5 Ext readiness into B checked as a field → same-page fixture', () =>
  fixtureChoice(FIX.SAME_PAGE, mutBg("    target: toAction ? 'action' : 'field',", "    target: 'field',", 'MX5')),
);
await expectCaught('MX6 Ext keeps the 121.3 "fieldId unique across steps" rule → gate parity', () =>
  parityWith(
    mutBg(
      '    allRows.push(rows);\n  }\n  var out = [];',
      '    if (rows.some(function (r) { return allRows.some(function (p) { return p.some(function (q) { return q.fieldId === r.fieldId; }); }); })) return shape;\n    allRows.push(rows);\n  }\n  var out = [];',
      'MX6',
    ),
  ),
);
await expectCaught('MX7 authoring ignores whether the tested button is gone → authoring', () =>
  authoringChecks(mutBg('            if (!gone) {', '            if (false) {', 'MX7')),
);
await expectCaught('MX8 authoring counts actions that were eligible before the click → authoring', () =>
  authoringChecks(mutBg('return !actionsBefore.keys[e.key] && !actionsBefore.skipped', 'return !actionsBefore.skipped', 'MX8')),
);
await expectCaught('MX9 authoring actions_only without the Hub flag → authoring', () =>
  authoringChecks(mutBg("readinessMode === 'reveal' && !requirePasswordSurface && message.allowActionsOnly === true;", "readinessMode === 'reveal' && !requirePasswordSurface;", 'MX9')),
);
await expectCaught('MX10 authoring counts plain actions (outside the vocabulary) → authoring', () =>
  authoringChecks(mutBg('c.popupSemantics === true) <= 2', 'c.popupSemantics === true) <= 3', 'MX10')),
);
await expectCaught('MX11 button readiness checked as a field → authoring', () =>
  authoringChecks(mutBg("          if (target === 'action') {", '          if (false) {', 'MX11')),
);
await expectCaught('MX12 authoring never tries actions_only at the deadline → authoring', () =>
  authoringChecks(mutBg('            if (allowActionsOnly && !actionsOnlyTried) {', '            if (false) {', 'MX12')),
);

const VAL = 'src/loginContract/validateSpecialPlan.ts';
const GATE = 'src/loginContract/runtimeGate.ts';
const AUTH = 'src/loginContract/specialDraftAuthoring.ts';
async function hubMutation(label, transforms) {
  const tag = label.split(' ')[0].toLowerCase();
  const lc = await bundle('src/loginContract/index.ts', `lc${tag}`, { transforms });
  const bar = await bundle('src/admin/specialActionBar.ts', `bar${tag}`, { transforms });
  const hub = await bundle('src/execution/specialLoginFlow.ts', `hub${tag}`, { transforms });
  await expectCaught(label, () => gateParity({ hub, lc, bar }));
}
await hubMutation('MH1 validator rejects the action-only step → completeness', [[VAL, '    if (isActionOnlyStep(plan, s)) {\n      stepMappings.push([]);\n      continue;\n    }\n', '']]);
await hubMutation('MH2 validator readiness into B may be any element → completeness', [
  [VAL, '      ? action.readiness.locator === revealedStepExit.locator &&\n        sameFrame(action.readiness.frame, revealedStepExit.frame)', '      ? true'],
]);
await hubMutation('MH3 Hub gate rejects the action-only step → gate parity', [[GATE, 'stepRows(steps[s]!.fieldMappings, s > 0 && s < last)', 'stepRows(steps[s]!.fieldMappings)']]);
await hubMutation('MH4 Hub gate readiness into B may be any element → gate parity', [
  [GATE, '      ? revealedExit !== null &&\n        readiness.locator === revealedExit.locator &&\n        sameFrame(readiness.frame, revealedExit.frame)', '      ? true'],
]);
await hubMutation('MH5 Hub gate keeps "fieldId unique across steps" → gate parity', [
  [GATE, '    allRows.push(rows);\n  }\n', "    if (rows.some((r) => allRows.some((p) => p.some((q) => q.fieldId === r.fieldId)))) return { ok: false, reason: 'plan_shape_unsupported' };\n    allRows.push(rows);\n  }\n"],
]);

const UI_FILE = 'src/admin/SpecialLoginDraftEditor.tsx';
const FOLLOW = 'src/assistedMapping/followUpSelection.ts';
async function uiMutation(label, file, pairs, run = async (m) => { pureChecks(m); await editorChecks(m); }) {
  let src = read(file);
  for (const [from, to] of pairs) src = replaceOnce(src, from, to, label);
  const m = await loadEditor({ [file]: src });
  await expectCaught(label, () => run(m));
}
await uiMutation('MD1 derive ignores the action-only step exit → pure derive', AUTH, [['  if (exitIdx < 0 || !isActionOnlyStep(draft, exitIdx + 1)) return null;', '  return null;']]);
await uiMutation('MD2 derive may use the action itself as B\'s exit → pure derive', AUTH, [['  if (exit.locator === action.locator && sameFrame(exit.frame, action.frame)) return null;\n', '']]);
await uiMutation('MD3 derive before B\'s exit is chosen → pure derive', AUTH, [['  if (!(exit.approvedForAuthoringContinuation && exit.approvedForRuntime)) return null;\n', '']]);
await uiMutation('ME1 editor never requests actions_only → editor', UI_FILE, [["        allowActionsOnly: consentDraft.pattern === 'MULTI_STEP' && action.kind === 'intermediate_transition',", '        allowActionsOnly: false,']]);
await uiMutation('ME2 editor requests actions_only for openers too → editor', UI_FILE, [["        allowActionsOnly: consentDraft.pattern === 'MULTI_STEP' && action.kind === 'intermediate_transition',", '        allowActionsOnly: true,']]);
await uiMutation('ME3 editor writes fields on the choice screen → editor', UI_FILE, [
  ['    if (fieldsWritable && !afterTest?.actionsOnly && result.ok && result.fieldAnalyze.ok) {', '    if (fieldsWritable && result.ok && result.fieldAnalyze.ok) {'],
]);
await uiMutation('ME4 editor keeps the same-kind skip after a choice screen → editor', UI_FILE, [['            testedGone: Boolean(afterTest.actionsOnly),', '            testedGone: false,']]);
await uiMutation('ME5 follow-up rule ignores testedGone → editor', FOLLOW, [['    if (!input.testedGone && candidate.kind === input.tested.kind', '    if (candidate.kind === input.tested.kind']]);
await uiMutation('ME6 choice-screen follow-up looks at field surfaces → editor', UI_FILE, [['              ? new Set([frameKey(afterTest.actionsOnly.frame)])', '              ? new Set<string>()']]);
await uiMutation('ME7 E: earlier fieldId skipped regardless of element (D-121-58 rule) → editor', UI_FILE, [
  ['            (m) => m.fieldId === p.fieldId && m.locator === p.locator && sameFrame(m.frame, p.frame),', '            (m) => m.fieldId === p.fieldId,'],
]);
await uiMutation('ME8 E: the same element is proposed again → editor', UI_FILE, [
  ['          earlierMappings.some(\n            (m) => m.fieldId === p.fieldId && m.locator === p.locator && sameFrame(m.frame, p.frame),\n          )', '          false'],
]);
await uiMutation('ME9 editor does not pass the button readiness target → editor', UI_FILE, [['        readinessTarget: readinessTargetFor(consentDraft, action),\n', '']]);

out(`\nPASS — D-121-63 choice screens verify (${passed} checks)`);
process.exit(0);
