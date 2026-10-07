/**
 * Phase 121.2-impl (+ D-121-39) — SPECIAL login flow runtime (FLOATING_SCREEN).
 *
 * RT-8.1 fixtures run the REAL extension/background.js orchestrator (router →
 * runSpecialLoginFlow) against the REAL content scripts injected into linkedom
 * top / depth-1 frame windows (mock chrome.tabs / chrome.scripting only).
 * Hub: entry, A2 presentation, A3 fail-closed, snapshot, Digital Home routing.
 * D-121-39: opt-in declared-frame mode of the Phase 120 runner. Mutations must be caught.
 *
 * Usage: node scripts/verifyPhase121Runtime.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';
import { revertD12142BackgroundEdits } from './lib/phase121D42BackgroundEdits.mjs';
import { revertD12147BackgroundEdits } from './lib/phase121D47BackgroundEdits.mjs';
import { revertD12148BackgroundEdits } from './lib/phase121D48BackgroundEdits.mjs';
import { revertD12160BackgroundEdits } from './lib/phase121D60BackgroundEdits.mjs';
import { revertD12161BackgroundEdits } from './lib/phase121D61BackgroundEdits.mjs';
import { revertD12161CorrelationEdits } from './lib/phase121D61CorrelationEdits.mjs';
import { revertD12163BackgroundEdits } from './lib/phase121D63BackgroundEdits.mjs';
import { revertD12163ValidatorEdits } from './lib/phase121D63ValidatorEdits.mjs';
import { revertD12149EligibilityEdits } from './lib/phase121D49EligibilityEdits.mjs';
import { revertD12171EligibilityEdits } from './lib/phase121D71Edits.mjs';
import { revertD12172BackgroundOutsideEdits, revertD12172ManagedAutofillEdits } from './lib/phase121D72Edits.mjs';
import { revertD12170ValidatedAutofillEdits } from './lib/phase121D70ValidatedAutofillEdits.mjs';
import { withTempDir } from './lib/tempDir.mjs';
import { revertPhase126PartAManifest } from './lib/phase126PartA.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
/** Stub import specifier (stubs resolve from the repo root; absolute C:/ paths look like packages). */
const abs = (rel) => `./${rel}`;
const sha = (text) => createHash('sha256').update(text).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

// Page scripts and the background log through console; capture everything so the
// run can assert that no credential value is ever logged.
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

const TOP_ORIGIN = 'https://top.example.test';
const FRAME_ORIGIN = 'https://frame.example.test';
const OTHER_ORIGIN = 'https://other.example.test';
const ENTRY_URL = `${TOP_ORIGIN}/home`;
const FRAME_LOCATOR = 'iframe#login-frame';
const CREDS = { username: 'rt-user-7d1f', password: 'rt-pass-S3cr3t-91' };
const SECRETS = [CREDS.username, CREDS.password, 'hub-user-q8', 'hub-pass-W4z', 'dh-pass-Z9k'];

const MODAL_FORM =
  '<form id="login-form"><input id="user" type="text" name="u"><input id="pass" type="password" name="p">' +
  '<button id="login-btn" type="submit">Login</button></form>';
const TOP_HTML =
  '<!doctype html><html><head><title>Home</title></head><body><header>' +
  '<button id="open-login" type="button">Open</button><button id="site-login" type="button">Site</button>' +
  '</header><main><p>Welcome</p></main></body></html>';
const FRAME_DOC = `<!doctype html><html><head><title>Login</title></head><body>${MODAL_FORM}</body></html>`;
const BLANK_DOC = '<!doctype html><html><head></head><body></body></html>';

let passed = 0;
function ok(label) {
  passed += 1;
  out(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Sources + sandbox speed-ups (asserted text replacements on in-memory copies)
// ---------------------------------------------------------------------------
function replaceOnce(src, from, to, label) {
  assert(src.includes(from), `sandbox patch target missing: ${label}`);
  return src.replace(from, to);
}

const BG_SRC = read('extension/background.js');
function speedUp(src) {
  let s = src;
  s = replaceOnce(s, 'var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 25;', 'poll');
  s = replaceOnce(s, 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 10;', 'handshake');
  s = replaceOnce(s, 'const MANAGED_AUTOFILL_RETRY_DELAY_MS = 300;', 'const MANAGED_AUTOFILL_RETRY_DELAY_MS = 10;', 'retry');
  s = replaceOnce(
    s,
    'const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 120000;',
    'const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 300;',
    'tab load timeout',
  );
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

function setLocation(win, origin, protocol = 'https:') {
  def(win, 'location', {
    origin,
    protocol,
    href: protocol === 'about:' ? 'about:blank' : `${origin}/`,
  });
}

/**
 * linkedom's defaultView proxies writes through to Node's globalThis, so two windows
 * would share `top` / `parent` / script globals. Each simulated window gets its own
 * property bag layered over the linkedom view (document, DOM classes, getComputedStyle).
 */
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

function makeWin(html, origin, protocol = 'https:') {
  const window = isolatedWindow(html);
  setLocation(window, origin, protocol);
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

function loadPageScript(win, rel, sources) {
  const src = (sources && sources[rel]) || PAGE_SRC[rel];
  assert(typeof src === 'string', `unknown page script ${rel}`);
  const key = `${rel}\n${sha(src)}`;
  let fn = compiledPage.get(key);
  if (!fn) {
    fn = new Function(
      'window',
      'document',
      'globalThis',
      'Event',
      'InputEvent',
      'KeyboardEvent',
      `${src}\n//# sourceURL=${rel}`,
    );
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

/** chrome.scripting `func` runs with the page window as its global scope. */
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
  return new Function('__scope', '__args', `with (__scope) { return (${String(func)}).apply(null, __args); }`)(
    scope,
    args,
  );
}

// ---------------------------------------------------------------------------
// Tab / frame simulator (mock chrome.* only; page logic is the real scripts)
// ---------------------------------------------------------------------------
class Sim {
  constructor(cfg) {
    this.cfg = cfg;
    this.frames = new Map();
    this.nextId = 11;
    this.calls = [];
    this.tabCreates = [];
    this.pageErrors = [];
    this.counters = { opener: 0, submit: 0, loginBtn: 0, siteLogin: 0, formSubmitCall: 0 };
    this.updatedListeners = new Set();
    this.tab = null;
    this.readinessHookFired = false;
    this.listener = null;
    const top = makeWin(cfg.topHtml || TOP_HTML, TOP_ORIGIN);
    def(top, 'top', top);
    def(top, 'parent', top);
    this.top = top;
    this.frames.set(0, { id: 0, parentId: null, win: top });
    for (const el of top.document.querySelectorAll('#open-login, .open-login')) {
      el.addEventListener('click', () => {
        this.counters.opener += 1;
        if (cfg.onOpener) cfg.onOpener(this);
      });
    }
    const site = top.document.querySelector('#site-login');
    if (site) site.addEventListener('click', () => (this.counters.siteLogin += 1));
    this.chrome = this.makeChrome();
    if (cfg.setup) cfg.setup(this);
  }

  wireForm(win) {
    const form = win.document.querySelector('#login-form');
    const btn = win.document.querySelector('#login-btn');
    if (form) {
      form.addEventListener('submit', () => (this.counters.submit += 1));
      form.submit = () => (this.counters.formSubmitCall += 1);
      form.requestSubmit = () => (this.counters.formSubmitCall += 1);
    }
    if (btn) btn.addEventListener('click', () => (this.counters.loginBtn += 1));
  }

  revealTopModal() {
    const div = this.top.document.createElement('div');
    div.setAttribute('id', 'modal');
    div.innerHTML = MODAL_FORM;
    this.top.document.body.appendChild(div);
    this.wireForm(this.top);
  }

  addFrame(html, origin, protocol = 'https:', attrs = { id: 'login-frame' }) {
    const el = this.top.document.createElement('iframe');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    this.top.document.body.appendChild(el);
    const id = this.nextId++;
    const rec = { id, parentId: 0, el, win: null };
    this.frames.set(id, rec);
    Object.defineProperty(el, 'contentWindow', { get: () => rec.win, configurable: true });
    this.navigate(id, html, origin, protocol);
    return rec;
  }

  navigate(id, html, origin, protocol = 'https:') {
    const rec = this.frames.get(id);
    const w = makeWin(html, origin, protocol);
    def(w, 'parent', this.frames.get(rec.parentId).win);
    def(w, 'top', this.top);
    rec.win = w;
    this.wireForm(w);
    return w;
  }

  frameWin() {
    const rec = [...this.frames.values()].find((r) => r.id !== 0);
    return rec ? rec.win : null;
  }

  fireGesture(win, type = 'pointerdown') {
    for (const fn of (win.__pvListeners[type] || []).slice()) fn({ type, isTrusted: true });
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
          setTimeout(() => sim.completeLoad(props.url), 5);
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

  completeLoad(url) {
    if (this.cfg.preloadRedirect) {
      this.tab.url = `${OTHER_ORIGIN}/elsewhere`;
      setLocation(this.top, OTHER_ORIGIN);
    } else {
      this.tab.url = url;
    }
    this.tab.status = 'complete';
    for (const fn of [...this.updatedListeners]) fn(1, { status: 'complete' }, { ...this.tab });
    if (this.cfg.postLoadRedirect) {
      setTimeout(() => {
        this.tab.url = `${OTHER_ORIGIN}/elsewhere`;
        setLocation(this.top, OTHER_ORIGIN);
      }, 0);
    }
  }

  executeScript(details, done) {
    const target = details.target || {};
    const ids = target.allFrames ? [...this.frames.keys()] : (target.frameIds || [0]).slice();
    setTimeout(async () => {
      if (!target.allFrames && ids.some((id) => !this.frames.has(id))) {
        done(`No frame with id ${ids.join(',')}`);
        return;
      }
      const name = details.func ? details.func.name || 'anonymous' : null;
      if (this.cfg.gestureInstallFails && name === 'specialGestureWatchInstall') {
        done('Cannot access contents of the page');
        return;
      }
      this.calls.push({
        ids: ids.slice(),
        allFrames: Boolean(target.allFrames),
        files: details.files ? details.files.slice() : null,
        name,
        funcSrc: details.func ? String(details.func) : '',
        argsJson: JSON.stringify(details.args || []),
      });
      if (details.files) {
        try {
          for (const id of ids) {
            const win = this.frames.get(id).win;
            for (const rel of details.files) loadPageScript(win, rel, this.cfg.sources);
          }
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
    return this.calls.filter((c) => SECRETS.some((s) => c.argsJson.includes(s)));
  }

  correlationInjections() {
    return this.calls.filter((c) => c.files && c.files.includes('generic/frame-correlation.js'));
  }
}

function loadBackground(sim, bgSrc) {
  const bgConsole = {
    log: (...a) => LOGS.push(fmtLog(a)),
    info: (...a) => LOGS.push(fmtLog(a)),
    warn: (...a) => LOGS.push(fmtLog(a)),
    error: (...a) => LOGS.push(fmtLog(a)),
  };
  const factory = new Function(
    'chrome',
    'console',
    `${speedUp(bgSrc)}\n;return { specialValidateRunPlan: specialValidateRunPlan };`,
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

function baseMessage(plan, overrides = {}) {
  return {
    type: 'HUB_SPECIAL_LOGIN_FLOW',
    runId: 'rt-run-1',
    entryUrl: ENTRY_URL,
    allowedOrigin: TOP_ORIGIN,
    plan,
    credentials: { ...CREDS },
    diagnosticPath: 'admin_test',
    ...overrides,
  };
}

async function extRun(cfg, message, opts = {}) {
  const sim = new Sim(cfg);
  const api = loadBackground(sim, opts.bgSrc || BG_SRC);
  assert(typeof sim.listener === 'function', 'router listener registered');
  let listenerReturn;
  const response = await withDeadline(
    new Promise((resolve) => {
      listenerReturn = sim.listener(message, { tab: { id: 99, index: 2 } }, resolve);
    }),
    8000,
    cfg.name || 'ext run',
  );
  await sleep(40);
  return { sim, response, listenerReturn, api };
}

function runExt(cfg, overrides = {}, opts = {}) {
  return extRun(cfg, baseMessage(cfg.plan, overrides), opts);
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
function makePlan({ frame = null, openerLocator = '#open-login', readinessTimeout = 3000, pattern = 'FLOATING_SCREEN' } = {}) {
  const f = frame ? { frame: { ...frame } } : {};
  return {
    planVersion: 3,
    pattern,
    preambleActions: [
      {
        actionId: 'opener-1',
        kind: 'floating_opener',
        label: 'Open login',
        locatorType: 'css',
        locator: openerLocator,
        approvedForRuntime: true,
        readiness: {
          kind: 'exact_one_eligible_css',
          locatorType: 'css',
          locator: '#user',
          timeoutMs: readinessTimeout,
          ...(frame ? { frame: { ...frame } } : {}),
        },
      },
    ],
    steps: [
      {
        stepId: 'step-credentials',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user', ...f },
          { fieldId: 'password', locatorType: 'css', locator: '#pass', ...(frame ? { frame: { ...frame } } : {}) },
        ],
      },
    ],
  };
}
const CROSS_FRAME = { frameLocator: FRAME_LOCATOR, frameOrigin: FRAME_ORIGIN };
const SAME_FRAME = { frameLocator: FRAME_LOCATOR, frameOrigin: TOP_ORIGIN };

// ---------------------------------------------------------------------------
// Fixtures (RT-8.1)
// ---------------------------------------------------------------------------
const FIX = {
  TOP: {
    name: 'RT-F-TOP',
    plan: makePlan(),
    onOpener: (sim) => setTimeout(() => sim.revealTopModal(), 40),
  },
  SAME: {
    name: 'RT-F-SAME',
    plan: makePlan({ frame: SAME_FRAME }),
    setup: (sim) => sim.addFrame(BLANK_DOC, TOP_ORIGIN),
    onOpener: (sim) =>
      setTimeout(() => {
        const w = sim.frameWin();
        const div = w.document.createElement('div');
        div.innerHTML = MODAL_FORM;
        w.document.body.appendChild(div);
        sim.wireForm(w);
      }, 40),
  },
  CROSS: {
    name: 'RT-F-CROSS',
    plan: makePlan({ frame: CROSS_FRAME }),
    onOpener: (sim) => setTimeout(() => sim.addFrame(FRAME_DOC, FRAME_ORIGIN), 40),
  },
  LATE: {
    name: 'RT-F-LATE',
    plan: makePlan({ frame: CROSS_FRAME }),
    onOpener: (sim) =>
      setTimeout(() => {
        // about:blank inherits the parent origin — must read as "loading", not foreign.
        const rec = sim.addFrame(BLANK_DOC, TOP_ORIGIN, 'about:');
        setTimeout(() => sim.navigate(rec.id, FRAME_DOC, FRAME_ORIGIN), 150);
      }, 20),
  },
  SWAP: {
    name: 'RT-F-SWAP',
    plan: makePlan({ frame: CROSS_FRAME }),
    onOpener: (sim) => setTimeout(() => sim.addFrame(FRAME_DOC, FRAME_ORIGIN), 40),
    afterReadinessMet: (sim) => {
      const rec = [...sim.frames.values()].find((r) => r.id !== 0);
      sim.navigate(rec.id, FRAME_DOC, OTHER_ORIGIN);
    },
  },
  R1: {
    name: 'RT-F-R1',
    plan: makePlan(),
    postLoadRedirect: true,
    onOpener: (sim) => setTimeout(() => sim.revealTopModal(), 40),
  },
  PRELOAD: {
    name: 'RT-F-R1-PRELOAD',
    plan: makePlan(),
    preloadRedirect: true,
    onOpener: (sim) => setTimeout(() => sim.revealTopModal(), 40),
  },
  OPENER0: {
    name: 'RT-F-OPENER-0',
    plan: makePlan({ readinessTimeout: 200 }),
    topHtml: TOP_HTML.replace('<button id="open-login" type="button">Open</button>', ''),
  },
  OPENER2: {
    name: 'RT-F-OPENER-2',
    plan: makePlan({ openerLocator: '.open-login', readinessTimeout: 200 }),
    topHtml: TOP_HTML.replace(
      '<button id="open-login" type="button">Open</button>',
      '<button class="open-login" type="button">A</button><button class="open-login" type="button">B</button>',
    ),
  },
  TIMEOUT: {
    name: 'RT-F-TIMEOUT',
    plan: makePlan({ readinessTimeout: 200 }),
  },
  GESTURE: {
    name: 'RT-GESTURE (trusted pointerdown before readiness)',
    plan: makePlan(),
    onOpener: (sim) => {
      setTimeout(() => sim.fireGesture(sim.top), 10);
      setTimeout(() => sim.revealTopModal(), 60);
    },
  },
  GESTURE_NO_WATCH: {
    name: 'RT-GESTURE (watch install fails)',
    plan: makePlan(),
    gestureInstallFails: true,
    onOpener: (sim) => setTimeout(() => sim.revealTopModal(), 40),
  },
};

function runnerArgs(sim) {
  return sim
    .credentialCalls()
    .map((c) => ({ ids: c.ids, name: c.name, args: JSON.parse(c.argsJson) }));
}

function assertNoPageErrors(sim, label) {
  assert(sim.pageErrors.length === 0, `${label}: page script errors:\n${sim.pageErrors.join('\n')}`);
}

function assertFilledIn(win, label) {
  const u = win.document.querySelector('#user');
  const p = win.document.querySelector('#pass');
  assert(u && u.value === CREDS.username, `${label}: username filled`);
  assert(p && p.value === CREDS.password, `${label}: password filled`);
}

function assertNoSubmit(sim, label) {
  const c = sim.counters;
  assert(c.submit === 0 && c.loginBtn === 0 && c.formSubmitCall === 0 && c.siteLogin === 0, `${label}: never submits (${JSON.stringify(c)})`);
}

function assertSuccess(res, frameKey, label) {
  const r = res.response;
  assert(r.ok === true && r.state === 'STOPPED_FOR_USER', `${label}: STOPPED_FOR_USER (${JSON.stringify(r)})`);
  assert(r.stage === 'fill' && r.frameKey === frameKey, `${label}: stage fill frameKey ${frameKey} (got ${r.frameKey})`);
  assert(r.filled === 2, `${label}: filled 2`);
  assert(r.tabOpened === true && r.stepId === 'step-credentials' && r.actionId === 'opener-1', `${label}: ids`);
  assert(res.listenerReturn === true, `${label}: async router return`);
}

function assertOneRunnerCall(res, frameId, expectedOrigin, label) {
  const calls = runnerArgs(res.sim);
  assert(calls.length >= 1, `${label}: runner received credentials`);
  for (const c of calls) {
    assert(c.ids.length === 1 && c.ids[0] === frameId, `${label}: credentials only to frame ${frameId} (got ${c.ids})`);
    const o = c.args[0];
    const keys = Object.keys(o).sort().join(',');
    const expectedKeys = frameId === 0
      ? 'allowedOrigin,credentials,diagnosticPath,fieldMappings'
      : 'allowedOrigin,credentials,diagnosticPath,fieldMappings,frameContext';
    assert(keys === expectedKeys, `${label}: runner option keys ${keys}`);
    assert(o.allowedOrigin === expectedOrigin, `${label}: runner allowedOrigin ${o.allowedOrigin}`);
    if (frameId !== 0) {
      assert(JSON.stringify(o.frameContext) === JSON.stringify({ mode: 'declared_depth1' }), `${label}: frameContext`);
    }
    assert(Object.keys(o.credentials).sort().join(',') === 'password,username', `${label}: mapped credentials only`);
  }
}

async function fixtureTop(bgSrc) {
  const res = await runExt(FIX.TOP, {}, { bgSrc });
  assertNoPageErrors(res.sim, 'RT-F-TOP');
  assertSuccess(res, 'top', 'RT-F-TOP');
  assertFilledIn(res.sim.top, 'RT-F-TOP');
  assertOneRunnerCall(res, 0, TOP_ORIGIN, 'RT-F-TOP');
  assert(res.sim.correlationInjections().length === 0, 'RT-F-TOP offline: no frame correlation used');
  assert(res.sim.counters.opener === 1, 'RT-F-TOP: opener clicked once');
  assert(res.response.userGestureDuringRun === false, 'RT-F-TOP: no gesture → false');
  assertNoSubmit(res.sim, 'RT-F-TOP');
  return res;
}

async function fixtureFrame(fix, frameOrigin, bgSrc) {
  const res = await runExt(fix, {}, { bgSrc });
  assertNoPageErrors(res.sim, fix.name);
  const frameRec = [...res.sim.frames.values()].find((r) => r.id !== 0);
  assertSuccess(res, `${FRAME_LOCATOR}|${frameOrigin}`, fix.name);
  assertFilledIn(frameRec.win, fix.name);
  assertOneRunnerCall(res, frameRec.id, frameOrigin, fix.name);
  assert(!res.sim.top.document.querySelector('#user'), `${fix.name}: nothing filled in top`);
  assertNoSubmit(res.sim, fix.name);
  return res;
}

async function fixtureSwap(bgSrc) {
  const res = await runExt(FIX.SWAP, {}, { bgSrc });
  assertNoPageErrors(res.sim, 'RT-F-SWAP');
  const r = res.response;
  assert(r.ok === false && r.state === 'FAILED', 'RT-F-SWAP: failed');
  assert(r.stage === 'frame' && r.reason === 'frame_origin_mismatch', `RT-F-SWAP: frame_origin_mismatch (${r.stage}/${r.reason})`);
  assert(r.liveOrigin === OTHER_ORIGIN, 'RT-F-SWAP: liveOrigin reported');
  assert(res.sim.credentialCalls().length === 0, 'RT-F-SWAP: credentials never left the Ext');
  const w = res.sim.frameWin();
  assert(w.document.querySelector('#user').value === '', 'RT-F-SWAP: swapped frame untouched');
  return res;
}

async function fixtureR1(bgSrc) {
  const res = await runExt(FIX.R1, {}, { bgSrc });
  const r = res.response;
  assert(r.ok === false && r.stage === 'r1' && r.reason === 'origin_mismatch', `RT-F-R1: r1 origin_mismatch (${r.stage}/${r.reason})`);
  assert(res.sim.counters.opener === 0, 'RT-F-R1: no click after a post-load redirect');
  assert(res.sim.credentialCalls().length === 0, 'RT-F-R1: no credentials');
  return res;
}

async function fixtureTamper(bgSrc) {
  const res = await runExt(
    FIX.TOP,
    {
      frameId: 11,
      fillFrameId: 11,
      targetFrameId: 11,
      clickLocator: '#site-login',
      selector: '#site-login',
      fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#site-login' }],
      frameContext: { mode: 'declared_depth1' },
      allowedFrameOrigin: OTHER_ORIGIN,
    },
    { bgSrc },
  );
  assertSuccess(res, 'top', 'RT-F-TAMPER extra fields');
  assertOneRunnerCall(res, 0, TOP_ORIGIN, 'RT-F-TAMPER extra fields');
  assert(res.sim.counters.siteLogin === 0, 'RT-F-TAMPER: message locators ignored');
  return res;
}

function tamperPlans() {
  const reserved = makePlan();
  reserved.preambleActions[0].kind = 'final_submit';
  const pattern = makePlan({ pattern: 'FLOATING_SCREEN_MULTI_STEP' });
  const twoOpeners = makePlan();
  twoOpeners.preambleActions.push({ ...twoOpeners.preambleActions[0], actionId: 'opener-2' });
  const unapproved = makePlan();
  unapproved.preambleActions[0].approvedForRuntime = false;
  const pending = makePlan();
  pending.preambleActions[0].readiness.locator = '[data-pv-pending-reveal]';
  const badFrame = makePlan({ frame: { frameLocator: FRAME_LOCATOR, frameOrigin: 'http://frame.example.test' } });
  const mixed = makePlan({ frame: CROSS_FRAME });
  delete mixed.steps[0].fieldMappings[1].frame;
  const notMapped = makePlan();
  notMapped.preambleActions[0].readiness.locator = '#other';
  const exit = makePlan();
  exit.steps[0].exitTransition = { ...exit.preambleActions[0], actionId: 'exit-1', kind: 'intermediate_transition' };
  return [
    ['reserved final_submit', reserved, CREDS, 'reserved_action_kind'],
    ['pattern FLOATING_SCREEN_MULTI_STEP', pattern, CREDS, 'pattern_not_supported_yet'],
    ['two openers', twoOpeners, CREDS, 'plan_shape_unsupported'],
    ['opener not approvedForRuntime', unapproved, CREDS, 'plan_shape_unsupported'],
    ['pending-reveal readiness', pending, CREDS, 'readiness_invalid'],
    ['http frame origin', badFrame, CREDS, 'frame_invalid'],
    ['mixed mapping frames', mixed, CREDS, 'frame_invalid'],
    ['readiness not a mapped field', notMapped, CREDS, 'readiness_invalid'],
    ['exitTransition present', exit, CREDS, 'plan_shape_unsupported'],
    ['extra credential key', makePlan(), { ...CREDS, otp: '1234' }, 'credentials_unexpected'],
    ['missing credential', makePlan(), { username: CREDS.username }, 'credentials_incomplete'],
    ['no plan', null, CREDS, 'plan_invalid'],
  ];
}

async function fixtureTamperRejects(bgSrc) {
  for (const [label, plan, creds, reason] of tamperPlans()) {
    const res = await runExt({ name: label, plan }, { plan, credentials: creds }, { bgSrc });
    const r = res.response;
    assert(r.ok === false && r.stage === 'validate' && r.reason === reason, `RT-F-TAMPER ${label}: ${reason} (got ${r.reason})`);
    assert(r.tabOpened === false && res.listenerReturn === false, `RT-F-TAMPER ${label}: sync reject`);
    assert(res.sim.tabCreates.length === 0 && res.sim.calls.length === 0, `RT-F-TAMPER ${label}: no tab, no script`);
  }
  const wrongEntry = await runExt(FIX.TOP, { entryUrl: `${OTHER_ORIGIN}/home` }, { bgSrc });
  assert(wrongEntry.response.reason === 'entry_unresolved' && wrongEntry.sim.tabCreates.length === 0, 'RT-F-TAMPER entry origin ≠ allowedOrigin');
}

// ---------------------------------------------------------------------------
// D-121-39 — runner opt-in declared-frame mode (direct, real scripts)
// ---------------------------------------------------------------------------
function loadManaged(win, sources) {
  for (const rel of [
    'generic/managed-target-eligibility.js',
    'generic/form-detector.js',
    'generic/fill-executor.js',
    'generic/validated-autofill.js',
  ]) {
    loadPageScript(win, rel, sources);
  }
}

function runnerWorld(kind, sources) {
  const top = makeWin(
    kind === 'top' ? `<!doctype html><html><body>${MODAL_FORM}</body></html>` : '<!doctype html><html><body><iframe id="login-frame"></iframe></body></html>',
    TOP_ORIGIN,
  );
  def(top, 'top', top);
  def(top, 'parent', top);
  if (kind === 'top') {
    loadManaged(top, sources);
    return top;
  }
  let parent = top;
  if (kind === 'depth2') {
    const mid = makeWin('<!doctype html><html><body><iframe id="inner"></iframe></body></html>', FRAME_ORIGIN);
    def(mid, 'parent', top);
    def(mid, 'top', top);
    parent = mid;
  }
  const frame = makeWin(FRAME_DOC, FRAME_ORIGIN);
  def(frame, 'parent', parent);
  def(frame, 'top', top);
  loadManaged(frame, sources);
  return frame;
}

const RUNNER_MAPPINGS = [
  { fieldId: 'username', locatorType: 'css', locator: '#user' },
  { fieldId: 'password', locatorType: 'css', locator: '#pass' },
];

async function runner(kind, { frameContext, allowedOrigin, sources } = {}) {
  const win = runnerWorld(kind, sources);
  const opts = { allowedOrigin, fieldMappings: RUNNER_MAPPINGS, credentials: { ...CREDS }, diagnosticPath: 'unknown' };
  if (frameContext !== undefined) opts.frameContext = frameContext;
  const assess = win.assessManagedTargetsReady(opts);
  const result = await Promise.resolve(win.runManagedAutofill(opts));
  await sleep(30);
  return { win, assess, result, filled: win.document.querySelector('#user').value === CREDS.username };
}

async function d12139Cases(sources) {
  const DC = { mode: 'declared_depth1' };
  const absent = await runner('depth1', { allowedOrigin: FRAME_ORIGIN, sources });
  assert(absent.result.ok === false && absent.result.reason === 'not_top_frame' && absent.assess.reason === 'not_top_frame', `D-121-39 option absent in iframe → not_top_frame (got ${absent.result.reason})`);
  assert(!absent.filled, 'D-121-39 option absent: nothing filled');

  const depth1 = await runner('depth1', { frameContext: DC, allowedOrigin: FRAME_ORIGIN, sources });
  assert(depth1.result.ok === true && depth1.result.filled === 2 && depth1.filled, `D-121-39 option in depth-1 → fills (got ${JSON.stringify(depth1.result.reason)})`);

  const depth2 = await runner('depth2', { frameContext: DC, allowedOrigin: FRAME_ORIGIN, sources });
  assert(depth2.result.ok === false && depth2.result.reason === 'frame_not_depth1' && !depth2.filled, `D-121-39 depth-2 → rejected (got ${depth2.result.reason})`);

  const topWith = await runner('top', { frameContext: DC, allowedOrigin: TOP_ORIGIN, sources });
  assert(topWith.result.ok === false && topWith.result.reason === 'frame_context_mismatch' && !topWith.filled, `D-121-39 top with option → frame_context_mismatch (got ${topWith.result.reason})`);

  const wrongOrigin = await runner('depth1', { frameContext: DC, allowedOrigin: TOP_ORIGIN, sources });
  assert(wrongOrigin.result.ok === false && wrongOrigin.result.reason === 'wrong_origin' && !wrongOrigin.filled, `D-121-39 wrong origin in frame → wrong_origin (got ${wrongOrigin.result.reason})`);

  const badMode = await runner('depth1', { frameContext: { mode: 'any' }, allowedOrigin: FRAME_ORIGIN, sources });
  assert(badMode.result.reason === 'frame_context_mismatch' && !badMode.filled, 'D-121-39 unknown mode → frame_context_mismatch');

  const topStandard = await runner('top', { allowedOrigin: TOP_ORIGIN, sources });
  assert(topStandard.result.ok === true && topStandard.filled, 'D-121-39 top without option → STANDARD fill unchanged');
}

// ---------------------------------------------------------------------------
// Hub bundles
// ---------------------------------------------------------------------------
const BRIDGE_STUB = `
export const isExtensionAvailable = () => globalThis.__bridge.available();
export const openUrlInNewTab = (url) => { globalThis.__bridge.opens.push(url); };
export const sendExtensionMessageAsync = (message) => globalThis.__bridge.send(message);
export const sendExtensionMessage = (message, cb) => { globalThis.__spy.calls.push(['legacySend', message && message.type]); if (cb) cb(null); };
export const getChromeRuntime = () => null;
export const getExtensionId = () => 'test-ext';
export const probeExtensionAvailable = async () => globalThis.__bridge.available();
`;
const BROWSER_INTEGRATION_STUB = `
export * from '${abs('src/browserIntegration/index.ts')}';
${BRIDGE_STUB}`;
const MANAGED_STUB = `
export * from '${abs('src/execution/managedAutofill.ts')}';
export async function executeManagedAutofill(service) { globalThis.__spy.calls.push(['managed', service && service.id]); return { ok: true, extensionUsed: true, userMessage: 'managed-ok' }; }
export function serviceClaimsValidatedManagedProfile(service) { return Boolean(service && service.metadata && service.metadata.__testClaimsManaged); }
export function serviceHasValidatedManagedProfile() { return false; }
export function serviceIsManagedAutofillEligible(service) { return Boolean(service && service.metadata && service.metadata.__testClaimsManaged); }
`;
const GENERIC_STUB = `
export * from '${abs('src/execution/genericAutofill.ts')}';
export function executeGenericAutofill(url) { globalThis.__spy.calls.push(['generic', url]); return { ok: true, extensionUsed: true }; }
`;
const LI_STUB = `
export * from '${abs('src/loginIntelligence/index.ts')}';
export function resolveLoginIntelligenceForExecution(m) { return (m && m.__testLi) || null; }
export function complexityForExecution(li) { return (li && li.__testComplexity) || 'unknown'; }
export async function executeMediumAssist(url) { globalThis.__spy.calls.push(['medium', url]); return { success: true, extensionUsed: true, autofillAttempted: true, userMessage: 'medium-ok' }; }
`;
const ADAPTER_STUB = `
export * from '${abs('src/execution/adapters/registry.ts')}';
export function isSiteSpecificAdapter(id) { globalThis.__spy.calls.push(['adapterCheck', id]); return id === 'test-adapter'; }
export function getServiceAdapter(id) { globalThis.__spy.calls.push(['adapterGet', id]); return { execute(ctx) { globalThis.__spy.calls.push(['adapterExec', ctx.openUrl]); return { ok: true, extensionUsed: true, autofillAttempted: true }; } }; }
`;

const HUB_STUBS = [
  [/(^|\/)extensionBridge$/, BRIDGE_STUB],
  [/(^|\/)browserIntegration$/, BROWSER_INTEGRATION_STUB],
  [/(^|\/)managedAutofill$/, MANAGED_STUB],
];
const SE_STUBS = [
  ...HUB_STUBS,
  [/(^|\/)genericAutofill$/, GENERIC_STUB],
  [/(^|\/)loginIntelligence$/, LI_STUB],
  [/(^|\/)adapters\/registry$/, ADAPTER_STUB],
];

const bundle = (entry, name, opts) => withTempDir(`pv-1212rt-${name}-`, (outdir) => bundleIn(outdir, entry, name, opts));

async function bundleIn(outdir, entry, name, { stubs = [], transforms = [] } = {}) {
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
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [
      {
        name: 'pv-rt-stubs',
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
              assert(text.includes(from), `transform target missing in ${suffix}: ${from.slice(0, 60)}`);
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

function resetHub(send, { available = true } = {}) {
  globalThis.__spy = { calls: [] };
  const sends = [];
  globalThis.__bridge = {
    opens: [],
    sends,
    available: () => available,
    send: async (message) => {
      sends.push(JSON.parse(JSON.stringify(message)));
      globalThis.__spy.calls.push(['send', message && message.type]);
      return send ? send(message) : null;
    },
  };
  return globalThis.__bridge;
}

const OK_EXT = () => ({ ok: true, state: 'STOPPED_FOR_USER', stage: 'fill', tabOpened: true, filled: 2, userGestureDuringRun: false });

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
out('Phase 121.2-impl (+ D-121-39) — SPECIAL login flow runtime verification\n');

const LC = await bundle('src/loginContract/index.ts', 'lc');
const HUB = await bundle('src/execution/specialLoginFlow.ts', 'hub', { stubs: HUB_STUBS });
const MSG = await bundle('src/execution/specialLoginFlowMessages.ts', 'msg', { stubs: HUB_STUBS });
const SE = await bundle('src/execution/serviceExecution.ts', 'se', { stubs: SE_STUBS });
const MANAGED_REAL = await bundle('src/execution/managedAutofill.ts', 'managed', { stubs: HUB_STUBS.slice(0, 2) });

const activeMeta = (plan, version = plan.planVersion) => ({
  [LC.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: version },
  [LC.LOGIN_FLOW_PLAN_META_KEY]: LC.serializeLoginFlowPlanBag({ draft: null, active: plan }),
});
const draftMeta = (plan) => ({
  [LC.LOGIN_FLOW_PLAN_META_KEY]: LC.serializeLoginFlowPlanBag({ draft: plan, active: null }),
});

// --- RT-STATIC ------------------------------------------------------------
{
  const PINS = {
    'extension/generic/fill-executor.js': '9739554c79e31b438f0905254dafbb3e85a118b523101b8c4b9d568704160e53',
    'extension/generic/managed-target-eligibility.js': 'b5fc03260302e35837bff5663288b94e19e31838df6621b7d0b12a3b7fb18d37',
    'extension/generic/frame-correlation.js': '051c53a500b18582cf36ef37754913678361ec7997aa46c8124536e8d5bd869a',
    'extension/generic/form-detector.js': '400589adcc89de0106ee41bc3761a96e552e46bbfedf50dbe46e8b3f4ec89973',
    'extension/manifest.json': 'c82311650a4f0da0a58feefa110ac4a562b3aaa0cd2cc82bcfa216ac70ecdf09',
    'src/execution/managedAutofill.ts': '451a747c41e541c00577fa60a2ea83d670e1bec94fde10c969218a0c150d7f11',
    'src/autofill/validatedProfile.ts': 'f6ee08b30939f8ba302f6f3e4fd7336db8eb13e465c66ae347ffe845788934c2',
    'src/loginContract/validateSpecialPlan.ts': 'd412381feb16db24e532bfc0c220d357f787d526c254d4478d0979dc477049d7',
    'src/loginContract/resolve.ts': '104e9a38640a1f40ad84d3406a81f8b0db1dfaf8bf3685a395611b9e855cefa4',
    'src/loginContract/draftSnapshot.ts': '094b39dc14ff3b61e195d27f89d4079553a0e5d3b369c637d5339ca3b860413b',
    'src/loginContract/parse.ts': 'eebbbf31e522e57a28059125ba9111d9a4ea22363cb80d56276bd1daabf668e0',
    'src/loginContract/frameDescriptor.ts': '423b3528791ca83af6374d44992e3c5945f7aea1e885aef026c22e340027f76b',
  };
  // D-121-49 / D-121-61 / D-121-63 (authorized) edit the shared eligibility hit rule / frame
  // locator candidates / completeness validator; revert those exact edits first (D-121-71 before D-121-49).
  const pinned = (rel) =>
    rel === 'extension/generic/managed-target-eligibility.js'
      ? revertD12149EligibilityEdits(revertD12171EligibilityEdits(read(rel)))
      : rel === 'extension/generic/frame-correlation.js'
        ? revertD12161CorrelationEdits(read(rel))
        : rel === 'src/loginContract/validateSpecialPlan.ts'
          ? revertD12163ValidatorEdits(read(rel))
          : rel === 'src/execution/managedAutofill.ts'
            ? revertD12172ManagedAutofillEdits(read(rel))
            : rel === 'extension/manifest.json'
              ? revertPhase126PartAManifest(read(rel)) // Phase 126 Part A (G-3)
              : read(rel);
  for (const [rel, pin] of Object.entries(PINS)) {
    assert(sha(pinned(rel)) === pin, `RT-STATIC byte-identical: ${rel}`);
  }
  ok('RT-STATIC fill-executor / eligibility / form-detector / frame-correlation / manifest / Hub STANDARD + contract modules byte-identical');

  // D-121-39 item 1: the validated-autofill diff is the gate + option plumbing only.
  // D-121-70 (authorized later) added the skipPostRuntimeObserve option; reverted first.
  const va = revertD12170ValidatedAutofillEdits(read('extension/generic/validated-autofill.js'));
  const newGate =
    "    var frameContext = options && options.frameContext;\n" +
    '    if (frameContext) {\n' +
    "      if (frameContext.mode !== 'declared_depth1' || !root.top || root.top === root) {\n" +
    "        return { ready: false, reason: 'frame_context_mismatch' };\n" +
    '      }\n' +
    '      if (root.parent !== root.top) {\n' +
    "        return { ready: false, reason: 'frame_not_depth1' };\n" +
    '      }\n' +
    '    } else if (root.top && root.top !== root) {\n' +
    "      return { ready: false, reason: 'not_top_frame' };\n" +
    '    }\n';
  const oldGate = "    if (root.top && root.top !== root) {\n      return { ready: false, reason: 'not_top_frame' };\n    }\n";
  const header =
    " * D-121-39 — optional frameContext { mode: 'declared_depth1' } (set only by the Ext SPECIAL\n" +
    " * orchestrator after it resolved the plan's frame) runs in a depth-1 frame instead.\n";
  assert(va.split(newGate).length === 2 && va.split(header).length === 2, 'RT-STATIC validated-autofill gate present once');
  const reverted = va.replace(newGate, oldGate).replace(header, '');
  assert(
    sha(reverted) === '6e726c2d0b39fe5132e71afb4f62bd5442f0e7165882e0d1115649c95654d30a',
    'RT-STATIC validated-autofill: only the gate + header changed (reverse transform = pre-slice bytes)',
  );
  ok('D-121-39 validated-autofill diff = gate + option plumbing only (reverse transform matches pre-slice SHA)');

  const se = read('src/execution/serviceExecution.ts');
  const seTail = se.slice(se.indexOf('  const openUrl = getServiceOpenUrl(service);'));
  assert(
    sha(seTail) === '96cc0db917f90a64e76f9e8ce13d813e3c036b8fb1d9e6bda795f6b21b26307a',
    'RT-STATIC serviceExecution STANDARD remainder byte-identical',
  );
  const blockStart = BG_SRC.indexOf('/**\n * Phase 121.2 — SPECIAL login flow runtime');
  const blockEnd = BG_SRC.indexOf('chrome.runtime.onMessageExternal.addListener');
  assert(blockStart > 0 && blockEnd > blockStart, 'RT-STATIC runtime block located');
  const router = "  if (message.type === 'HUB_SPECIAL_LOGIN_FLOW') {\n    return runSpecialLoginFlow(message, sendResponse, sender);\n  }\n\n";
  // D-121-42 / D-121-47 / D-121-48 / D-121-60 / D-121-61 / D-121-63 / D-121-72 (authorized) edit outside the block; revert those exact edits first (latest first).
  const outside = revertD12142BackgroundEdits(
    revertD12147BackgroundEdits(
      revertD12148BackgroundEdits(
        revertD12160BackgroundEdits(
          revertD12161BackgroundEdits(
            revertD12163BackgroundEdits(
              revertD12172BackgroundOutsideEdits(BG_SRC.slice(0, blockStart) + BG_SRC.slice(blockEnd)).replace(router, ''),
            ),
          ),
        ),
      ),
    ),
  );
  assert(
    sha(outside) === '4c686cd0204ef78e5fa0382242998b3f1e7d11a4eae68ed736190ebfb4ac2f6b',
    'RT-STATIC background.js outside the SPECIAL runtime block + router entry byte-identical (after reverting D-121-42 edits)',
  );
  ok('RT-STATIC serviceExecution STANDARD remainder + background.js (outside new block/router) pinned');

  const block = BG_SRC.slice(blockStart, blockEnd);
  const hubFiles = [
    'src/execution/specialLoginFlow.ts',
    'src/execution/specialLoginFlowMessages.ts',
    'src/loginContract/runtimeGate.ts',
  ].map((rel) => [rel, read(rel)]);
  for (const [label, text] of [['background runtime block', block], ...hubFiles]) {
    for (const bad of ['getFrameId', 'webNavigation', 'chrome.debugger', 'hostname', 'serviceId ===', 'mizrahi', 'tefahot', 'pagi', 'rivhit', '.submit(', 'requestSubmit']) {
      assert(!text.toLowerCase().includes(bad.toLowerCase()), `RT-STATIC ${label}: forbidden token ${bad}`);
    }
  }
  const blockCode = block
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*\*|\/\/)/.test(line))
    .join('\n');
  assert((blockCode.match(/frameContext/g) || []).length === 1, 'RT-STATIC Ext sets frameContext at one place');
  assert(block.includes("runOptions.frameContext = { mode: 'declared_depth1' };"), 'RT-STATIC frameContext literal set by the Ext');
  assert(!/message\.(frameId|frameContext|frame\b|fillFrameId|targetFrameId)/.test(block), 'RT-STATIC frame choice never read from the Hub message');
  const hubSrc = read('src/execution/specialLoginFlow.ts');
  const msgStart = hubSrc.indexOf('    const message = {');
  const hubMessage = hubSrc.slice(msgStart, hubSrc.indexOf('    };', msgStart));
  assert(msgStart > 0 && !/frame/i.test(hubMessage), 'RT-STATIC Hub message carries no frame / frameId');
  assert(BG_SRC.includes("var SPECIAL_RESERVED_ACTION_KINDS = ['final_submit'];"), 'RT-STATIC final_submit reserved in Ext');
  for (const [rel, text] of hubFiles) {
    for (const bad of ['supabase', 'adminRegistryApi', 'updateService', 'upsert', 'saveRegistry', 'localStorage', 'sessionStorage']) {
      assert(!text.includes(bad), `RT-STATIC no persistence in ${rel}: ${bad}`);
    }
  }
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(!(manifest.permissions || []).includes('webNavigation') && !(manifest.permissions || []).includes('debugger'), 'RT-STATIC manifest has no webNavigation / debugger');
  ok('RT-STATIC no getFrameId / webNavigation / debugger / site branches / submit; frameContext Ext-only; no persistence');
}

// --- RT-8.1 fixtures -----------------------------------------------------------
await fixtureTop();
ok('RT-F-TOP opener → readiness → top fill; STOPPED_FOR_USER; no frame machinery; never submits');
await fixtureFrame(FIX.SAME, TOP_ORIGIN);
ok('RT-F-SAME same-origin declared frame fills with frameContext (credentials only to that frame)');
await fixtureFrame(FIX.CROSS, FRAME_ORIGIN);
ok('RT-F-CROSS cross-origin declared frame: runner allowedOrigin = plan frameOrigin');
await fixtureFrame(FIX.LATE, FRAME_ORIGIN);
ok('RT-F-LATE about:blank → navigated frame treated as loading, then fills');
await fixtureSwap();
ok('RT-F-SWAP frame swapped after readiness → frame_origin_mismatch, credentials never sent');
await fixtureR1();
ok('RT-F-R1 post-load cross-origin redirect → r1 origin_mismatch before any click');
{
  const res = await runExt(FIX.PRELOAD);
  assert(res.response.ok === false && res.response.reason === 'tab_load_timeout', `RT-F-R1-PRELOAD → tab_load_timeout (got ${res.response.reason})`);
  assert(res.sim.counters.opener === 0 && res.sim.credentialCalls().length === 0 && res.sim.calls.length === 0, 'RT-F-R1-PRELOAD: nothing injected');
  ok('RT-F-R1-PRELOAD cross-origin redirect before load → tab_load_timeout (accepted finding; no script, no click)');
}
{
  const r0 = await runExt(FIX.OPENER0);
  assert(r0.response.stage === 'opener' && r0.response.reason === 'opener_missing' && r0.sim.credentialCalls().length === 0, 'RT-F-OPENER-0');
  const r2 = await runExt(FIX.OPENER2);
  assert(r2.response.stage === 'opener' && r2.response.reason === 'opener_ambiguous' && r2.sim.counters.opener === 0, 'RT-F-OPENER-2');
  ok('RT-F-OPENER-0 / -2 → opener_missing / opener_ambiguous, no click on ambiguity, no credentials');
}
{
  const res = await runExt(FIX.TIMEOUT);
  const r = res.response;
  assert(r.stage === 'readiness' && r.reason === 'readiness_timeout' && r.locator === '#user' && r.frameKey === 'top', 'RT-F-TIMEOUT');
  assert(res.sim.counters.opener === 1 && res.sim.credentialCalls().length === 0, 'RT-F-TIMEOUT: clicked once, no credentials');
  ok('RT-F-TIMEOUT readiness never met → readiness_timeout (locator + frameKey, no values)');
}
await fixtureTamper();
await fixtureTamperRejects();
ok('RT-F-TAMPER extra message fields ignored; bad plans / credentials / entry rejected before any tab');

// --- RT-GESTURE / A2 (Ext evidence) ----------------------------------------------
{
  const g = await runExt(FIX.GESTURE);
  assert(g.response.ok === true && g.response.userGestureDuringRun === true, 'RT-GESTURE trusted gesture → userGestureDuringRun true (flow itself ok)');
  const n = await runExt(FIX.GESTURE_NO_WATCH);
  assert(n.response.ok === true && !('userGestureDuringRun' in n.response), 'RT-GESTURE install failure → field omitted, run continues');
  assert(MSG.specialAdminPresentation(g.response).kind === 'not_proven', 'A2 gesture → not_proven');
  assert(MSG.specialAdminPresentation(g.response).message === MSG.MSG_SPECIAL_ADMIN_NOT_PROVEN_GESTURE, 'A2 gesture copy');
  assert(MSG.specialAdminPresentation(n.response).message === MSG.MSG_SPECIAL_ADMIN_NOT_PROVEN_NO_EVIDENCE, 'A2 missing evidence copy');
  ok('RT-GESTURE / A2 gesture during run → «לא הוכח…»; missing evidence → «לא הוכח — לא ניתן היה לוודא…»');
}

// --- D-121-39 runner cases ---------------------------------------------------------
await d12139Cases();
ok('D-121-39 absent→not_top_frame; depth-1→fills; depth-2→frame_not_depth1; top+option→frame_context_mismatch; wrong origin→wrong_origin');

// --- A2 presentation ------------------------------------------------------------
{
  const P = MSG.specialAdminPresentation;
  assert(P({ ok: true, userGestureDuringRun: false }).kind === 'success', 'A2 success only with explicit false');
  assert(P({ ok: true, userGestureDuringRun: false }).message === MSG.MSG_SPECIAL_ADMIN_FILL_OK, 'A2 success copy');
  assert(P({ ok: true, userGestureDuringRun: true }).kind === 'not_proven', 'A2 true → not_proven');
  assert(P({ ok: true }).kind === 'not_proven', 'A2 absent → not_proven');
  const reasons = [
    'plan_invalid', 'reserved_action_kind', 'pattern_not_supported_yet', 'plan_shape_unsupported', 'frame_invalid',
    'readiness_invalid', 'credentials_incomplete', 'credentials_unexpected', 'entry_unresolved', 'draft_unsaved_changes',
    'draft_missing', 'draft_incomplete', 'special_contract_invalid', 'origin_mismatch', 'opener_missing', 'opener_ambiguous',
    'readiness_timeout', 'frame_missing', 'frame_ambiguous', 'frame_not_depth1', 'frame_origin_mismatch',
    'frame_correlation_unavailable', 'extension_unavailable', 'busy', 'tab_load_timeout', 'operation_timeout',
    'wrong_origin', 'targets_not_ready', 'verify_failed', 'something_new', undefined,
  ];
  const successCopies = [MSG.MSG_SPECIAL_ADMIN_FILL_OK, MANAGED_REAL.MSG_MANAGED_FILL_OK];
  for (const reason of reasons) {
    for (const gesture of [false, true, undefined]) {
      const p = P({ ok: false, reason, userGestureDuringRun: gesture });
      assert(p.kind === 'failure' && !successCopies.includes(p.message), `A2 failure never success: ${reason}`);
    }
    assert(!successCopies.includes(MSG.specialEndUserMessage({ ok: false, reason })), `DH failure never success: ${reason}`);
  }
  assert(
    MSG.specialAdminMessage({ ok: false, reason: 'frame_origin_mismatch', liveOrigin: OTHER_ORIGIN }).includes(OTHER_ORIGIN),
    'RT-3.2 frame origin copy names the live origin',
  );
  const grid = read('src/admin/AdminFillTestGrid.tsx');
  const resultView = read('src/admin/SpecialTestResultView.tsx');
  assert(grid.includes('<SpecialTestResultView ') && resultView.includes('specialAdminPresentation('), 'A2 grid result uses specialAdminPresentation');
  ok('A2 Admin presentation: success only when verified AND gesture=false; no failure ever shows success copy');
}

// --- RT-PARITY (Hub gate vs Ext gate) ------------------------------------------------
{
  const probe = new Sim({ plan: makePlan() });
  const ext = loadBackground(probe, BG_SRC);
  const topPlan = makePlan();
  const cases = [
    ['valid top', topPlan],
    ['valid frame', makePlan({ frame: CROSS_FRAME })],
    ...tamperPlans().filter(([, plan, creds]) => plan && creds === CREDS).map(([label, plan]) => [label, plan]),
  ];
  const timeout0 = makePlan();
  timeout0.preambleActions[0].readiness.timeoutMs = 0;
  cases.push(['timeout 0', timeout0]);
  const selfReady = makePlan();
  selfReady.preambleActions[0].locator = '#user';
  cases.push(['readiness = opener', selfReady]);
  const noMappings = makePlan();
  noMappings.steps[0].fieldMappings = [];
  cases.push(['no mappings', noMappings]);
  const RUNTIME = new Set(['reserved_action_kind', 'pattern_not_supported_yet', 'plan_shape_unsupported', 'readiness_invalid', 'frame_invalid']);
  for (const [label, plan] of cases) {
    const bridge = resetHub(OK_EXT);
    const outcome = await HUB.executeSpecialLoginFlow({
      context: { kind: 'active', plan, activePlanVersion: plan.planVersion },
      entry: { authoringUrl: ENTRY_URL, allowedOrigin: TOP_ORIGIN },
      credentials: { ...CREDS },
      executionKey: `parity-${label}`,
      diagnosticPath: 'admin_test',
    });
    const hubPass = outcome.stage !== 'validate';
    const extVerdict = ext.specialValidateRunPlan(JSON.parse(JSON.stringify(plan)), { ...CREDS });
    assert(hubPass === extVerdict.ok, `RT-PARITY ${label}: Hub ${hubPass ? 'pass' : outcome.reason} vs Ext ${extVerdict.ok ? 'pass' : extVerdict.reason}`);
    if (!hubPass && RUNTIME.has(outcome.reason) && !extVerdict.ok) {
      const complete = LC.validateSpecialPlanComplete(plan);
      if (complete.ok) assert(outcome.reason === extVerdict.reason, `RT-PARITY ${label}: same runtime reason`);
    }
    assert(hubPass === (bridge.sends.length === 1), `RT-PARITY ${label}: Hub sends only when valid`);
  }
  ok(`RT-PARITY Hub (validateSpecialPlanComplete + validateSpecialRunnable) ≡ Ext specialValidateRunPlan on ${cases.length} plans`);
}

// --- RT-CRED / RT-SNAPSHOT / Admin end-to-end (Hub → real Ext) ---------------------
{
  const plan = makePlan({ frame: CROSS_FRAME });
  const row = { id: 'svc-admin-1', primary_url: ENTRY_URL, login_url: null, metadata: draftMeta(plan) };
  let released;
  const gate = new Promise((r) => (released = r));
  let extResult = null;
  const bridge = resetHub(async (message) => {
    await gate;
    extResult = await extRun(FIX.CROSS, message);
    return extResult.response;
  });
  const pending = HUB.executeAdminSpecialLoginFlowTest({
    serviceRow: row,
    contextChoice: 'special_draft',
    tempCredentials: { username: '  hub-user-q8 ', password: 'hub-pass-W4z', otp: 'not-mapped' },
    draftHasUnsavedChanges: false,
  });
  await sleep(5);
  assert(bridge.sends.length === 1, 'RT-SNAPSHOT one message at press time');
  // Mutate the saved draft while the run is in flight — the run must use the press-time snapshot.
  row.metadata = draftMeta(makePlan({ frame: { frameLocator: 'iframe#evil', frameOrigin: OTHER_ORIGIN } }));
  released();
  const outcome = await pending;
  const sent = bridge.sends[0];
  assert(JSON.stringify(sent.plan) === JSON.stringify(LC.serializeLoginFlowPlanDocument(plan)), 'RT-SNAPSHOT message plan = press-time draft');
  assert(Object.keys(sent).sort().join(',') === 'allowedOrigin,credentials,diagnosticPath,entryUrl,plan,runId,type', 'RT-CRED message shape (no frameId / no extras)');
  assert(JSON.stringify(sent.credentials) === JSON.stringify({ username: 'hub-user-q8', password: 'hub-pass-W4z' }), 'RT-CRED subset = mapped ids, trimmed');
  assert(sent.diagnosticPath === 'admin_test' && sent.allowedOrigin === TOP_ORIGIN && sent.entryUrl === ENTRY_URL, 'RT-CRED entry + path');
  assert(outcome.ok === true && outcome.context === 'draft_snapshot' && typeof outcome.snapshotId === 'string', 'Admin DRAFT e2e ok with snapshot context');
  assert(outcome.frameKey === `${FRAME_LOCATOR}|${FRAME_ORIGIN}` && outcome.userGestureDuringRun === false, 'Admin DRAFT e2e frameKey + gesture evidence');
  assert(MSG.specialAdminPresentation(outcome).kind === 'success', 'Admin DRAFT e2e presentation success');
  assert(bridge.opens.length === 0, 'Admin e2e: no extra tab opened');
  const w = extResult.sim.frameWin();
  assert(w.document.querySelector('#user').value === 'hub-user-q8' && w.document.querySelector('#pass').value === 'hub-pass-W4z', 'Admin e2e filled from temp credentials');

  const snap = LC.createImmutableDraftSnapshot(plan, { snapshotId: 's1' });
  assert(snap.ok && Object.isFrozen(snap.snapshot.plan) && Object.isFrozen(snap.snapshot.plan.steps[0].fieldMappings[0]), 'RT-SNAPSHOT snapshot deep-frozen');

  for (const [label, input, reason] of [
    ['unsaved', { draftHasUnsavedChanges: true }, 'draft_unsaved_changes'],
    ['missing', { serviceRow: { ...row, metadata: {} } }, 'draft_missing'],
    ['incomplete', { serviceRow: { ...row, metadata: draftMeta({ planVersion: 1, pattern: 'FLOATING_SCREEN', preambleActions: [], steps: [] }) } }, 'draft_incomplete'],
    ['entry http', { serviceRow: { ...row, primary_url: 'http://top.example.test/home', metadata: draftMeta(plan) } }, 'entry_unresolved'],
  ]) {
    const b = resetHub(OK_EXT);
    const o = await HUB.executeAdminSpecialLoginFlowTest({
      serviceRow: { ...row, metadata: draftMeta(plan) },
      contextChoice: 'special_draft',
      tempCredentials: { username: 'hub-user-q8', password: 'hub-pass-W4z' },
      ...input,
    });
    assert(o.ok === false && o.reason === reason && b.sends.length === 0 && b.opens.length === 0, `Admin ${label} → ${reason} without any run (got ${o.reason})`);
  }
  const bActive = resetHub(OK_EXT);
  const oActive = await HUB.executeAdminSpecialLoginFlowTest({
    serviceRow: { ...row, metadata: activeMeta(makePlan()) },
    contextChoice: 'special_active',
    tempCredentials: { username: 'hub-user-q8', password: 'hub-pass-W4z' },
  });
  assert(oActive.ok === true && oActive.context === 'active' && oActive.planVersion === 3 && bActive.sends.length === 1, 'Admin ACTIVE context runs the resolver plan');
  ok('RT-SNAPSHOT / RT-CRED Admin DRAFT e2e (Hub → real Ext → frame): press-time snapshot, mapped trimmed subset, no writes');
}

// --- A3 fail-closed -----------------------------------------------------------------
async function a3Cases(hub, label) {
  const plan = makePlan();
  const run = () =>
    hub.executeSpecialLoginFlow({
      context: { kind: 'active', plan, activePlanVersion: 3 },
      entry: { authoringUrl: ENTRY_URL, allowedOrigin: TOP_ORIGIN },
      credentials: { ...CREDS },
      executionKey: `a3-${label}`,
      diagnosticPath: 'digital_home',
    });
  const scenarios = [
    ['extension unavailable', null, { available: false }],
    ['unknown_message', () => ({ ok: false, reason: 'unknown_message' })],
    ['no_message', () => ({ ok: false, reason: 'no_message' })],
    ['null response', () => null],
    ['undefined response', () => undefined],
    ['non-object response', () => 'yes'],
    ['rejected send', () => Promise.reject(new Error('Could not establish connection'))],
  ];
  // D-121-72: the Hub bound is a run timeout (lock released, nothing opened) — no longer A3.
  if (hub.SPECIAL_HUB_RESPONSE_TIMEOUT_MS < 1000) {
    const b = resetHub(() => new Promise(() => {}));
    const o = await run();
    assert(o.ok === false && o.reason === 'run_timeout', `D-121-72 no response (timeout) → run_timeout (got ${o.reason})`);
    assert(b.opens.length === 0, 'D-121-72 timeout: no entry opened');
    const other = globalThis.__spy.calls.filter(([k]) => k !== 'send');
    assert(other.length === 0, `D-121-72 timeout: no STANDARD / Managed / Generic fallback (${JSON.stringify(other)})`);
    assert(MSG.specialAdminPresentation(o).kind === 'failure', 'D-121-72 timeout: never success');
  }
  for (const [name, send, opts] of scenarios) {
    const b = resetHub(send, opts);
    const o = await run();
    assert(o.ok === false && o.reason === 'extension_unavailable', `A3 ${name} → extension_unavailable (got ${o.reason})`);
    assert(b.opens.length === 1 && b.opens[0] === ENTRY_URL, `A3 ${name}: entry opened once`);
    const other = globalThis.__spy.calls.filter(([k]) => k !== 'send');
    assert(other.length === 0, `A3 ${name}: no STANDARD / Managed / Generic fallback (${JSON.stringify(other)})`);
    assert(MSG.specialAdminPresentation(o).kind === 'failure', `A3 ${name}: never success`);
  }
}
{
  await a3Cases(HUB, 'real');
  const HUB_FAST = await bundle('src/execution/specialLoginFlow.ts', 'hubfast', {
    stubs: HUB_STUBS,
    transforms: [['src/execution/specialLoginFlow.ts', 'SPECIAL_HUB_RESPONSE_TIMEOUT_MS = 260000;', 'SPECIAL_HUB_RESPONSE_TIMEOUT_MS = 60;']],
  });
  await a3Cases(HUB_FAST, 'fast');
  assert(HUB.SPECIAL_HUB_RESPONSE_TIMEOUT_MS > 240000, 'A3 Hub timeout exceeds Ext worst case (tab load + operation)');
  ok('A3 unavailable / unknown_message / no_message / no response / rejected → extension_unavailable, entry only, no fallback; timeout → run_timeout (D-121-72)');
}

// --- RT-DH-ROUTE (Digital Home) ------------------------------------------------------
{
  const svc = (metadata, extra = {}) => ({ id: 'svc-dh', name: 'DH', icon: '', url: ENTRY_URL, category: 'other', metadata, ...extra });
  const dhCred = { username: 'dh-user', password: 'dh-pass-Z9k', otp: 'unmapped' };
  const optsDH = { activeProfileId: 'profile-1' };

  let b = resetHub(OK_EXT);
  let r = await SE.executeServiceFromTile(svc(activeMeta(makePlan())), dhCred, undefined, optsDH);
  assert(r.status === 'ok' && r.userMessage === MANAGED_REAL.MSG_MANAGED_FILL_OK, 'RT-DH SPECIAL ok');
  assert(b.sends.length === 1 && b.sends[0].type === 'HUB_SPECIAL_LOGIN_FLOW' && b.sends[0].diagnosticPath === 'digital_home', 'RT-DH one SPECIAL message');
  assert(JSON.stringify(b.sends[0].credentials) === JSON.stringify({ username: 'dh-user', password: 'dh-pass-Z9k' }), 'RT-DH mapped subset only');
  assert(globalThis.__spy.calls.every(([k]) => k === 'send'), 'RT-DH SPECIAL: no other path');

  b = resetHub(OK_EXT);
  r = await SE.executeServiceFromTile(
    svc({ ...activeMeta(makePlan()), __testClaimsManaged: true, __testLi: { __testComplexity: 'medium' } }, { adapterId: 'test-adapter' }),
    dhCred,
    undefined,
    optsDH,
  );
  assert(r.status === 'ok' && globalThis.__spy.calls.map(([k]) => k).join(',') === 'send', 'RT-DH SPECIAL checked before adapters / Managed / medium / generic');

  b = resetHub(OK_EXT);
  r = await SE.executeServiceFromTile(svc(activeMeta(makePlan())), { username: 'dh-user' }, undefined, optsDH);
  assert(r.status === 'credentials_missing' && b.sends.length === 0 && b.opens.length === 1 && b.opens[0] === ENTRY_URL, 'RT-DH SPECIAL missing credential → open entry only');

  const invalidMetas = [
    ['active plan missing', { [LC.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 3 } }],
    ['version mismatch', activeMeta(makePlan(), 9)],
    ['corrupt activation', { [LC.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL' }, [LC.LOGIN_FLOW_PLAN_META_KEY]: activeMeta(makePlan())[LC.LOGIN_FLOW_PLAN_META_KEY] }],
  ];
  for (const [label, meta] of invalidMetas) {
    assert(LC.resolveActiveLoginContract(meta).mode === 'SPECIAL_INVALID', `fixture ${label} is SPECIAL_INVALID`);
    b = resetHub(OK_EXT);
    r = await SE.executeServiceFromTile(svc({ ...meta, __testClaimsManaged: true }, { adapterId: 'test-adapter' }), dhCred, undefined, optsDH);
    assert(r.status === 'open_only' && r.metadataHealth === 'fill_failed' && r.userMessage === MSG.MSG_SPECIAL_DH_CONTRACT_INVALID, `RT-DH SPECIAL_INVALID ${label} → open only`);
    assert(b.opens.length === 1 && b.opens[0] === ENTRY_URL && globalThis.__spy.calls.length === 0, `RT-DH SPECIAL_INVALID ${label}: no fill of any kind`);
  }

  b = resetHub(() => ({ ok: false, state: 'FAILED', stage: 'readiness', reason: 'readiness_timeout', tabOpened: true }));
  r = await SE.executeServiceFromTile(svc(activeMeta(makePlan())), dhCred, undefined, optsDH);
  assert(r.status === 'open_only' && r.userMessage === MSG.MSG_SPECIAL_DH_SCREEN_NOT_OPENED && b.opens.length === 0, 'RT-DH Ext failure with tab open → no second tab');

  b = resetHub(() => ({ ok: false, reason: 'tab_load_timeout' }));
  r = await SE.executeServiceFromTile(svc(activeMeta(makePlan())), dhCred, undefined, optsDH);
  assert(r.status === 'open_only' && b.opens.length === 1 && b.opens[0] === ENTRY_URL, 'RT-DH tab never loaded → entry opened exactly once');

  b = resetHub(() => ({ ok: false, reason: 'unknown_message' }));
  r = await SE.executeServiceFromTile(svc({ ...activeMeta(makePlan()), __testClaimsManaged: true }), dhCred, undefined, optsDH);
  assert(r.status === 'open_only' && r.userMessage === MANAGED_REAL.MSG_MANAGED_EXTENSION_UNAVAILABLE && b.opens.length === 1, 'RT-DH A3 old extension → open entry, no fallback');
  assert(globalThis.__spy.calls.map(([k]) => k).join(',') === 'send', 'RT-DH A3: no Managed fallback');

  // MULTI_STEP ACTIVE with a floating shape (opener + one step; not runnable, 121.3 R-1) → pattern copy, open only.
  const multi = makePlan({ pattern: 'MULTI_STEP' });
  const multiMeta = activeMeta(multi);
  const multiResolved = LC.resolveActiveLoginContract(multiMeta);
  b = resetHub(OK_EXT);
  r = await SE.executeServiceFromTile(svc(multiMeta), dhCred, undefined, optsDH);
  assert(b.sends.length === 0 && b.opens.length === 1 && r.status === 'open_only', 'RT-DH MULTI_STEP → no run, entry opened');
  if (multiResolved.mode === 'SPECIAL') {
    assert(r.userMessage === MSG.MSG_SPECIAL_DH_PATTERN_UNSUPPORTED, 'RT-DH MULTI_STEP → pattern_not_supported_yet copy');
  } else {
    assert(r.userMessage === MSG.MSG_SPECIAL_DH_CONTRACT_INVALID, 'RT-DH MULTI_STEP (invalid contract) → contract-invalid copy');
  }
  ok(`RT-DH SPECIAL routes to the SPECIAL engine only; SPECIAL_INVALID ×3 open-only; MULTI_STEP (${multiResolved.mode}) not run`);

  // STANDARD parity: identical behavior with and without the SPECIAL routing lines.
  const SE_BASE = await bundle('src/execution/serviceExecution.ts', 'sebase', {
    stubs: SE_STUBS,
    transforms: [
      [
        'src/execution/serviceExecution.ts',
        "  const contract = resolveActiveLoginContract(service.metadata ?? {});\n  if (contract.mode === 'SPECIAL') return runSpecialFromTile(service, credential, options, contract);\n  if (contract.mode === 'SPECIAL_INVALID') return failClosedSpecialInvalid(service);\n",
        '',
      ],
    ],
  });
  const stdServices = [
    ['plain', svc(undefined), dhCred],
    ['no credential', svc(undefined), undefined],
    ['adapter', svc({}, { adapterId: 'test-adapter' }), dhCred],
    ['managed claim', svc({ __testClaimsManaged: true }), dhCred],
    ['managed claim no cred', svc({ __testClaimsManaged: true }), undefined],
    ['medium', svc({ __testLi: { __testComplexity: 'medium' } }), dhCred],
    ['complex', svc({ __testLi: { __testComplexity: 'complex' } }), dhCred],
    ['basic', svc({ __testLi: { __testComplexity: 'basic' } }, { loginFields: [{ id: 'username', label: 'U', type: 'text' }, { id: 'password', label: 'P', type: 'password' }] }), dhCred],
    ['explicit STANDARD + SPECIAL draft', svc({ [LC.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'STANDARD' }, ...draftMeta(makePlan()) }), dhCred],
  ];
  for (const [label, service, cred] of stdServices) {
    const traces = [];
    for (const mod of [SE, SE_BASE]) {
      const bb = resetHub(OK_EXT);
      const res = await mod.executeServiceFromTile(service, cred, undefined, optsDH);
      traces.push(JSON.stringify({ res, calls: globalThis.__spy.calls, opens: bb.opens, sends: bb.sends }));
    }
    assert(traces[0] === traces[1], `RT-DH STANDARD parity ${label}:\n${traces[0]}\n${traces[1]}`);
    assert(!traces[0].includes('HUB_SPECIAL_LOGIN_FLOW'), `RT-DH STANDARD ${label}: never SPECIAL`);
  }
  ok(`RT-DH STANDARD byte-identical behavior vs pre-slice routing on ${stdServices.length} services`);
}

// --- Log hygiene -----------------------------------------------------------------
{
  const leaked = LOGS.filter((line) => SECRETS.some((s) => line.includes(s)));
  assert(leaked.length === 0, `RT-CRED credential value logged:\n${leaked.slice(0, 3).join('\n')}`);
  assert(LOGS.some((l) => l.includes('specialRun')), 'RT-DIAG specialRun diag lines emitted');
  ok(`RT-CRED no credential value in ${LOGS.length} captured log lines (background + page scripts)`);
}

// ---------------------------------------------------------------------------
// Mutations — each must make its guard case fail
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

await expectCaught('M1 remove R1 check → RT-F-R1', () =>
  fixtureR1(replaceOnce(BG_SRC, '      checkR1(function () {\n        var token', '      (function (next) { next(); })(function () {\n        var token', 'M1')),
);
{
  let m2 = replaceOnce(
    BG_SRC,
    '          { loadingIsPending: true },\n        );\n      }\n\n      function retryFill',
    '          { loadingIsPending: true, __mutSkipOrigin: true },\n        );\n      }\n\n      function retryFill',
    'M2a',
  );
  m2 = replaceOnce(m2, '          if (p.origin !== descriptor.frameOrigin) {', '          if (!(opts && opts.__mutSkipOrigin) && p.origin !== descriptor.frameOrigin) {', 'M2b');
  await expectCaught('M2 fill without per-attempt origin re-resolve → RT-F-SWAP', () => fixtureSwap(m2));
}
await expectCaught('M3 runner allowedOrigin = top origin → RT-F-CROSS', () =>
  fixtureFrame(FIX.CROSS, FRAME_ORIGIN, replaceOnce(BG_SRC, '            allowedOrigin: doc.origin,', '            allowedOrigin: allowedOrigin,', 'M3')),
);
await expectCaught('M3b frameContext never set → RT-F-CROSS', () =>
  fixtureFrame(FIX.CROSS, FRAME_ORIGIN, replaceOnce(BG_SRC, "runOptions.frameContext = { mode: 'declared_depth1' };", 'void 0;', 'M3b')),
);
await expectCaught('M4a Ext pattern gate removed → RT-F-TAMPER', () =>
  fixtureTamperRejects(
    replaceOnce(BG_SRC, "        : fail('pattern_not_supported_yet');\n", '        : specialRuntimeMultiStepShape(preamble, steps);\n', 'M4a'),
  ),
);
{
  const HUB_M4 = await bundle('src/execution/specialLoginFlow.ts', 'hubm4', {
    stubs: HUB_STUBS,
    transforms: [
      [
        'src/loginContract/runtimeGate.ts',
        'export function validateSpecialRunnable(plan: LoginFlowPlanDocument): SpecialRuntimeGate {\n',
        'export function validateSpecialRunnable(plan: LoginFlowPlanDocument): SpecialRuntimeGate {\n  if (plan) return { ok: true };\n',
      ],
    ],
  });
  await expectCaught('M4b Hub runtime gate removed → Hub sends FLOATING_SCREEN_MULTI_STEP', async () => {
    const plan = makePlan({ pattern: 'FLOATING_SCREEN_MULTI_STEP' });
    const b = resetHub(OK_EXT);
    const o = await HUB_M4.executeSpecialLoginFlow({
      context: { kind: 'active', plan, activePlanVersion: 3 },
      entry: { authoringUrl: ENTRY_URL, allowedOrigin: TOP_ORIGIN },
      credentials: { ...CREDS },
      executionKey: 'm4b',
      diagnosticPath: 'admin_test',
    });
    assert(o.stage === 'validate' && b.sends.length === 0, 'Hub rejects non-runnable pattern before sending');
  });
}
await expectCaught('M5 D-121-39 depth-1 check removed → depth-2 case', () =>
  d12139Cases({
    'generic/validated-autofill.js': replaceOnce(PAGE_SRC['generic/validated-autofill.js'], '      if (root.parent !== root.top) {', '      if (false) {', 'M5'),
  }),
);
await expectCaught('M6 D-121-39 not_top_frame gate removed (option absent) → iframe case', () =>
  d12139Cases({
    'generic/validated-autofill.js': replaceOnce(PAGE_SRC['generic/validated-autofill.js'], '    } else if (root.top && root.top !== root) {', '    } else if (false) {', 'M6'),
  }),
);
await expectCaught('M7 D-121-39 top-with-option check removed → frame_context_mismatch case', () =>
  d12139Cases({
    'generic/validated-autofill.js': replaceOnce(
      PAGE_SRC['generic/validated-autofill.js'],
      "      if (frameContext.mode !== 'declared_depth1' || !root.top || root.top === root) {",
      "      if (frameContext.mode !== 'declared_depth1') {",
      'M7',
    ),
  }),
);
{
  const HUB_M8 = await bundle('src/execution/specialLoginFlow.ts', 'hubm8', {
    stubs: HUB_STUBS,
    transforms: [['src/execution/specialLoginFlow.ts', "      response.reason === 'unknown_message' ||\n", '']],
  });
  await expectCaught('M8 A3 unknown_message fail-closed removed', () => a3Cases(HUB_M8, 'm8'));
}
{
  const MSG_M9 = await bundle('src/execution/specialLoginFlowMessages.ts', 'msgm9', {
    stubs: HUB_STUBS,
    transforms: [['src/execution/specialLoginFlowMessages.ts', '  if (input.userGestureDuringRun !== false) {', '  if (false) {']],
  });
  await expectCaught('M9 A2 missing gesture evidence shown as success', async () => {
    assert(MSG_M9.specialAdminPresentation({ ok: true }).kind === 'not_proven', 'absent evidence → not_proven');
  });
}
{
  const SE_M10 = await bundle('src/execution/serviceExecution.ts', 'sem10', {
    stubs: SE_STUBS,
    transforms: [['src/execution/serviceExecution.ts', "  if (contract.mode === 'SPECIAL_INVALID') return failClosedSpecialInvalid(service);\n", '']],
  });
  await expectCaught('M10 SPECIAL_INVALID fail-closed removed → STANDARD fallback', async () => {
    const b = resetHub(OK_EXT);
    const meta = activeMeta(makePlan(), 9);
    await SE_M10.executeServiceFromTile(
      { id: 'svc', name: 'x', icon: '', url: ENTRY_URL, category: 'other', metadata: { ...meta, __testClaimsManaged: true } },
      { username: 'u', password: 'p' },
      undefined,
      { activeProfileId: 'p1' },
    );
    assert(globalThis.__spy.calls.length === 0 && b.opens.length === 1, 'SPECIAL_INVALID never falls back');
  });
}

out(`\nPhase 121.2-impl runtime verification PASS (${passed} checks)`);
