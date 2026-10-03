/**
 * Phase 121 D-121-47 — Analyze proposal quality (G5–G8) + regression guards R-a…R-f.
 * Synthetic fixtures only (no site names). Mutations: one per item 1–4 and per guard.
 * Usage: node scripts/verifyPhase121AnalyzeProposalQuality.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function overridePlugin(overrides) {
  return {
    name: 'pv-overrides',
    setup(b) {
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const rel = relative(root, args.path).replace(/\\/g, '/');
        if (overrides[rel] === undefined) return undefined;
        return { contents: overrides[rel], loader: rel.endsWith('.tsx') ? 'tsx' : 'ts' };
      });
    },
  };
}

const loadModule = (entry, name, overrides = {}) => withTempDir(`pv-12147-${name}-`, (outdir) => loadModuleIn(outdir, entry, name, overrides));
async function loadModuleIn(outdir, entry, name, overrides) {
  const outfile = join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
    plugins: [overridePlugin(overrides)],
  });
  return import(pathToFileURL(outfile).href);
}

async function loadHubModules(overrides = {}) {
  return {
    routing: await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing', overrides),
    intent: await loadModule('src/assistedMapping/specialActionIntent.ts', 'intent', overrides),
    lc: await loadModule('src/loginContract/index.ts', 'contract', overrides),
    hub: await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub', overrides),
  };
}

const PAGE_FILES = [
  'extension/generic/managed-target-eligibility.js',
  'extension/generic/locator-determinism.js',
  'extension/generic/page-structure-inspect.js',
  'extension/generic/visual-target-pick.js',
];

function loadDom(sources, html, origin = 'https://fixture.example.test') {
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  Object.defineProperty(window, 'location', {
    value: { href: `${origin}/login`, origin, protocol: 'https:' },
    configurable: true,
  });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  const hiddenStyle = (el) => /display:\s*none|visibility:\s*hidden/i.test(el?.getAttribute?.('style') || '');
  window.getComputedStyle = (el) => {
    const style = el?.getAttribute?.('style') || '';
    return {
      display: /display:\s*none/i.test(style) ? 'none' : 'block',
      visibility: /visibility:\s*hidden/i.test(style) ? 'hidden' : 'visible',
      opacity: '1',
      pointerEvents: 'auto',
    };
  };
  const Proto = window.HTMLElement.prototype;
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    let n = this;
    while (n && n.nodeType === 1) {
      if (hiddenStyle(n)) return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 };
      n = n.parentElement;
    }
    return { width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 };
  };
  Proto.getClientRects = function getClientRects() {
    const r = this.getBoundingClientRect();
    return r.width > 0 ? [r] : [];
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  for (const rel of PAGE_FILES) {
    const run = new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`);
    run(window, window.document, window, globalThis.CSS);
  }
  return window;
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

function listFiles(dirRel, re) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (re.test(name)) out.push(relative(root, p).replace(/\\/g, '/'));
    }
  };
  walk(join(root, dirRel));
  return out;
}

// ─── Extension background harness (same model as verifyPhase121IframeSurface) ───
const ORIGIN = 'https://fixture.example';
const FRAME_ORIGIN = 'https://auth.fixture-idp.example';
const FRAME = { frameLocator: 'iframe#login-frame', frameOrigin: FRAME_ORIGIN };
const SAME_FRAME = { frameLocator: 'iframe#same-login', frameOrigin: ORIGIN };

function loadExt(bgSrc, corrSrc, chrome) {
  const start = bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface');
  const end = bgSrc.indexOf('function openPageAndManagedAutofill');
  assert(start > 0 && end > start, 'fixture: Ext SPECIAL block located');
  const src = bgSrc
    .slice(start, end)
    .replace('var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 5;')
    .replace('var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 5;');
  const prelude = `
    var ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10, ADMIN_INSPECT_READINESS_POLL_MS = 1;
    var SPECIAL_VISUAL_PICK_DEFAULT_TIMEOUT_MS = 1000, SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS = 2000;
    var specialVisualPickArmed = null;
    function ensureSpecialAuthoringTab(m, cb) { cb({ ok: true, tabId: 7, reused: true }); }
    function activateSpecialAuthoringTab(t, cb) { cb(true); }
    function withAuthoringTab(r, t) { return Object.assign({}, r, { authoringTabId: t }); }
    function rejectIfReopenLoginEntryRequested() { return false; }
  `;
  // eslint-disable-next-line no-new-func
  return new Function('chrome', `${prelude}\n${src}\nreturn { click: authoringClickApprovedAction };`)(chrome);
}

function frameWindow(f, ctx) {
  if (f.__win) return f.__win;
  const listeners = [];
  const win = {
    location: { origin: f.origin },
    crypto: webcrypto,
    addEventListener(type, fn) {
      if (type === 'message') listeners.push(fn);
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    __dispatch(data, source) {
      for (const fn of listeners.slice()) fn({ data: structuredClone(data), source });
    },
  };
  f.__win = win;
  if (f.depth === 0) {
    win.top = win;
    win.parent = win;
    win.document = {
      querySelectorAll(sel) {
        const els = ctx.frames().filter((x) => x.depth === 1).map((x) => frameElement(x, ctx));
        if (sel === 'iframe') return els;
        const m = /^iframe#(.+)$/.exec(sel);
        return m ? els.filter((el) => el.id === m[1]) : [];
      },
    };
  } else {
    const top = frameWindow(ctx.frames().find((x) => x.depth === 0), ctx);
    win.top = top;
    win.parent = top;
  }
  return win;
}
function frameElement(f, ctx) {
  if (f.__el) return f.__el;
  const id = f.locator ? /^iframe#(.+)$/.exec(f.locator)[1] : '';
  f.__el = {
    tagName: 'IFRAME',
    id,
    getAttribute: () => null,
    getBoundingClientRect: () => ({ width: 352, height: 364 }),
    get contentWindow() {
      const topWin = frameWindow(ctx.frames().find((x) => x.depth === 0), ctx);
      return {
        postMessage(msg) {
          setTimeout(() => frameWindow(f, ctx).__dispatch(msg, topWin), 0);
        },
      };
    },
  };
  return f.__el;
}
function runInWindow(win, func, args) {
  // eslint-disable-next-line no-new-func
  return new Function('__w', '__f', '__a', 'with (__w) { return eval("(" + __f + ")").apply(null, __a); }')(win, String(func), args || []);
}

/** frames = [{ frameId, origin, depth, locator?, creds?: string[], passwords?: string[], clickables? }]. */
function mockChrome(corrSrc, frames) {
  const ctx = { frames: () => frames };
  const credItems = (f) => (f.creds || []).map((locator) => ({ locator, password: (f.passwords || []).includes(locator) }));
  const chrome = {
    runtime: { lastError: null },
    tabs: { get: (id, cb) => setTimeout(() => cb({ id, url: `${ORIGIN}/` }), 0) },
    scripting: {
      executeScript(details, cb) {
        const done = (value, err) =>
          setTimeout(() => {
            chrome.runtime.lastError = err ? { message: err } : null;
            cb(value);
            chrome.runtime.lastError = null;
          }, 0);
        const t = details.target;
        const byId = (id) => frames.find((f) => f.frameId === id);
        const fsrc = details.func ? String(details.func) : '';
        const probe = (f) => ({ origin: f.origin, protocol: new URL(f.origin).protocol, isTop: f.depth === 0, isDepth1: f.depth === 1 });
        if (t.allFrames && details.files) {
          for (const f of frames) {
            // eslint-disable-next-line no-new-func
            if (details.files.includes('generic/frame-correlation.js')) new Function('window', corrSrc)(frameWindow(f, ctx));
          }
          return done(frames.map((f) => ({ frameId: f.frameId, result: undefined })));
        }
        if (t.allFrames && fsrc.includes('__readFrameCorrelationNonces')) {
          return done(frames.map((f) => ({ frameId: f.frameId, result: runInWindow(frameWindow(f, ctx), details.func, details.args) })));
        }
        if (t.allFrames) {
          if (details.func && details.func.name === 'specialFrameProbe') {
            return done(frames.map((f) => ({ frameId: f.frameId, result: probe(f) })));
          }
          return done(frames.map((f) => ({ frameId: f.frameId, result: false })));
        }
        const fid = t.frameIds[0];
        const f = byId(fid);
        if (details.files) return f ? done(undefined) : done(undefined, 'Cannot access frame');
        if (!f) return done(undefined, 'No frame with id ' + fid);
        const args = details.args || [];
        if (details.func && details.func.name === 'specialFrameProbe') return done([{ frameId: fid, result: probe(f) }]);
        if (fsrc.includes('__collectFrameCorrelation') || fsrc.includes('__resolveFrameByLocator')) {
          return done([{ frameId: 0, result: runInWindow(frameWindow(f, ctx), details.func, args) }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredentialInputs')) {
          return done([{ frameId: fid, result: f.origin === args[0] ? credItems(f) : [] }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredentialLocators')) {
          return done([{ frameId: fid, result: f.origin === args[0] ? [...(f.creds || [])] : [] }]);
        }
        if (fsrc.includes('isSpecialDeclaredReadinessMet')) {
          if (f.origin !== args[0]) return done([{ frameId: fid, result: { met: false, originMismatch: true } }]);
          return done([{ frameId: fid, result: { met: (f.creds || []).includes(args[1]) } }]);
        }
        if (fsrc.includes('.click()')) {
          if (f.origin !== args[1]) return done([{ frameId: fid, result: { ok: false, reason: 'frame_origin_mismatch' } }]);
          const handler = f.clickables && f.clickables[args[0]];
          if (!handler) return done([{ frameId: fid, result: { ok: false, reason: 'click_target_missing' } }]);
          handler();
          return done([{ frameId: fid, result: { ok: true } }]);
        }
        return done(undefined, 'unexpected script');
      },
    },
  };
  return chrome;
}
const call = (ext, msg) => new Promise((resolve) => ext.click(msg, resolve));
const topFrame = (extra = {}) => ({ frameId: 0, origin: ORIGIN, depth: 0, ...extra });
const revealClick = (extra = {}) => ({
  allowedOrigin: ORIGIN,
  locator: '#open',
  locatorType: 'css',
  approvedForAuthoringContinuation: true,
  kind: 'floating_opener',
  readinessMode: 'reveal',
  readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 120 },
  ...extra,
});

// ─── Check groups ────────────────────────────────────────────────────────────
const obs = (id, fields) => ({ actionCandidateId: id, tagName: 'button', locator: `#${id}`, locatorType: 'css', matchCount: 1, label: fields.visibleText || fields.ariaLabel || `#${id}`, ...fields });
const idsOf = (proposals) => proposals.map((p) => p.actionCandidateId);

function checkIntentAndParity(c) {
  const { intent } = c.m;
  const I = (t) => intent.actionIntent([t]);
  for (const t of ['התחברות', 'להתחברות', 'כניסה', 'Log in', 'Sign-in', 'LOGIN', 'My Account', 'אזור אישי']) {
    assert(I(t).login, `G7 login word: ${t}`);
  }
  for (const t of ['Blogin', 'loginbox', 'שלהתחברות', 'Logout', 'Sign up']) assert(!I(t).login, `G7 whole word (not login): ${t}`);
  for (const t of ['Next slide', 'carousel', 'Previous', 'צור קשר', 'צ׳אט', 'עגלה', 'Newsletter', 'הרשמה', 'Register']) {
    assert(I(t).negative, `G7 negative word: ${t}`);
  }
  assert(!I('Research').negative && !I('Contacts').negative, 'G7 negatives are whole words');
  for (const t of ['Go', 'Google', 'Load more', 'More']) assert(!I(t).transition, `G7 unanchored go / more removed: ${t}`);
  assert(I('המשך').transition && I('Next').transition, 'G7 transition words');
  assert(!intent.ACTION_INTENT_VOCABULARY.transition.includes('go') && !intent.ACTION_INTENT_VOCABULARY.transition.includes('more'), 'G7 vocabulary has no go / more');

  const w = loadDom(c.pageSources, '<div></div>');
  const ext = w.__pageStructureInspectHelpers;
  assert(JSON.stringify(ext.ACTION_INTENT_VOCABULARY) === JSON.stringify(intent.ACTION_INTENT_VOCABULARY), 'vocabulary parity: extension copy === Hub vocabulary');
  const samples = ['התחברות', 'Blogin', 'Research', 'Next slide', 'הרשמה / התחברות', 'צ׳אט', 'My Account', 'שלהתחברות', 'Go', ''];
  for (const s of samples) {
    const hub = I(s);
    const expected = hub.login ? 1 : hub.negative ? 4 : 3;
    assert(ext.actionRankTier([s], false) === expected, `tokenizer parity (extension tier matches Hub intent): ${s}`);
  }
  return 'G7 whole-word vocabulary (login / negative / transition; Hebrew one-letter prefix; no go / more) + extension ↔ Hub parity';
}

function checkPatternRelevance(c) {
  const { routing } = c.m;
  const cands = [
    obs('a1', { visibleText: 'המשך' }),
    obs('a2', { visibleText: 'התחברות' }),
    obs('a3', { visibleText: 'Next' }),
    obs('a4', { visibleText: 'עזרה' }),
  ];
  const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: cands });
  assert(f.length === 4 && f.every((p) => p.kind === 'floating_opener' && p.action.kind === 'floating_opener'), 'G6 FLOATING_SCREEN proposes only floating_opener');
  const m = routing.proposeSpecialActionCandidates({ pattern: 'MULTI_STEP', actionCandidates: cands });
  assert(m.length === 4 && m.every((p) => p.kind === 'intermediate_transition'), 'G6 MULTI_STEP proposes only intermediate_transition');
  assert(idsOf(m)[0] === 'a1' && idsOf(m)[1] === 'a3', 'MULTI_STEP: transition words first');
  const both = routing.proposeSpecialActionCandidates({
    pattern: 'FLOATING_SCREEN_MULTI_STEP',
    actionCandidates: [...cands, obs('a5', { visibleText: 'המשך להתחברות' })],
  });
  const kindOf = (id) => both.find((p) => p.actionCandidateId === id).kind;
  assert(kindOf('a1') === 'intermediate_transition' && kindOf('a2') === 'floating_opener' && kindOf('a5') === 'floating_opener', 'G6 FLOATING_SCREEN_MULTI_STEP proposes both kinds (login word → opener)');
  assert(both.every((p) => p.kind !== 'final_submit' && p.action.approvedForAuthoringContinuation === false && p.action.approvedForRuntime !== true), 'proposals unapproved; never final_submit');
  return 'G6 pattern relevance: FLOATING_SCREEN → opener only; MULTI_STEP → transition only; combined → both';
}

function checkVisibleTextFixture(c) {
  const { routing } = c.m;
  // Plugin-style aria-label overrides the visible «התחברות».
  const w = loadDom(c.pageSources, `
    <button class="help-btn">עזרה</button>
    <a class="plugin-login" href="/account" aria-label="Opens in a new window">התחברות</a>`);
  const out = w.collectSpecialAuthoringActionCandidates();
  const login = out.find((a) => a.visibleText === 'התחברות');
  assert(login && login.ariaLabel === 'Opens in a new window' && login.label === 'התחברות', 'G5 collector sends visibleText / ariaLabel separately; label prefers visible text');
  assert(out[0] === login, 'G5 collector ranks the visible login word first');
  assert(out.every((a) => a.value === undefined && !('text' in a)), 'no value field emitted');
  const proposals = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
  assert(proposals[0].actionCandidateId === login.actionCandidateId && proposals[0].action.label === 'התחברות' && proposals[0].confidence === 'high', 'G5 Analyze proposes «התחברות» first (high) with the visible label');
  // Hub alone: legacy label = aria-label, visible text sent separately.
  const hubOnly = routing.proposeSpecialActionCandidates({
    pattern: 'FLOATING_SCREEN',
    actionCandidates: [
      obs('p1', { visibleText: 'עזרה' }),
      { ...obs('p2', { visibleText: 'התחברות', ariaLabel: 'Opens in a new window', title: 'popup' }), label: 'Opens in a new window' },
    ],
  });
  assert(hubOnly[0].actionCandidateId === 'p2', 'G5 intent uses any of visible text / aria-label / title');
  assert(hubOnly[0].action.label === 'התחברות', 'G5 Admin label prefers the visible text');
  const byTitle = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: [obs('t1', { visibleText: '•' }), obs('t2', { visibleText: '•', title: 'Sign in' })] });
  assert(byTitle[0].actionCandidateId === 't2', 'G5 title-only login word counts');
  return 'G5 plugin-style aria-label + visible «התחברות» → proposed first with the visible label';
}

function checkNegatives(c) {
  const { routing } = c.m;
  const w = loadDom(c.pageSources, `
    <button class="slick-next" aria-label="Next slide">›</button>
    <button class="menu-toggle">תפריט</button>
    <button class="go-on">המשך</button>`);
  const out = w.collectSpecialAuthoringActionCandidates();
  const carousel = out.find((a) => a.ariaLabel === 'Next slide');
  assert(carousel && out[out.length - 1] === carousel, 'G7 collector: carousel «Next slide» ranked last');
  const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
  assert(f[f.length - 1].actionCandidateId === carousel.actionCandidateId && f[f.length - 1].confidence === 'low', 'G7 FLOATING_SCREEN: carousel demoted (low, last)');
  const m = routing.proposeSpecialActionCandidates({ pattern: 'MULTI_STEP', actionCandidates: out });
  assert(m[m.length - 1].actionCandidateId === carousel.actionCandidateId, 'G7 MULTI_STEP: «Next slide» (transition word + negative) demoted');
  assert(m[0].action.label === 'המשך' && m[0].confidence === 'high', 'MULTI_STEP: «המשך» first');
  const plain = routing.proposeSpecialActionCandidates({ pattern: 'MULTI_STEP', actionCandidates: [obs('g1', { visibleText: 'Go' }), obs('g2', { visibleText: 'Load more' })] });
  assert(plain.every((p) => p.confidence === 'low'), 'G7 «Go» / «Load more» are plain (low)');
  return 'G7 carousel «Next slide» demoted in both kinds; «Go» / «Load more» no longer transition words';
}

function checkRegisterLogin(c) {
  const { routing } = c.m;
  const w = loadDom(c.pageSources, `
    <button class="menu-toggle">תפריט</button>
    <a href="#loginModal" class="reg-login">הרשמה / התחברות</a>
    <div id="loginModal" style="display:none"><input id="pw" type="password" /></div>`);
  const out = w.collectSpecialAuthoringActionCandidates();
  const reg = out.find((a) => a.visibleText === 'הרשמה / התחברות');
  assert(reg, 'R-a anchor to a hidden modal (#…) is a candidate (not a skip link)');
  assert(out[0] === reg, 'R-a collector: «הרשמה / התחברות» ranked first (login intent, not demoted)');
  const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
  assert(f[0].actionCandidateId === reg.actionCandidateId && f[0].confidence === 'high', 'R-a Analyze: «הרשמה / התחברות» first, high');
  const alone = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: [obs('r1', { visibleText: 'הרשמה' }), obs('r2', { visibleText: 'עזרה' })] });
  assert(idsOf(alone).join() === 'r2,r1', 'sign-up word alone is demoted');
  return 'R-a «הרשמה / התחברות» → login intent, first; «הרשמה» alone demoted';
}

function checkSkipLink(c) {
  const w = loadDom(c.pageSources, `
    <a href="#main" aria-label="דלג לכניסה לתוכן">דלג</a>
    <button class="menu-toggle">תפריט</button>
    <button class="open-login" data-toggle="modal" data-target="#lm">כניסה</button>
    <main id="main">תוכן</main><div id="lm" style="display:none"></div>`);
  const out = w.collectSpecialAuthoringActionCandidates();
  assert(!out.some((a) => a.visibleText === 'דלג' || /#main|דלג/.test(a.locator)), 'R-b skip link with «כניסה» in aria-label excluded before scoring');
  assert(out[0].visibleText === 'כניסה', 'R-b the real opener leads');
  return 'R-b skip link («לכניסה» in aria-label) stays excluded; the real opener leads';
}

function checkRankOrder(c) {
  const { routing } = c.m;
  const shape = (cls, target, inner) => `<a class="${cls}" href="#" role="button" data-toggle="modal" data-target="#${target}">${inner}</a>`;
  {
    const w = loadDom(c.pageSources, `
      <button class="deals-btn">מבצעים</button>
      <a href="/stores">סניפים</a>
      ${shape('t1', 'm1', '<span>•</span>')}`);
    const out = w.collectSpecialAuthoringActionCandidates();
    assert(out[0].locator === 'a[data-toggle="modal"][data-target="#m1"]', `R-f modal-trigger shape (no text) leads plain controls: ${out.map((a) => a.locator)}`);
    const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
    assert(f[0].actionCandidateId === out[0].actionCandidateId && f[0].confidence === 'medium', 'R-f Analyze keeps the popup lead (medium)');
  }
  {
    const w = loadDom(c.pageSources, `
      <button class="deals-btn">מבצעים</button>
      ${shape('t1', 'm1', '<span>•</span>')}
      <button class="enter-btn">כניסה</button>
      <button class="chat-btn" data-toggle="modal" data-target="#chat">צ'אט</button>`);
    const out = w.collectSpecialAuthoringActionCandidates();
    const order = out.map((a) => a.visibleText || a.locator);
    assert(order[0] === 'כניסה' && out[1].locator === 'a[data-toggle="modal"][data-target="#m1"]', `R-f only a login-word control outranks the popup shape: ${order}`);
    assert(order[order.length - 1] === "צ'אט", 'R-f negative (even with popup semantics) last');
    const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
    assert(JSON.stringify(idsOf(f)) === JSON.stringify(out.map((a) => a.actionCandidateId)), 'R-f Hub order = collector order (login → popup → plain → negative)');
  }
  {
    const w = loadDom(c.pageSources, `
      <button class="enter-btn">כניסה</button>
      ${shape('t2', 'm2', 'התחברות')}
      ${shape('t1', 'm1', '<span>•</span>')}`);
    const out = w.collectSpecialAuthoringActionCandidates();
    assert(out[0].locator === 'a[data-toggle="modal"][data-target="#m2"]' && out[1].visibleText === 'כניסה', 'R-f login word + popup → first, above login-word plain');
    const f = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out });
    assert(f[0].actionCandidateId === out[0].actionCandidateId && f[1].actionCandidateId === out[1].actionCandidateId && f[2].actionCandidateId === out[2].actionCandidateId, 'R-f Hub: login+popup → login → popup');
  }
  {
    const many = Array.from({ length: 45 }, (_, i) => `<button class="item-${i}">פריט ${i}</button>`).join('');
    const w = loadDom(c.pageSources, `${many}<button class="late-login">התחברות</button>`);
    const out = w.collectSpecialAuthoringActionCandidates();
    assert(out.length === 40 && out[0].visibleText === 'התחברות', 'ranking happens before the 40 cap (late login control kept, first)');
    assert(out.map((a) => a.actionCandidateId).join() === out.map((_, i) => `act-${i + 1}`).join(), 'ids assigned after ranking');
  }
  return 'R-f login+popup → login → popup → plain → negative (collector and Hub); popup shape keeps its lead; ranked before the cap';
}

function checkCredentialInputsDom(c) {
  // Layout visibility is not modelled by linkedom; Managed eligibility (unchanged module) is stubbed to "input".
  const dom = (html) => {
    const w = loadDom(c.pageSources, html);
    assert(w.ManagedTargetEligibility, 'fixture: eligibility module loaded');
    w.ManagedTargetEligibility.isSafeFillTarget = (el) => Boolean(el) && el.tagName === 'INPUT';
    return w;
  };
  const news = dom(`
    <form><input id="fname" name="firstName" autocomplete="given-name" />
    <input id="lname" name="lastName" autocomplete="family-name" />
    <input id="email" name="email" type="email" autocomplete="email" /></form>`);
  const n = news.collectSpecialEligibleCredentialInputs();
  assert(n.length === 3 && n.every((e) => e.password === false && typeof e.locator === 'string'), `G8 newsletter form: entries, none password (${JSON.stringify(n)})`);
  const login = dom(`
    <form><input id="user" name="user" autocomplete="username" />
    <input id="pass" name="pass" type="password" autocomplete="current-password" /></form>`);
  const l = login.collectSpecialEligibleCredentialInputs();
  assert(l.some((e) => e.locator === '#pass' && e.password === true), 'G8 login form: password entry flagged');
  assert(l.every((e) => Object.keys(e).sort().join() === 'locator,password'), 'G8 entries = locator + boolean only (no values)');
  assert(JSON.stringify(login.collectSpecialEligibleCredentialLocators()) === JSON.stringify(l.map((e) => e.locator)), 'legacy locator list unchanged');
  return 'G8 page side: credential inputs tagged password / not (locator + boolean only)';
}

async function checkRevealPassword(c) {
  const { hub } = c.m;
  const run = async (frames, msg) => call(loadExt(c.bgSrc, c.corrSrc, mockChrome(c.corrSrc, frames)), msg);
  // Newsletter: name / email only.
  const newsletter = () => {
    const top = topFrame({ creds: [] });
    top.clickables = { '#open': () => setTimeout(() => top.creds.push('#fname', '#lname', '#email'), 5) };
    return [top];
  };
  const r1 = await run(newsletter(), revealClick({ requirePasswordSurface: true }));
  assert(r1.ok === false && r1.reason === 'surface_not_login', `G8 FLOATING_SCREEN test: name / email-only form → surface_not_login (got ${JSON.stringify(r1)})`);
  // D-121-59 A1: surface_not_login has its own copy.
  assert(hub.authoringClickFailureMessageHe('surface_not_login') === 'המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.', 'G8 surface_not_login → its own copy (D-121-59 A1)');
  const r2 = await run(newsletter(), revealClick());
  assert(r2.ok === true, 'MULTI_STEP step 1 (no requirePasswordSurface) unaffected: identifier-only surface passes');
  // Login modal: identifier first, password shortly after.
  const top = topFrame({ creds: [], passwords: ['#pass'] });
  top.clickables = { '#open': () => { setTimeout(() => top.creds.push('#user'), 5); setTimeout(() => top.creds.push('#pass'), 25); } };
  const r3 = await run([top], revealClick({ requirePasswordSurface: true }));
  assert(r3.ok === true && r3.revealed.frame === null, 'G8 login surface with a password field passes (top document)');
  const idle = topFrame({ creds: ['#already'], clickables: { '#open': () => {} } });
  const r4 = await run([idle], revealClick({ requirePasswordSurface: true, readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 40 } }));
  assert(r4.ok === false && r4.reason === 'surface_not_revealed', 'nothing revealed → surface_not_revealed (unchanged)');
  return 'G8 single-step FLOATING_SCREEN test: newsletter → surface_not_login (own copy); password surface passes; MULTI_STEP step 1 unaffected';
}

async function checkRevealFrames(c) {
  // Frame snapshots are slower than top-only ones; 120 ms can expire before the second poll tick under load.
  const run = async (frames, msg) =>
    call(loadExt(c.bgSrc, c.corrSrc, mockChrome(c.corrSrc, frames)), { ...msg, readiness: { ...msg.readiness, timeoutMs: 1500 } });
  {
    const top = topFrame({ creds: [] });
    const frames = [top];
    const frame = { frameId: 4, origin: ORIGIN, depth: 1, locator: SAME_FRAME.frameLocator, creds: ['#u', '#p'], passwords: ['#p'] };
    top.clickables = { '#open': () => setTimeout(() => frames.push(frame), 5) };
    const r = await run(frames, revealClick({ requirePasswordSurface: true }));
    assert(r.ok === true && JSON.stringify(r.revealed.frame) === JSON.stringify(SAME_FRAME), `R-e same-origin depth-1 frame password counts (got ${JSON.stringify(r)})`);
  }
  {
    const top = topFrame({ creds: [] });
    const frames = [top];
    const frame = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, creds: ['#user', '#pass'], passwords: ['#pass'] };
    top.clickables = { '#open': () => setTimeout(() => frames.push(frame), 5) };
    const r = await run(frames, revealClick({ requirePasswordSurface: true }));
    assert(r.ok === true && JSON.stringify(r.revealed.frame) === JSON.stringify(FRAME), 'R-e cross-origin frame password (held for «אשר מסגרת») counts; frame reported for the approval prompt');
    assert(r.reason !== 'surface_not_login' && r.reason !== 'surface_not_revealed', 'R-e frame-approval flow never reported as «המסך לא נפתח»');
  }
  return 'R-e password in same-origin depth-1 frame / cross-origin frame pending «אשר מסגרת» counts';
}

async function checkScope(c) {
  // R-c: declared mode ignores the flag; only the FLOATING_SCREEN authoring test sends it.
  const top = topFrame({ creds: [] });
  top.clickables = { '#open': () => setTimeout(() => top.creds.push('#email'), 5) };
  const d = await call(loadExt(c.bgSrc, c.corrSrc, mockChrome(c.corrSrc, [top])), revealClick({ requirePasswordSurface: true, readinessMode: 'declared', readiness: { locator: '#email', timeoutMs: 120 } }));
  assert(d.ok === true && d.readinessMode === 'declared', 'R-c declared readiness unaffected by requirePasswordSurface');
  // D-121-59: FLOATING_SCREEN + a site password field (requirePasswordSurfaceFor; verifyPhase121PasswordlessSurface).
  assert(c.editorSrc.split('requirePasswordSurface: requirePasswordSurfaceFor(consentDraft.pattern, loginFields),').length === 2, 'R-c editor sends requirePasswordSurface only via requirePasswordSurfaceFor');
  assert(c.hubSrc.includes("...(input.requirePasswordSurface === true && readinessMode === 'reveal'"), 'R-c Hub sends the flag in reveal mode only');
  const users = listFiles('src', /\.(ts|tsx)$/).filter((rel) => read(rel).includes('requirePasswordSurface'));
  assert(users.sort().join() === 'src/admin/SpecialLoginDraftEditor.tsx,src/admin/specialActionBar.ts,src/assistedMapping/currentTabAuthoring.ts', `R-c flag used only by the authoring test path: ${users}`);
  const clickFn = extractFunction(c.bgSrc, 'authoringClickApprovedAction');
  assert(c.bgSrc.split('requirePasswordSurface').length === clickFn.split('requirePasswordSurface').length, 'R-c background: flag read only in the authoring click (not the 121.2 runtime)');
  for (const rel of listFiles('extension', /\.js$/).filter((r) => r !== 'extension/background.js')) {
    assert(!read(rel).includes('requirePasswordSurface'), `R-c ${rel}: no password-surface gate outside authoring`);
  }
  for (const rel of listFiles('src', /\.(ts|tsx)$/).filter((r) => /digitalHome|DigitalHome|execution\//.test(r))) {
    assert(!read(rel).includes('requirePasswordSurface') && !read(rel).includes('surface_not_login'), `R-c ${rel}: Digital Home / runtime untouched`);
  }
  return 'R-c password-surface check only for FLOATING_SCREEN authoring tests (not declared mode, runtime, Digital Home)';
}

function checkSavedNotRescored(c) {
  const { lc } = c.m;
  const draft = {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [
      {
        actionId: 'saved-1',
        kind: 'floating_opener',
        label: 'Next slide',
        locatorType: 'css',
        locator: '.slick-next',
        approvedForAuthoringContinuation: true,
        approvedForRuntime: true,
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
      },
    ],
    steps: [{ stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }, { fieldId: 'password', locatorType: 'css', locator: '#pass' }] }],
  };
  const n = lc.normalizeLegacyDraftReadiness(draft);
  const ident = (a) => a && [a.actionId, a.kind, a.label, a.locator, a.approvedForAuthoringContinuation, a.approvedForRuntime].join('|');
  assert(
    (n.preambleActions ?? []).length === 1 && ident(n.preambleActions[0]) === ident(draft.preambleActions[0]),
    `R-d saved chosen action with negative text kept (never re-scored): ${JSON.stringify(n.preambleActions)}`,
  );
  const importers = listFiles('src', /\.(ts|tsx)$/).filter((rel) => /specialActionIntent/.test(read(rel)));
  assert(importers.join() === 'src/assistedMapping/specialAnalyzeRouting.ts', `R-d intent vocabulary used only by the Analyze proposer: ${importers}`);
  const callers = listFiles('src', /\.(ts|tsx)$/).filter((rel) => /proposeSpecialActionCandidates\(/.test(read(rel)));
  assert(callers.sort().join() === 'src/assistedMapping/currentTabAuthoring.ts,src/assistedMapping/specialAnalyzeRouting.ts', `R-d proposer called only from Analyze: ${callers}`);
  for (const rel of ['src/loginContract/specialDraftAuthoring.ts', 'src/loginContract/planActivate.ts', 'src/loginContract/merge.ts', 'src/loginContract/resolve.ts', 'src/execution/specialLoginFlow.ts']) {
    assert(!read(rel).includes('actionIntent') && !read(rel).includes('proposeSpecialActionCandidates'), `R-d ${rel}: no re-scoring`);
  }
  return 'R-d saved drafts / ACTIVE plans never re-scored (normalization keeps a chosen action verbatim)';
}

const GROUPS = [
  checkIntentAndParity,
  checkPatternRelevance,
  checkVisibleTextFixture,
  checkNegatives,
  checkRegisterLogin,
  checkSkipLink,
  checkRankOrder,
  checkCredentialInputsDom,
  checkRevealPassword,
  checkRevealFrames,
  checkScope,
  checkSavedNotRescored,
];

function baseSources() {
  const pageSources = Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)]));
  return {
    pageSources,
    bgSrc: read('extension/background.js'),
    corrSrc: read('extension/generic/frame-correlation.js'),
    editorSrc: read('src/admin/SpecialLoginDraftEditor.tsx'),
    hubSrc: read('src/assistedMapping/currentTabAuthoring.ts'),
  };
}

async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-47 — Analyze proposal quality (G5–G8, R-a…R-f)\n');
const realModules = await loadHubModules();
const real = { ...baseSources(), m: realModules };
await runGroups(real, true);

// ─── Mutations ───────────────────────────────────────────────────────────────
function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}

const HUB_FILES = {
  routing: 'src/assistedMapping/specialAnalyzeRouting.ts',
  intent: 'src/assistedMapping/specialActionIntent.ts',
  authoring: 'src/loginContract/specialDraftAuthoring.ts',
};
const PSI = 'extension/generic/page-structure-inspect.js';

const MUTATIONS = [
  { id: 'M1 (G6) routing ignores pattern relevance for transitions', hub: HUB_FILES.routing, from: "const transitionOk = actionKindRelevantForPattern('intermediate_transition', pattern);", to: 'const transitionOk = true;' },
  { id: 'M2 (G5) collector label prefers aria-label', page: PSI, from: 'var label = visibleText || buttonCaption || ariaLabel || title || chosen.locator;', to: 'var label = ariaLabel || visibleText || buttonCaption || title || chosen.locator;' },
  { id: 'M2b (G5) Hub intent reads aria-label only', hub: HUB_FILES.routing, from: 'return [obs.visibleText, obs.ariaLabel, obs.title, obs.label].filter(', to: 'return [obs.ariaLabel].filter(' },
  { id: 'M2c (G5) Hub label ignores visible text', hub: HUB_FILES.routing, from: 'label: (obs.visibleText?.trim() || obs.label || obs.locator).trim(),', to: 'label: (obs.label || obs.locator).trim(),' },
  { id: 'M3 (G7) substring matching instead of whole words', hub: HUB_FILES.intent, from: '  if (token === word) return true;\n', to: '  if (token.includes(word)) return true;\n' },
  { id: 'M3b (G7) unanchored «go» restored', hub: HUB_FILES.intent, from: "'submit'],", to: "'submit', 'go', 'more']," },
  { id: 'M4 (G8) password requirement ignored', bg: true, from: 'return !requirePasswordSurface || e.password === true;', to: 'return true;' },
  { id: 'M4b (G8) snapshot drops the password flag', bg: true, from: 'password: Boolean(item && item.password === true),', to: 'password: false,' },
  { id: 'M-Ra (R-a) negative word demotes a login word (Hub)', hub: HUB_FILES.routing, from: '  if (intent.login) {\n    return popup', to: '  if (intent.login && !intent.negative) {\n    return popup' },
  { id: 'M-Rb (R-b) skip-link exclusion removed', page: PSI, from: "if (typeof shared.isSkipLink === 'function' && shared.isSkipLink(el)) continue;", to: '' },
  { id: 'M-Rc (R-c) editor always requires a password surface', editor: true, from: 'requirePasswordSurface: requirePasswordSurfaceFor(consentDraft.pattern, loginFields),', to: 'requirePasswordSurface: true,' },
  { id: 'M-Rd (R-d) normalization re-scores saved actions', hub: HUB_FILES.authoring, from: 'const relevant = (a: FlowAction) => actionKindRelevantForPattern(a.kind, draft.pattern);', to: "const relevant = (a: FlowAction) => actionKindRelevantForPattern(a.kind, draft.pattern) && !/slide/i.test(a.label ?? '');" },
  { id: 'M-Re (R-e) reveal snapshot ignores depth-1 frames', bg: true, from: "return r.status === 'top' || (r.status === 'depth1_https' && r.visible);", to: "return r.status === 'top';" },
  { id: 'M-Rf (R-f) collector drops the popup tier', page: PSI, from: 'return popupSemantics ? 2 : 3;', to: 'return 3;' },
  { id: 'M-Rf2 (R-f) Hub sorts by popup before tier', hub: HUB_FILES.routing, from: 'ranked.sort((a, b) => a.tier - b.tier || Number(b.popup) - Number(a.popup));', to: 'ranked.sort((a, b) => Number(b.popup) - Number(a.popup));' },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const c = { ...baseSources(), m: realModules };
  if (mu.hub) {
    c.m = await loadHubModules({ [mu.hub]: replaceOnce(read(mu.hub), mu.from, mu.to, mu.id) });
  } else if (mu.page) {
    c.pageSources = { ...c.pageSources, [mu.page]: replaceOnce(c.pageSources[mu.page], mu.from, mu.to, mu.id) };
  } else if (mu.bg) {
    c.bgSrc = replaceOnce(c.bgSrc, mu.from, mu.to, mu.id);
  } else if (mu.editor) {
    c.editorSrc = replaceOnce(c.editorSrc, mu.from, mu.to, mu.id);
  }
  let failure = null;
  try {
    await runGroups(c, false);
  } catch (err) {
    failure = err;
  }
  assert(failure, `mutation NOT caught: ${mu.id}`);
  assert(!String(failure.message).startsWith('fixture:'), `mutation ${mu.id} failed on fixture setup: ${failure.message}`);
  caught += 1;
  console.log(`  ✓ mutation caught: ${mu.id}  [${failure.message}]`);
}

console.log(`\nPASS — Phase 121 D-121-47 Analyze proposal quality (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
