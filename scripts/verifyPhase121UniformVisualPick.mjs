/**
 * Phase 121 D-121-42 — uniform Admin Visual pick lifecycle (STANDARD aligned to SPECIAL).
 * Synthetic fixtures only (no site names). Runs the REAL extension/background.js STANDARD
 * Visual path + REAL page pick script against a simulated tab (mock chrome.* only), the
 * Hub call, the shared pick-session helper, and copy parity. Mutations must be caught.
 * Usage: node scripts/verifyPhase121UniformVisualPick.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';
import { revertD12142BackgroundEdits } from './lib/phase121D42BackgroundEdits.mjs';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
let passCount = 0;
function pass(id, what) {
  passCount += 1;
  console.log(`  ✓ ${id} — ${what}`);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

const ORIGIN = 'https://std.example.test';
const LOGIN_URL = `${ORIGIN}/login`;
const OTHER_ORIGIN = 'https://other.example.test';
const TIMEOUT_COPY =
  'לא נקלטה לחיצה בזמן, והמיפוי החזותי בוטל. כדי לנסות שוב לחצו «מיפוי חזותי» ליד השדה.';
const CANCEL_HINT = 'לביטול לחצו «ביטול».';

const BG_SRC = read('extension/background.js');
const PAGE_FILES = ['generic/managed-target-eligibility.js', 'generic/locator-determinism.js', 'generic/visual-target-pick.js'];
const PAGE_SRC = Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(`extension/${rel}`)]));

console.log('Phase 121 D-121-42 — uniform Admin Visual pick lifecycle\n');

// ─── Simulated tab: real page scripts in linkedom; mock chrome.* only ──────────
function makePage() {
  const { window } = parseHTML(
    `<!DOCTYPE html><html><body><form><input id="user" name="user" type="text" autocomplete="username" /><input id="pass" name="pass" type="password" /></form><p id="note">text</p></body></html>`,
  );
  Object.defineProperty(window, 'location', {
    value: { href: LOGIN_URL, origin: ORIGIN, protocol: 'https:' },
    configurable: true,
    writable: true,
  });
  window.top = window;
  installManagedDomGeometry(window);
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  const doc = window.document;
  const clickCapture = new Set();
  const add = doc.addEventListener.bind(doc);
  const remove = doc.removeEventListener.bind(doc);
  doc.addEventListener = (type, fn, capture) => {
    if (type === 'click' && capture === true) clickCapture.add(fn);
    return add(type, fn, capture);
  };
  doc.removeEventListener = (type, fn, capture) => {
    if (type === 'click' && capture === true) clickCapture.delete(fn);
    return remove(type, fn, capture);
  };
  return { window, doc, clickCapture };
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

function makeExt(bgSrc) {
  const page = makePage();
  const updated = new Set();
  const calls = [];
  let tab = null;
  let listener = null;
  const runtime = {
    lastError: null,
    onMessageExternal: {
      addListener(fn) {
        listener = fn;
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
  const chrome = {
    runtime,
    tabs: {
      create(props, cb) {
        tab = { id: 7, url: props.url, status: 'loading' };
        setTimeout(() => fire(null, cb, { id: 7, index: 1 }), 0);
        setTimeout(() => {
          tab.status = 'complete';
          for (const fn of [...updated]) fn(7, { status: 'complete' }, { ...tab });
        }, 15);
      },
      get(id, cb) {
        setTimeout(() => (tab && id === 7 ? fire(null, cb, { ...tab }) : fire(`No tab with id: ${id}`, cb, undefined)), 0);
      },
      onUpdated: {
        addListener: (fn) => updated.add(fn),
        removeListener: (fn) => updated.delete(fn),
      },
      onRemoved: { addListener() {}, removeListener() {} },
    },
    scripting: {
      executeScript(details, cb) {
        setTimeout(async () => {
          calls.push({ files: details.files || null, funcSrc: details.func ? String(details.func) : '', args: details.args || [], target: details.target });
          if (details.files) {
            for (const rel of details.files) {
              new Function('window', 'document', 'globalThis', `${PAGE_SRC[rel]}\n//# sourceURL=${rel}`)(page.window, page.doc, page.window);
            }
            fire(null, cb, [{ frameId: 0, result: undefined }]);
            return;
          }
          let result;
          try {
            result = await runInPage(page.window, details.func, details.args || []);
          } catch (_err) {
            result = undefined;
          }
          fire(null, cb, [{ frameId: 0, result: result === undefined ? undefined : JSON.parse(JSON.stringify(result)) }]);
        }, 0);
      },
    },
  };
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  new Function('chrome', 'console', `${bgSrc}\n;return null;`)(chrome, quiet);
  function send(message) {
    return new Promise((resolve) => {
      listener(message, { tab: { id: 1, index: 0 } }, resolve);
    });
  }
  const armed = () => typeof page.window.__disarmVisualTargetPick === 'function';
  async function untilArmed(ms = 1000) {
    const end = Date.now() + ms;
    while (!armed()) {
      if (Date.now() > end) throw new Error('pick never armed');
      await sleep(5);
    }
  }
  function navigateTab(url) {
    tab.url = url;
    for (const fn of [...updated]) fn(7, { url }, { ...tab });
  }
  const armCalls = () => calls.filter((c) => c.funcSrc.includes('armVisualTargetPick('));
  return { page, send, armed, untilArmed, navigateTab, armCalls, calls };
}

const start = (extra = {}) => ({
  type: 'ADMIN_VISUAL_MAPPING_START',
  requestId: 'r1',
  fieldId: 'username',
  loginEntryUrl: LOGIN_URL,
  allowedOrigin: ORIGIN,
  pickTimeoutMs: 60000,
  ...extra,
});
const cancel = (origin = ORIGIN) => ({ type: 'ADMIN_VISUAL_MAPPING_CANCEL', requestId: 'c1', allowedOrigin: origin });
const click = (page, id) => page.doc.getElementById(id).dispatchEvent(new page.window.Event('click', { bubbles: true, cancelable: true }));

/** Each scenario throws on failure; the mutation runner expects at least one to throw. */
const EXT_SCENARIOS = {
  async success(bg) {
    const x = makeExt(bg);
    const pending = x.send(start());
    await x.untilArmed();
    assert(x.page.clickCapture.size === 1, 'one click listener while armed');
    click(x.page, 'user');
    const r = await withDeadline(pending, 1500, 'success');
    assert(r.ok === true && r.locator === '#user', `successful pick unchanged: ${JSON.stringify(r)}`);
    assert(!x.armed() && x.page.clickCapture.size === 0, 'listener removed after the pick');
    const after = await x.send(cancel());
    assert(after.reason === 'no_armed_pick', 'session cleared after the answer');
  },
  async pageTimeout(bg) {
    const x = makeExt(bg);
    const t0 = Date.now();
    const r = await withDeadline(x.send(start({ pickTimeoutMs: 200 })), 2500, 'page timeout');
    assert(r.ok === false && r.reason === 'visual_pick_timeout', `page bound → visual_pick_timeout: ${JSON.stringify(r)}`);
    assert(Date.now() - t0 >= 900, 'bound floor 1s');
    assert(!x.armed() && x.page.clickCapture.size === 0, 'listener removed on timeout');
    const arm = x.armCalls()[0];
    assert(arm && arm.args[2] > 0 && arm.args[2] <= 1000, 'bound passed to the page');
  },
  async cancelArmed(bg) {
    const x = makeExt(bg);
    const pending = x.send(start());
    await x.untilArmed();
    const c = await x.send(cancel());
    assert(c.ok === true && c.disarmed === true, `cancel disarms: ${JSON.stringify(c)}`);
    const r = await withDeadline(pending, 1000, 'cancel');
    assert(r.ok === false && r.reason === 'visual_pick_cancelled', 'START answers visual_pick_cancelled');
    assert(!x.armed() && x.page.clickCapture.size === 0, 'listener removed on cancel');
    const ev = new x.page.window.Event('click', { bubbles: true, cancelable: true });
    x.page.doc.getElementById('user').dispatchEvent(ev);
    assert(ev.defaultPrevented === false, 'a later click in the site tab is not swallowed');
  },
  async cancelBeforeArm(bg) {
    const x = makeExt(bg);
    const pending = x.send(start());
    const c = await x.send(cancel());
    assert(c.ok === true && c.reason === 'cancelled_before_arm', `cancel before arm: ${JSON.stringify(c)}`);
    const r = await withDeadline(pending, 1000, 'cancel before arm');
    assert(r.ok === false && r.reason === 'visual_pick_cancelled', 'START answers visual_pick_cancelled');
    await sleep(30);
    assert(x.armCalls().length === 0 && !x.armed() && x.page.clickCapture.size === 0, 'pick never armed');
  },
  async cancelOriginFailClosed(bg) {
    const x = makeExt(bg);
    const pending = x.send(start());
    await x.untilArmed();
    const c = await x.send(cancel(OTHER_ORIGIN));
    assert(c.disarmed === false && x.armed(), 'other-origin cancel ignored (fail-closed)');
    const ok = await x.send(cancel());
    assert(ok.disarmed === true, 'same-origin cancel disarms');
    await withDeadline(pending, 1000, 'origin cancel');
  },
  async earlyExitDisarms(bg) {
    const x = makeExt(bg);
    const pending = x.send(start());
    await x.untilArmed();
    x.navigateTab(`${OTHER_ORIGIN}/elsewhere`);
    const r = await withDeadline(pending, 1000, 'nav abort');
    assert(r.reason === 'origin_mismatch', `navigation away answers origin_mismatch: ${JSON.stringify(r)}`);
    await sleep(30);
    assert(!x.armed() && x.page.clickCapture.size === 0, 'early answer still disarms the page listener');
  },
  async legacyUnbounded(bg) {
    const x = makeExt(bg);
    const pending = x.send(start({ pickTimeoutMs: undefined }));
    await x.untilArmed();
    assert(x.armCalls()[0].args[2] === 0, 'no pickTimeoutMs → no page bound (legacy caller)');
    await x.send(cancel());
    await withDeadline(pending, 1000, 'legacy cancel');
  },
};

async function runExt(bg, names = Object.keys(EXT_SCENARIOS)) {
  for (const name of names) await EXT_SCENARIOS[name](bg);
}

// ─── 1. Extension: STANDARD Visual pick lifecycle (real background.js + page) ──
console.log('Extension — STANDARD Visual pick (fresh tab)');
await EXT_SCENARIOS.success(BG_SRC);
pass('E1', 'successful pick unchanged (#user); listener removed; session cleared');
await EXT_SCENARIOS.pageTimeout(BG_SRC);
pass('E2', 'bounded: page timeout → visual_pick_timeout; listener removed');
await EXT_SCENARIOS.cancelArmed(BG_SRC);
pass('E3', 'cancel while armed disarms the page; START answers visual_pick_cancelled; later click not swallowed');
await EXT_SCENARIOS.cancelBeforeArm(BG_SRC);
pass('E4', 'cancel before arm (Hub gave up during tab load) → the pick is never armed');
await EXT_SCENARIOS.cancelOriginFailClosed(BG_SRC);
pass('E5', 'cancel is origin fail-closed');
await EXT_SCENARIOS.earlyExitDisarms(BG_SRC);
pass('E6', 'any early answer (navigation away) disarms the page listener');
await EXT_SCENARIOS.legacyUnbounded(BG_SRC);
pass('E7', 'no pickTimeoutMs → legacy unbounded arm (the Hub always sends it now)');

const reverted = revertD12142BackgroundEdits(BG_SRC);
assert(!reverted.includes('ADMIN_VISUAL_MAPPING_CANCEL') && !reverted.includes('standardVisualPickSession'), 'revert removes all D-121-42 code');
const stdFn = BG_SRC.slice(BG_SRC.indexOf('function openPageAndVisualMapping'), BG_SRC.indexOf('\nfunction ', BG_SRC.indexOf('function openPageAndVisualMapping') + 10));
assert(stdFn.includes("files: [\n            'generic/managed-target-eligibility.js',") && stdFn.includes('frameIds: [0]') && !stdFn.includes('allFrames'), 'STANDARD stays frame 0, same files');
assert(!stdFn.includes('mode:') && !stdFn.includes('pickTarget'), 'STANDARD arms a field pick (no SPECIAL mode / action pick)');
assert(stdFn.includes('return openGenericRealSiteTab('), 'STANDARD fresh-tab model unchanged');
pass('E8', 'background.js: D-121-42 edits are exactly the listed ones; frame 0 / fresh tab / field pick unchanged');

// ─── 2. Hub: startVisualMappingForField / cancelVisualMappingForField ─────────
console.log('\nHub — STANDARD Visual call');
function loadHub(visualSrc) {
  return withTempDir('pv-12142-hub-', (outdir) => loadHubIn(outdir, visualSrc));
}
async function loadHubIn(outdir, visualSrc) {
  const outfile = join(outdir, 'hub.mjs');
  const stubPlugin = {
    name: 'stub',
    setup(b) {
      b.onResolve({ filter: /browserIntegration$|^stub:bi$/ }, () => ({ path: 'bi', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents:
          'export const sent = []; let reply = () => null; export function setReply(fn) { reply = fn; }' +
          ' export function probeExtensionAvailable() { return true; }' +
          ' export async function sendExtensionMessageAsync(m) { sent.push(m); return reply(m); }',
        loader: 'js',
      }));
    },
  };
  const visualOverride = {
    name: 'visual-override',
    setup(b) {
      b.onLoad({ filter: /assistedMapping[\\/]visualMapping\.ts$/ }, () => ({ contents: visualSrc, loader: 'ts', resolveDir: join(root, 'src/assistedMapping') }));
    },
  };
  await build({
    stdin: {
      contents: "export * from './src/assistedMapping/visualMapping.ts'; export * from './src/assistedMapping/types.ts'; export { sent, setReply } from 'stub:bi';",
      resolveDir: root,
      loader: 'ts',
    },
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    plugins: [stubPlugin, visualOverride],
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}
const HUB_VISUAL_SRC = readFileSync(join(root, 'src/assistedMapping/visualMapping.ts'), 'utf8');
async function hubChecks(visualSrc) {
  const hub = await loadHub(visualSrc);
  hub.setReply(() => ({ ok: false, reason: 'visual_pick_timeout' }));
  const t = await hub.startVisualMappingForField({ fieldId: 'username', loginEntryUrl: LOGIN_URL });
  const sentStart = hub.sent.at(-1);
  assert(sentStart.type === 'ADMIN_VISUAL_MAPPING_START' && sentStart.pickTimeoutMs === hub.ADMIN_VISUAL_PICK_TIMEOUT_MS, 'START carries the shared bound');
  assert(t.ok === false && t.reason === 'visual_pick_timeout', 'timeout reason surfaced to the editor');
  hub.setReply(() => ({ ok: false, reason: 'visual_pick_cancelled' }));
  const c = await hub.startVisualMappingForField({ fieldId: 'username', loginEntryUrl: LOGIN_URL });
  assert(c.ok === false && c.reason === 'visual_pick_cancelled', 'cancelled reason surfaced');
  hub.setReply(() => ({ ok: true, fieldId: 'username', locator: '#user', meta: { idAttr: 'user' } }));
  const s = await hub.startVisualMappingForField({ fieldId: 'username', loginEntryUrl: LOGIN_URL });
  assert(s.ok === true && s.locator === '#user' && s.observedInputId === 'id:user' && s.state === 'IDENTIFIED_AND_MANAGED_ELIGIBLE', 'success unchanged');
  hub.setReply(() => ({ ok: false, reason: 'managed_ineligible' }));
  const m = await hub.startVisualMappingForField({ fieldId: 'username', loginEntryUrl: LOGIN_URL });
  assert(m.state === 'IDENTIFIED_BUT_MANAGED_INELIGIBLE', 'managed eligibility unchanged');
  hub.setReply(() => ({ ok: true, disarmed: true }));
  const k = await hub.cancelVisualMappingForField({ loginEntryUrl: LOGIN_URL });
  const sentCancel = hub.sent.at(-1);
  assert(sentCancel.type === 'ADMIN_VISUAL_MAPPING_CANCEL' && sentCancel.allowedOrigin === ORIGIN, 'cancel message + origin');
  assert(k.ok === true && k.disarmed === true, 'cancel result');
  assert(hub.ADMIN_VISUAL_PICK_TIMEOUT_MS === 60000 && hub.ADMIN_VISUAL_PICK_HUB_GRACE_MS === 5000, 'shared values = SPECIAL values');
}
await hubChecks(HUB_VISUAL_SRC);
pass('H1', 'START sends the shared 60 s bound; timeout / cancel reasons surfaced; success + eligibility unchanged; cancel message');

// ─── 3. Shared pick-session helper (token / timeout / cancel) ─────────────────
console.log('\nShared pick-session helper');
function loadSession(src) {
  return withTempDir('pv-12142-sess-', async (outdir) => {
    const outfile = join(outdir, 'session.mjs');
    await build({
      stdin: { contents: src, resolveDir: join(root, 'src/admin'), loader: 'ts', sourcefile: 'visualPickSession.ts' },
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      packages: 'external',
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  });
}
function fakeTimers() {
  const timers = new Map();
  let next = 1;
  return {
    timers,
    set: (fn, ms) => {
      const id = next++;
      timers.set(id, { fn, ms });
      return id;
    },
    clear: (id) => timers.delete(id),
    fireAll() {
      for (const [id, t] of [...timers]) {
        timers.delete(id);
        t.fn();
      }
    },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
const SESSION_SRC = read('src/admin/visualPickSession.ts');
async function sessionChecks(src) {
  const { AdminVisualPickSession } = await loadSession(src);
  // Hub give-up: bound + grace → disarm once, editor released, late answer ignored.
  let ft = fakeTimers();
  let s = new AdminVisualPickSession(ft);
  let d = deferred();
  let disarms = 0;
  let hubTimeouts = 0;
  let run = s.run({ start: () => d.promise, disarm: () => (disarms += 1), onHubTimeout: () => (hubTimeouts += 1) });
  assert(s.armed && [...ft.timers.values()][0].ms === 65000, 'Hub safety bound = 60 s + 5 s grace');
  ft.fireAll();
  await sleep(0);
  assert(disarms === 1 && hubTimeouts === 1 && !s.armed, 'Hub give-up disarms the page and releases the editor');
  d.resolve({ ok: true, locator: '#late' });
  assert((await run).stale === true, 'late answer after give-up ignored');

  // Cancel: disarm once, late answer ignored, second cancel is a no-op.
  ft = fakeTimers();
  s = new AdminVisualPickSession(ft);
  d = deferred();
  disarms = 0;
  run = s.run({ start: () => d.promise, disarm: () => (disarms += 1), onHubTimeout: () => assert(false, 'no Hub timeout after cancel') });
  assert(s.cancel() === true && !s.armed && ft.timers.size === 0, 'cancel releases + clears the timer');
  await sleep(0);
  assert(disarms === 1, 'cancel disarms the page');
  assert(s.cancel() === false, 'nothing armed after cancel');
  d.resolve({ ok: true, locator: '#late' });
  assert((await run).stale === true, 'late answer after cancel ignored');
  ft.fireAll();

  // Success: result delivered, no disarm, timer cleared.
  ft = fakeTimers();
  s = new AdminVisualPickSession(ft);
  disarms = 0;
  const okRun = await s.run({ start: async () => ({ ok: true, locator: '#user' }), disarm: () => (disarms += 1), onHubTimeout: () => {} });
  assert(okRun.stale === false && okRun.result.locator === '#user' && disarms === 0 && ft.timers.size === 0 && !s.armed, 'success delivered; no disarm');

  // Superseded: an old answer arriving during a newer pick is ignored; the newer pick is delivered.
  ft = fakeTimers();
  s = new AdminVisualPickSession(ft);
  const d1 = deferred();
  const d2 = deferred();
  const r1 = s.run({ start: () => d1.promise, disarm: () => {}, onHubTimeout: () => {} });
  s.cancel();
  const r2 = s.run({ start: () => d2.promise, disarm: () => {}, onHubTimeout: () => {} });
  d1.resolve({ ok: true, locator: '#old' });
  assert((await r1).stale === true && s.armed, 'old answer ignored; newer pick still armed');
  d2.resolve({ ok: true, locator: '#new' });
  const out2 = await r2;
  assert(out2.stale === false && out2.result.locator === '#new', 'newer pick delivered');

  // start() throws: released and rethrown.
  ft = fakeTimers();
  s = new AdminVisualPickSession(ft);
  let threw = false;
  try {
    await s.run({ start: async () => { throw new Error('x'); }, disarm: () => {}, onHubTimeout: () => {} });
  } catch {
    threw = true;
  }
  assert(threw && !s.armed && ft.timers.size === 0, 'failed start releases the session');
}
await sessionChecks(SESSION_SRC);
pass('S1', 'Hub give-up (60 s + 5 s) disarms + releases; cancel disarms; late / superseded answers ignored (token)');

// ─── 4. Editors: same lifecycle + copy parity ──────────────────────────────────
console.log('\nEditors — STANDARD aligned to SPECIAL');
const copySrc = read('src/admin/visualPickCopy.ts');
const stdSrc = read('src/admin/AutofillProfileEditor.tsx');
const specialSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const copyMod = await withTempDir('pv-12142-copy-', async (outdir) => {
  const outfile = join(outdir, 'copy.mjs');
  await build({ entryPoints: [join(root, 'src/admin/visualPickCopy.ts')], outfile, bundle: true, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return await import(pathToFileURL(outfile).href);
});
const C = copyMod.ADMIN_VISUAL_PICK_COPY_HE;
assert(C.timeoutField === TIMEOUT_COPY, 'exact timeout copy');
assert(C.cancelHint === CANCEL_HINT, 'exact cancel hint');
for (const [key, shared] of [
  ['visualPickWaitingField', 'waitingField'],
  ['visualPickCancelHint', 'cancelHint'],
  ['siteTabActive', 'siteTabActive'],
  ['visualPickCancelled', 'cancelled'],
  ['visualPickTimeoutField', 'timeoutField'],
]) {
  assert(specialSrc.includes(`${key}: ADMIN_VISUAL_PICK_COPY_HE.${shared},`), `SPECIAL ${key} ← shared ${shared}`);
}
for (const shared of ['waitingField', 'cancelHint', 'siteTabActive', 'cancelled', 'timeoutField']) {
  assert(stdSrc.includes(`ADMIN_VISUAL_PICK_COPY_HE.${shared}`), `STANDARD uses shared ${shared}`);
}
for (const text of Object.values(C)) {
  assert(!stdSrc.includes(`'${text}'`) && !specialSrc.includes(`'${text}'`), `no duplicated literal of shared copy: ${text}`);
}
pass('C1', 'copy parity: both editors read the same module; exact timeout copy and «ביטול» hint');

const fnSlice = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start) + start.length));
const reqFn = fnSlice(stdSrc, 'async function requestVisualMapping', 'function cancelVisualMapping');
const cancelFn = fnSlice(stdSrc, 'function cancelVisualMapping', 'function requestClearMapping');
assert(reqFn.includes('session.run({') && reqFn.includes('disarm: () => cancelVisualMappingForField({ loginEntryUrl: pickLoginEntryUrl })'), 'STANDARD pick runs through the shared session + Ext cancel');
assert(/onHubTimeout: \(\) => \{\s*setVisualMappingFieldId\(null\);\s*setError\(ADMIN_VISUAL_PICK_COPY_HE\.timeoutField\);/.test(reqFn), 'Hub give-up → release + timeout copy');
const staleAt = reqFn.indexOf('if (outcome.stale) {');
assert(staleAt > 0 && staleAt < reqFn.indexOf('setLocators(') && staleAt < reqFn.indexOf('setFieldAuthoring('), 'late answer returns before any write');
assert(/result\.reason === 'visual_pick_timeout'\) \{\s*setError\(ADMIN_VISUAL_PICK_COPY_HE\.timeoutField\);/.test(reqFn), 'page timeout → same copy');
assert(/result\.reason === 'visual_pick_cancelled'\) \{\s*setSuccess\(ADMIN_VISUAL_PICK_COPY_HE\.cancelled\);/.test(reqFn), 'cancelled → same copy');
assert(cancelFn.includes('pickSessionRef.current?.cancel()') && cancelFn.includes('setVisualMappingFieldId(null)') && cancelFn.includes('setSuccess(ADMIN_VISUAL_PICK_COPY_HE.cancelled)'), 'cancel releases + shows cancelled copy');
for (const w of ['setLocators', 'setFieldAuthoring', 'updateGlobalRegistryRow']) assert(!cancelFn.includes(w), `cancel writes nothing (${w})`);
assert(/return \(\) => \{\s*session\?\.cancel\(\);\s*\};\s*\}, \[\]\);/.test(stdSrc), 'unmount disarms a pending pick');
const panel = fnSlice(stdSrc, '{visualMappingFieldId ? (\n        <div', ') : null}');
assert(panel.includes('ADMIN_VISUAL_PICK_COPY_HE.waitingField') && panel.includes('ADMIN_VISUAL_PICK_COPY_HE.cancelHint') && panel.includes('ADMIN_VISUAL_PICK_COPY_HE.siteTabActive'), 'same in-progress indicator');
assert(/data-action="standard-visual-cancel"\s*onClick=\{cancelVisualMapping\}\s*>\s*ביטול\s*<\/button>/.test(panel) && !/standard-visual-cancel"[^>]*disabled=/.test(panel), '«ביטול» button (enabled while busy)');
const specialPanel = fnSlice(specialSrc, '{armedPick ? (', ') : null}');
assert(specialPanel.includes('<strong>{armedPick.label}</strong>. {SPECIAL_EDITOR_COPY_HE.visualPickCancelHint}') && panel.includes('</strong>\n            . {ADMIN_VISUAL_PICK_COPY_HE.cancelHint}'), 'same indicator layout (label. hint)');
pass('U1', 'STANDARD editor: shared session, timeout / cancel copy, late answer ignored, unmount disarm, same indicator + «ביטול»');

// Unchanged: what is saved / authoring flags / locator rules / SPECIAL path.
assert(reqFn.includes('applyVisualMappingAuthoring({') && reqFn.includes('visualTargetsEquivalent({') && reqFn.includes('[result.fieldId]: result.locator,'), 'success writes unchanged');
assert(specialSrc.includes('}, ADMIN_VISUAL_PICK_TIMEOUT_MS + ADMIN_VISUAL_PICK_HUB_GRACE_MS);') && specialSrc.includes('if (pickTokenRef.current !== token) return null;'), 'SPECIAL lifecycle intact (same bound + token)');
const pickSrc = read('extension/generic/visual-target-pick.js');
assert(pickSrc.includes("disarm('visual_pick_timeout')") && pickSrc.includes('assertLocatorDeterministic(chosen.locator, el, doc)'), 'page pick semantics unchanged');
const manifest = JSON.parse(read('extension/manifest.json'));
// Byte-level manifest pin lives in verifyPhase121Runtime.mjs; here: permissions unchanged.
assert(JSON.stringify(manifest.permissions) === JSON.stringify(['tabs', 'scripting']), 'no new permission');
for (const rel of ['extension/generic/validated-autofill.js', 'src/execution/serviceExecution.ts']) {
  assert(!/visual_pick|ADMIN_VISUAL_MAPPING_CANCEL|AdminVisualPickSession/.test(read(rel)), `${rel} untouched by D-121-42`);
}
const newCode = [stdFn, fnSlice(BG_SRC, 'function cancelStandardVisualMapping', '\n}\n'), SESSION_SRC, copySrc, reqFn].join('\n');
assert(!/hostname|serviceId ===|\.co\.il|fixture/i.test(newCode), 'no site / hostname / serviceId branches');
pass('U2', 'unchanged: success writes / flags, SPECIAL lifecycle, page pick rules, manifest, runtime; no site branches');

// ─── 5. Mutations (each must be caught) ────────────────────────────────────────
console.log('\nMutations');
async function expectCaught(label, fn) {
  let caught = false;
  try {
    await fn();
  } catch {
    caught = true;
  }
  assert(caught, `mutation NOT caught: ${label}`);
  console.log(`  ✓ mutation caught: ${label}`);
}
await expectCaught('M1 page bound not passed to armVisualTargetPick', () =>
  runExt(replaceOnce(BG_SRC, 'if (pickBoundMs > 0) pickOptions.timeoutMs = pickBoundMs;', '', 'M1'), ['pageTimeout']),
);
await expectCaught('M2 cancel handler does not disarm the page', () =>
  runExt(
    replaceOnce(
      BG_SRC,
      "disarmStandardVisualPick(tabId, 'visual_pick_cancelled', function (disarmed, failed) {",
      "(function (_t, _r, cb) { cb(false, false); })(tabId, 'visual_pick_cancelled', function (disarmed, failed) {",
      'M2',
    ),
    ['cancelArmed'],
  ),
);
await expectCaught('M3 cancelled-before-arm guard removed', () =>
  runExt(replaceOnce(BG_SRC, 'if (session.cancelled) {\n            // Hub cancelled', 'if (false) {\n            // Hub cancelled', 'M3'), ['cancelBeforeArm']),
);
await expectCaught('M4 early answer leaves the page armed', () =>
  runExt(replaceOnce(BG_SRC, "      disarmStandardVisualPick(session.tabId, 'visual_pick_cancelled');\n", '', 'M4'), ['earlyExitDisarms']),
);
await expectCaught('M5 Hub START without the shared bound', () =>
  hubChecks(replaceOnce(HUB_VISUAL_SRC, '    pickTimeoutMs: ADMIN_VISUAL_PICK_TIMEOUT_MS,\n', '', 'M5')),
);
await expectCaught('M6 late answer not ignored (token check removed)', () =>
  sessionChecks(replaceOnce(SESSION_SRC, '    if (this.activeToken !== token) return { stale: true };\n    this.release();', '    this.release();', 'M6')),
);
await expectCaught('M7 cancel does not disarm the page', () =>
  sessionChecks(replaceOnce(SESSION_SRC, '    this.token += 1;\n    disarmSafely(disarm);\n    return true;', '    this.token += 1;\n    return true;', 'M7')),
);
await expectCaught('M8 Hub give-up does not disarm the page', () =>
  sessionChecks(replaceOnce(SESSION_SRC, '      disarmSafely(disarm);\n      opts.onHubTimeout();', '      opts.onHubTimeout();', 'M8')),
);

console.log(`\nD-121-42 verify: ${passCount} checks PASS, 8 mutations caught`);
// Mutated background copies leave their (up to 120 s) operation timers pending.
process.exit(0);
