/**
 * Phase 121 D-121-61 — address a frame by its source when it has no name.
 * - Unit (real frame-correlation.js + locator-determinism.js in a linkedom DOM): after id / name /
 *   title / aria-label → iframe[src^="<origin><path>"] (query / hash dropped, HTTPS absolute only,
 *   exact-one) → anchored structural locator (D-121-48 stable ancestor + iframe, exact-one) → none.
 * - End to end (REAL background.js SPECIAL block, mocked chrome, top document = linkedom):
 *   CAL-shaped nameless visible frame → addressed, fields revealed in the frame, held for frame
 *   approval (cross-origin); declared click through a src locator: live origin still enforced;
 *   a newly visible unaddressable frame (nothing else fresh) → surface_frame_not_addressable.
 * - Hub: new copy + panel status (D-121-59 A1 pattern).
 * Synthetic fixtures (no site names). Mutations must be caught.
 * Usage: node scripts/verifyPhase121FrameBySource.mjs
 */
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { D12161_BACKGROUND_EDITS, revertD12161BackgroundEdits } from './lib/phase121D61BackgroundEdits.mjs';
import { D12161_CORRELATION_EDITS, revertD12161CorrelationEdits } from './lib/phase121D61CorrelationEdits.mjs';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `fixture: anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const realInfo = console.info;
console.info = (...a) => {
  if (a[0] !== '[D-121-60 authoring-click]') realInfo(...a);
};
const SRC = {
  bg: read('extension/background.js'),
  corr: read('extension/generic/frame-correlation.js'),
  ld: read('extension/generic/locator-determinism.js'),
};
const HUB_FILES = {
  hub: 'src/assistedMapping/currentTabAuthoring.ts',
  bar: 'src/admin/specialActionBar.ts',
  types: 'src/assistedMapping/types.ts',
};
const ORIGIN = 'https://www.fixture-card.example';
const PAY = 'https://connect.fixture-pay.example';
const NEW_COPY = 'המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.';
const NEW_STATUS = 'מצב: לא נבחר — המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר';

// ─── Unit: real candidates in a DOM ───────────────────────────────────────────
function pageWindow(bodyHtml, src = SRC) {
  const { window, document } = parseHTML(`<!doctype html><html><head></head><body>${bodyHtml}</body></html>`);
  const win = {
    document,
    location: { origin: ORIGIN },
    crypto: webcrypto,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    addEventListener() {},
  };
  win.top = win;
  win.parent = win;
  // eslint-disable-next-line no-new-func
  new Function('window', src.ld)(win);
  // eslint-disable-next-line no-new-func
  new Function('window', src.corr)(win);
  return { win, document, window };
}
function locatorOf(bodyHtml, selectEl, src) {
  const { win, document } = pageWindow(bodyHtml, src);
  const el = document.querySelector(selectEl);
  assert(el, `fixture: ${selectEl}`);
  const loc = win.__frameCorrelationHelpers.exactOneFrameLocator(el, document);
  if (loc) {
    const m = document.querySelectorAll(loc);
    assert(m.length === 1 && m[0] === el, `exact-one sanity for ${loc}`);
  }
  return { loc, hints: win.__frameCorrelationHelpers.frameLocatorCandidates(el, document).map((c) => c.stabilityHint) };
}
const CAL_BODY = `
  <iframe id="popupIframe" src="about:blank"></iframe><iframe id="popupIframe" src="about:blank"></iframe>
  <iframe id="popupIframe" src="about:blank"></iframe><iframe id="popupIframe" src="about:blank"></iframe>
  <div><div><iframe data-t="cal" src="${PAY}/index.html"></iframe></div></div>`;

const UNIT = {
  U1(src) {
    const { loc } = locatorOf(CAL_BODY, 'iframe[data-t="cal"]', src);
    assert(loc === `iframe[src^="${PAY}/index.html"]`, `U1 nameless frame with a stable src → src prefix (got ${loc})`);
  },
  U2(src) {
    const { loc } = locatorOf(`<iframe data-t="q" src="${PAY}/login/frame.html?lang=he&amp;t=172#step"></iframe>`, 'iframe[data-t="q"]', src);
    assert(loc === `iframe[src^="${PAY}/login/frame.html"]`, `U2 src with query / hash → prefix without them (got ${loc})`);
  },
  U3(src) {
    const two = `<div class="login-modal"><iframe data-t="a" src="${PAY}/index.html"></iframe></div>
      <div class="promo-box"><iframe data-t="b" src="${PAY}/index.html"></iframe></div>`;
    const a = locatorOf(two, 'iframe[data-t="a"]', src).loc;
    assert(a === 'div.login-modal iframe', `U3a two frames with the same src → anchored structural (got ${a})`);
    const bare = `<div><iframe data-t="a" src="${PAY}/index.html"></iframe></div><div><iframe data-t="b" src="${PAY}/index.html"></iframe></div>`;
    const b = locatorOf(bare, 'iframe[data-t="a"]', src).loc;
    assert(b === null, `U3b same src, no stable ancestor → fail-closed (got ${b})`);
    const unstable = `<div id="mat-dialog-3"><iframe data-t="a" src="${PAY}/index.html"></iframe></div><div id="mat-dialog-4"><iframe data-t="b" src="${PAY}/index.html"></iframe></div>`;
    const c = locatorOf(unstable, 'iframe[data-t="a"]', src).loc;
    assert(c === null, `U3c generated ancestor ids are never anchors (D-121-48) → fail-closed (got ${c})`);
  },
  U4(src) {
    const mz = locatorOf(`<iframe id="iframeLogIn" src="${ORIGIN}/login/frame?x=1"></iframe>`, '#iframeLogIn', src);
    assert(mz.loc === 'iframe#iframeLogIn', `U4 Mizrahi-shaped #iframeLogIn unchanged (got ${mz.loc})`);
    const named = locatorOf(`<iframe name="loginFrame" src="${PAY}/a"></iframe>`, 'iframe', src);
    assert(named.loc === 'iframe[name="loginFrame"]', `U4 name first (got ${named.loc})`);
    const all = locatorOf(`<section class="auth-panel"><iframe title="Sign in" src="${PAY}/a"></iframe></section>`, 'iframe', src);
    assert(all.hints.join(',') === 'title,src,anchored', `U4 candidate order id/name/title/aria → src → anchored (got ${all.hints.join(',')})`);
  },
  U5(src) {
    for (const [s, label] of [['/frame.html', 'relative'], ['http://connect.fixture-pay.example/index.html', 'http'], ['//connect.fixture-pay.example/i', 'protocol-relative'], ['about:blank', 'about']]) {
      const { hints } = locatorOf(`<div><iframe data-t="x" src="${s}"></iframe></div>`, 'iframe', src);
      assert(!hints.includes('src'), `U5 ${label} src → no src candidate`);
    }
  },
};

// ─── End to end: real background.js click ─────────────────────────────────────
function loadExt(bgSrc) {
  const start = bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface');
  const end = bgSrc.indexOf('function openPageAndManagedAutofill');
  assert(start > 0 && end > start, 'fixture: Ext SPECIAL block located');
  let src = bgSrc.slice(start, end);
  src = replaceOnce(src, 'var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 5;', 'poll');
  src = replaceOnce(src, 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 5;', 'handshake');
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
  return (chrome) => new Function('chrome', `${prelude}\n${src}\nreturn { click: authoringClickApprovedAction };`)(chrome);
}
function runInWindow(win, func, args) {
  // eslint-disable-next-line no-new-func
  return new Function('__w', '__f', '__a', 'with (__w) { return eval("(" + __f + ")").apply(null, __a); }')(win, String(func), args || []);
}

/**
 * page = { body (top HTML; depth-1 iframes carry data-fid), topCreds, frames: [{ frameId, origin, visible, creds, passwords, clickables }] }.
 * The top document is linkedom; iframes get a simulated contentWindow / box.
 */
function mockPage(page, src = SRC) {
  const { document } = parseHTML(`<!doctype html><html><head></head><body>${page.body}</body></html>`);
  const top = { frameId: 0, origin: ORIGIN, depth: 0, creds: page.topCreds || [], passwords: page.topPasswords || [], clickables: page.topClickables || {} };
  const frames = [top, ...page.frames.map((f) => ({ depth: 1, creds: [], passwords: [], ...f }))];
  const listeners = new Map();
  const winOf = new Map();
  const topWin = { document, location: { origin: ORIGIN }, crypto: webcrypto, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), addEventListener() {} };
  topWin.top = topWin;
  topWin.parent = topWin;
  winOf.set(0, topWin);
  for (const f of frames.slice(1)) {
    const l = [];
    listeners.set(f.frameId, l);
    const w = {
      location: { origin: f.origin },
      crypto: webcrypto,
      top: topWin,
      parent: topWin,
      addEventListener(type, fn) {
        if (type === 'message') l.push(fn);
      },
    };
    winOf.set(f.frameId, w);
    const el = document.querySelector(`iframe[data-fid="${f.frameId}"]`);
    assert(el, `fixture: iframe for frame ${f.frameId}`);
    Object.defineProperty(el, 'contentWindow', {
      get: () => ({ postMessage: (msg) => setTimeout(() => l.slice().forEach((fn) => fn({ data: structuredClone(msg), source: topWin })), 0) }),
    });
    el.getBoundingClientRect = () => (f.visible ? { width: 476, height: 703 } : { width: 0, height: 0 });
  }
  const fileSrc = { 'generic/locator-determinism.js': src.ld, 'generic/frame-correlation.js': src.corr };
  const ctx = { clicks: 0 };
  const credItems = (f) => f.creds.map((locator) => ({ locator, password: f.passwords.includes(locator) }));
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
        const fsrc = details.func ? String(details.func) : '';
        const name = details.func && details.func.name;
        const probe = (f) => ({ origin: f.origin, protocol: new URL(f.origin).protocol, isTop: f.depth === 0, isDepth1: f.depth === 1 });
        if (t.allFrames && details.files) {
          for (const f of frames) {
            for (const file of details.files) {
              // eslint-disable-next-line no-new-func
              if (fileSrc[file]) new Function('window', fileSrc[file])(winOf.get(f.frameId));
            }
          }
          return done(frames.map((f) => ({ frameId: f.frameId, result: undefined })));
        }
        if (t.allFrames && fsrc.includes('__readFrameCorrelationNonces')) {
          return done(frames.map((f) => ({ frameId: f.frameId, result: runInWindow(winOf.get(f.frameId), details.func, details.args) })));
        }
        if (t.allFrames && name === 'specialFrameProbe') return done(frames.map((f) => ({ frameId: f.frameId, result: probe(f) })));
        if (t.allFrames) return done(frames.map((f) => ({ frameId: f.frameId, result: { seen: false } })));
        const fid = t.frameIds[0];
        const f = frames.find((x) => x.frameId === fid);
        if (details.files) return f ? done(undefined) : done(undefined, 'Cannot access frame');
        if (!f) return done(undefined, 'No frame with id ' + fid);
        const args = details.args || [];
        if (name === 'specialFrameProbe') return done([{ frameId: fid, result: probe(f) }]);
        if (fsrc.includes('__collectFrameCorrelation') || fsrc.includes('__resolveFrameByLocator')) {
          return done([{ frameId: 0, result: runInWindow(topWin, details.func, args) }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredential')) return done([{ frameId: fid, result: f.origin === args[0] ? credItems(f) : [] }]);
        if (fsrc.includes('isSpecialDeclaredReadinessMet')) {
          if (f.origin !== args[0]) return done([{ frameId: fid, result: { met: false, originMismatch: true } }]);
          return done([{ frameId: fid, result: { met: f.creds.includes(args[1]) } }]);
        }
        if (fsrc.includes('.click()')) {
          if (f.origin !== args[1]) return done([{ frameId: fid, result: { ok: false, reason: 'frame_origin_mismatch' } }]);
          const handler = f.clickables && f.clickables[args[0]];
          if (!handler) return done([{ frameId: fid, result: { ok: false, reason: 'click_target_missing' } }]);
          ctx.clicks += 1;
          handler();
          return done([{ frameId: fid, result: { ok: true } }]);
        }
        return done(undefined, 'unexpected script');
      },
    },
  };
  return { chrome, ctx, frames };
}
async function click(page, msg, src = SRC) {
  const { chrome, ctx, frames } = mockPage(page, src);
  const ext = loadExt(src.bg)(chrome);
  const reply = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 4000);
    ext.click(msg, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
  return { reply, clicks: ctx.clicks, frames };
}
const revealMsg = (extra = {}) => ({
  allowedOrigin: ORIGIN,
  locator: '#openLogin',
  locatorType: 'css',
  approvedForAuthoringContinuation: true,
  kind: 'floating_opener',
  readinessMode: 'reveal',
  readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 150 },
  ...extra,
});
const noisyFrames = () => [
  { frameId: 201, origin: 'https://ads.fixture-cdn.example', visible: false },
  { frameId: 202, origin: 'https://ads.fixture-cdn.example', visible: false },
];
const noisyBody = () =>
  '<iframe id="popupIframe" data-fid="201" src="https://ads.fixture-cdn.example/p"></iframe><iframe id="popupIframe" data-fid="202" src="https://ads.fixture-cdn.example/p"></iframe>';
/** CAL-shaped: no top inputs; a nameless frame on another origin becomes visible with ID + card-digit inputs. */
function calPage({ frameSrc = `${PAY}/index.html`, frameOrigin = PAY, wrap = (s) => `<div><div>${s}</div></div>` } = {}) {
  const page = {
    body: `${noisyBody()}${wrap(`<iframe data-fid="301" src="${frameSrc}"></iframe>`)}`,
    frames: [...noisyFrames(), { frameId: 301, origin: frameOrigin, visible: false }],
  };
  page.topClickables = {
    '#openLogin': () => {
      const f = page.__frames.find((x) => x.frameId === 301);
      f.visible = true;
      f.creds.push('#idNumber', '#cardDigits');
    },
  };
  return page;
}
async function clickCal(pageOpts, msg, src) {
  const page = calPage(pageOpts);
  const { chrome, ctx, frames } = mockPage(page, src);
  page.__frames = frames;
  const ext = loadExt((src || SRC).bg)(chrome);
  const reply = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 4000);
    ext.click(msg, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
  return { reply, clicks: ctx.clicks };
}

let hub = null;
function loadHub(overrides = {}) {
  return withTempDir('pv-12161-hub-', (outdir) => loadHubIn(outdir, overrides));
}
async function loadHubIn(outdir, overrides) {
  const abs = (rel) => join(root, rel).replace(/\\/g, '/').toLowerCase();
  const over = new Map(Object.entries(overrides).map(([rel, s]) => [abs(rel), s]));
  const plugin = {
    name: 'hub-seams',
    setup(b) {
      b.onLoad({ filter: /\.ts$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        let s = over.get(key);
        if (key === abs(HUB_FILES.hub)) {
          s = replaceOnce(
            s ?? readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n'),
            "import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';",
            'const sendExtensionMessageAsync = (_m: any): Promise<any> => Promise.resolve(null);\nconst probeExtensionAvailable = (): boolean => true;',
            'bridge import',
          );
        }
        return s === undefined ? undefined : { contents: s, loader: 'ts', resolveDir: dirname(args.path) };
      });
    },
  };
  const outfile = join(outdir, 'hub.mjs');
  await build({
    stdin: {
      contents: `
        export { authoringClickFailureMessageHe } from './${HUB_FILES.hub}';
        export { testFailureOutcome, actionStatusHe } from './${HUB_FILES.bar}';
        export { isFrameOriginApproved } from './src/loginContract/frameDescriptor.ts';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    plugins: [plugin],
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}${Math.random()}`);
}
const failedAction = { approvedForAuthoringContinuation: false, approvedForRuntime: false };

const E2E = {
  async E1(src) {
    const r = await clickCal({}, revealMsg(), src);
    assert(r.reply && r.clicks === 1, `E1 click ran: ${JSON.stringify(r)}`);
    const want = { frameLocator: `iframe[src^="${PAY}/index.html"]`, frameOrigin: PAY };
    assert(r.reply.ok === true && JSON.stringify(r.reply.revealed?.frame) === JSON.stringify(want), `E1 CAL-shaped nameless frame → addressed, fields revealed in it: ${JSON.stringify(r.reply)}`);
    assert(hub.isFrameOriginApproved(PAY, new Set(), ORIGIN) === false, 'E1 cross-origin frame → held for «אשר מסגרת» (A2 unchanged)');
    assert(hub.isFrameOriginApproved(PAY, new Set([PAY]), ORIGIN) === true, 'E1 after approval the frame origin is usable');
  },
  async E2(src) {
    const desc = { frameLocator: `iframe[src^="${PAY}/index.html"]`, frameOrigin: PAY };
    const page = (origin) => {
      const p = { body: `<div><iframe data-fid="301" src="${PAY}/index.html"></iframe></div>`, frames: [{ frameId: 301, origin, visible: true }] };
      p.frames[0].clickables = { '#next': () => p.__f.creds.push('#pw') };
      return p;
    };
    const msg = { ...revealMsg({ locator: '#next', frame: desc, readinessMode: 'declared' }), readiness: { locator: '#pw', frame: desc, timeoutMs: 150 } };
    const run = async (origin) => {
      const p = page(origin);
      const { chrome, ctx, frames } = mockPage(p, src);
      p.__f = frames.find((x) => x.frameId === 301);
      const ext = loadExt(src.bg)(chrome);
      const reply = await new Promise((resolve) => ext.click(msg, resolve));
      return { reply, clicks: ctx.clicks };
    };
    const ok = await run(PAY);
    assert(ok.reply.ok === true && ok.clicks === 1, `E2 declared click through the src locator: ${JSON.stringify(ok)}`);
    const moved = await run('https://other-idp.fixture.example');
    assert(
      moved.reply.ok === false && moved.reply.reason === 'frame_origin_mismatch' && moved.reply.liveOrigin === 'https://other-idp.fixture.example' && moved.clicks === 0,
      `E2 same src prefix, different live origin → resolveDeclaredFrame frame_origin_mismatch (live origin reported), no click: ${JSON.stringify(moved)}`,
    );
  },
  async E3(src) {
    const bare = { frameSrc: 'about:blank', wrap: (s) => `<div>${s}</div><div><iframe data-fid="302" src="about:blank"></iframe></div>` };
    const page = calPage(bare);
    page.frames.push({ frameId: 302, origin: PAY, visible: false });
    const { chrome, ctx, frames } = mockPage(page, src);
    page.__frames = frames;
    const ext = loadExt(src.bg)(chrome);
    const reply = await new Promise((resolve) => ext.click(revealMsg(), resolve));
    assert(ctx.clicks === 1 && reply.ok === false && reply.reason === 'surface_frame_not_addressable', `E3 newly visible unaddressable frame, nothing else fresh → surface_frame_not_addressable: ${JSON.stringify(reply)}`);
    assert(hub.authoringClickFailureMessageHe(reply.reason) === NEW_COPY, 'E3 Hub copy');
    assert(hub.actionStatusHe(failedAction, hub.testFailureOutcome(reply.reason)) === NEW_STATUS, 'E3 panel status follows (A1 pattern)');
    assert(hub.authoringClickFailureMessageHe('surface_not_revealed') === 'המסך לא נפתח', 'E3 «המסך לא נפתח» unchanged for surface_not_revealed');
  },
  async E4(src) {
    const page = {
      body: '<div><iframe data-fid="302" src="about:blank"></iframe></div><div><iframe data-fid="303" src="about:blank"></iframe></div>',
      frames: [{ frameId: 302, origin: PAY, visible: true }, { frameId: 303, origin: PAY, visible: false }],
      topClickables: { '#openLogin': () => {} },
    };
    const r = await click(page, revealMsg(), src);
    assert(r.reply.ok === false && r.reply.reason === 'surface_not_revealed', `E4 unaddressable frame already visible before the click → surface_not_revealed: ${JSON.stringify(r.reply)}`);
  },
  async E5(src) {
    const mk = (topCredOnClick, password) => {
      const page = {
        body: '<div><iframe data-fid="302" src="about:blank"></iframe></div><div><iframe data-fid="303" src="about:blank"></iframe></div>',
        frames: [{ frameId: 302, origin: PAY, visible: false }, { frameId: 303, origin: PAY, visible: false }],
      };
      page.topClickables = {
        '#openLogin': () => {
          page.__frames.find((x) => x.frameId === 302).visible = true;
          page.__frames[0].creds.push(topCredOnClick);
          if (password) page.__frames[0].passwords.push(topCredOnClick);
        },
      };
      return page;
    };
    const go = async (page, msg) => {
      const { chrome, frames } = mockPage(page, src);
      page.__frames = frames;
      const ext = loadExt(src.bg)(chrome);
      return new Promise((resolve) => ext.click(msg, resolve));
    };
    const notLogin = await go(mk('#newsletter', false), revealMsg({ requirePasswordSurface: true }));
    assert(notLogin.reason === 'surface_not_login', `E5 fresh non-password input + unaddressable frame → surface_not_login (something else fresh): ${JSON.stringify(notLogin)}`);
    const top = await go(mk('#password', true), revealMsg({ requirePasswordSurface: true }));
    assert(top.ok === true && top.revealed.frame === null, `E5 fresh top login + unaddressable frame → revealed in top (unchanged): ${JSON.stringify(top)}`);
  },
  async E6(src) {
    const mz = {
      body: `<iframe id="iframeLogIn" data-fid="401" src="${ORIGIN}/login/frame?x=1"></iframe>`,
      frames: [{ frameId: 401, origin: ORIGIN, visible: false }],
    };
    mz.topClickables = {
      '#openLogin': () => {
        const f = mz.__frames.find((x) => x.frameId === 401);
        f.visible = true;
        f.creds.push('#user', '#pass');
      },
    };
    const { chrome, frames } = mockPage(mz, src);
    mz.__frames = frames;
    const reply = await new Promise((resolve) => loadExt(src.bg)(chrome).click(revealMsg(), resolve));
    assert(reply.ok === true && reply.revealed.frame?.frameLocator === 'iframe#iframeLogIn', `E6 Mizrahi-shaped #iframeLogIn unchanged: ${JSON.stringify(reply)}`);
    const pagi = { body: '', frames: [] };
    pagi.topClickables = { '#openLogin': () => pagi.__frames[0].creds.push('#userCode', '#password') };
    const m2 = mockPage(pagi, src);
    pagi.__frames = m2.frames;
    const r2 = await new Promise((resolve) => loadExt(src.bg)(m2.chrome).click(revealMsg(), resolve));
    assert(r2.ok === true && r2.revealed.frame === null, `E6 PAGI-shaped top-document screen unchanged: ${JSON.stringify(r2)}`);
  },
};

// ─── Run ──────────────────────────────────────────────────────────────────────
const LABELS = {
  U1: 'nameless iframe with a stable src (CAL shape, 4 duplicate #popupIframe) → iframe[src^="<origin><path>"]',
  U2: 'src with query / hash → prefix without them',
  U3: 'two iframes with the same src → anchored structural; no stable ancestor / generated ids → fail-closed',
  U4: 'existing order unchanged (id / name / title first; Mizrahi #iframeLogIn); order id/name/title/aria → src → anchored',
  U5: 'relative / http / protocol-relative / about: src → no src candidate',
  E1: 'CAL-shaped: frame addressed, fields revealed in it, held for «אשר מסגרת» (cross-origin)',
  E2: 'declared click via src locator; different live origin → frame_origin_mismatch, no click',
  E3: 'newly visible unaddressable frame, nothing else fresh → surface_frame_not_addressable + copy + status',
  E4: 'unaddressable frame visible before the click → surface_not_revealed (not new)',
  E5: 'something else fresh wins (surface_not_login / top reveal unchanged)',
  E6: 'Mizrahi (#iframeLogIn) / PAGI (top document) fixtures unchanged',
};

hub = await loadHub();
let passed = 0;
console.log('D-121-61 — frame by source');
for (const [key, fn] of Object.entries(UNIT)) {
  fn(SRC);
  console.log(`  ✓ ${key} — ${LABELS[key]}`);
  passed += 1;
}
for (const [key, fn] of Object.entries(E2E)) {
  await fn(SRC);
  console.log(`  ✓ ${key} — ${LABELS[key]}`);
  passed += 1;
}

const STATIC = [
  ['edits are exactly the listed ones (frame-correlation.js + background.js)', () => {
    revertD12161CorrelationEdits(SRC.corr);
    revertD12161BackgroundEdits(SRC.bg);
    return true;
  }],
  ['no manifest change / webNavigation / debugger / getFrameId / site branches in the D-121-61 edits', () => {
    const added = [...D12161_CORRELATION_EDITS, ...D12161_BACKGROUND_EDITS].map(([n]) => n).join('\n');
    return !/webNavigation|chrome\.debugger|getFrameId|hostname|serviceId|cal-online|\.co\.il/i.test(added) && !read('extension/manifest.json').includes('webNavigation');
  }],
  ['resolveDeclaredFrame still enforces exact-one + depth-1 + live origin', () => {
    const at = SRC.bg.indexOf('function resolveDeclaredFrame(');
    const fn = SRC.bg.slice(at, SRC.bg.indexOf('\nfunction ', at + 10));
    const corrResolve = SRC.corr.slice(SRC.corr.indexOf('function resolveFrameByLocator'), SRC.corr.indexOf('global.__collectFrameCorrelation'));
    return fn.includes("reason: 'frame_ambiguous'") && fn.includes('!p.isDepth1') && fn.includes('p.origin !== descriptor.frameOrigin') && corrResolve.includes('matches.length > 1');
  }],
  ['stored descriptor shape unchanged (contract / validator not touched)', () => {
    const t = read('src/loginContract/types.ts');
    return /frameLocator: string;/.test(t) && !/src\^=/.test(read('src/loginContract/parse.ts'));
  }],
];
for (const [label, check] of STATIC) {
  assert(check(), `static: ${label}`);
  console.log(`  ✓ static — ${label}`);
  passed += 1;
}

// ─── Mutations ────────────────────────────────────────────────────────────────
const corrMut = (f) => ({ ...SRC, corr: f(SRC.corr) });
const bgMut = (f) => ({ ...SRC, bg: f(SRC.bg) });
const MUT = [
  ['M1 src candidate removed', 'U1', corrMut((s) => replaceOnce(s, "    push(srcPrefixLocator(el), 'src');\n", '', 'M1'))],
  ['M1e src candidate removed (end to end)', 'E1', corrMut((s) => replaceOnce(s, "    push(srcPrefixLocator(el), 'src');\n", '', 'M1e'))],
  ['M2 query kept in the prefix', 'U2', corrMut((s) => replaceOnce(s, '    var prefix = url.origin + url.pathname;', "    var prefix = url.href.split('#')[0];", 'M2'))],
  ['M3 src accepted without exact-one', 'U3', corrMut((s) => replaceOnce(s, '      var loc = candidates[i].locator;\n', "      var loc = candidates[i].locator;\n      if (candidates[i].stabilityHint === 'src') return loc;\n", 'M3'))],
  ['M4 anchored structural candidate removed', 'U3', corrMut((s) => replaceOnce(s, "push(anchored[0].locator, 'anchored');", '0;', 'M4'))],
  ['M5 http src allowed', 'U5', corrMut((s) => replaceOnce(replaceOnce(s, "!/^https:\\/\\//i.test(raw.trim())", "!/^https?:\\/\\//i.test(raw.trim())", 'M5a'), "if (url.protocol !== 'https:' || ", 'if (', 'M5b'))],
  ['M6 src locator replaces the live origin check', 'E2', bgMut((s) => replaceOnce(s, '          if (p.origin !== descriptor.frameOrigin) {', "          if (p.origin !== descriptor.frameOrigin && descriptor.frameLocator.indexOf('[src^=') < 0) {", 'M6'))],
  ['M7 new reason never emitted', 'E3', bgMut((s) => replaceOnce(s, "            if (sawNewUnaddressable) {\n              reply({ ok: false, reason: 'surface_frame_not_addressable' });\n              return;\n            }\n", '', 'M7'))],
  ['M8 "newly visible" not checked', 'E4', bgMut((s) => replaceOnce(s, 'return !unaddressableBefore[id];', 'return Boolean(id);', 'M8'))],
  ['M9 new reason outranks surface_not_login', 'E5', bgMut((s) => replaceOnce(s, "            if (sawFreshNonPassword) {\n              reply({ ok: false, reason: 'surface_not_login' });", "            if (sawFreshNonPassword && !sawNewUnaddressable) {\n              reply({ ok: false, reason: 'surface_not_login' });", 'M9'))],
  ['M12 src tried before id (existing order changed)', 'U4', corrMut((s) => replaceOnce(replaceOnce(s, "    push(srcPrefixLocator(el), 'src');\n", '', 'M12a'), "    if (el.id) push('iframe#'", "    push(srcPrefixLocator(el), 'src');\n    if (el.id) push('iframe#'", 'M12b'))],
];
const HUB_MUT = [
  ['M10 Hub copy collapsed', { [HUB_FILES.hub]: (s) => replaceOnce(s, "    case 'surface_frame_not_addressable':\n      return SURFACE_FRAME_NOT_ADDRESSABLE_HE;\n", '', 'M10') }],
  ['M11 panel status collapsed', { [HUB_FILES.bar]: (s) => replaceOnce(s, "  if (reason === 'surface_frame_not_addressable') return 'frame_unaddressable';\n", '', 'M11') }],
];

console.log('\nMutations');
let caught = 0;
const all = { ...UNIT, ...E2E };
for (const [label, key, mutated] of MUT) {
  let failed = false;
  try {
    await all[key](mutated);
  } catch (e) {
    failed = true;
    console.log(`  ✓ mutation caught: ${label}  [${key}: ${String(e.message).slice(0, 90)}]`);
  }
  assert(failed, `mutation NOT caught: ${label}`);
  caught += 1;
}
const realHub = hub;
for (const [label, overrides] of HUB_MUT) {
  const srcs = Object.fromEntries(Object.entries(overrides).map(([rel, f]) => [rel, f(read(rel))]));
  hub = await loadHub(srcs);
  let failed = false;
  try {
    await E2E.E3(SRC);
  } catch (e) {
    failed = true;
    console.log(`  ✓ mutation caught: ${label}  [E3: ${String(e.message).slice(0, 90)}]`);
  }
  assert(failed, `mutation NOT caught: ${label}`);
  caught += 1;
}
hub = realHub;

console.log(`\nD-121-61 verify: ${passed} checks PASS, ${caught} mutations caught`);
process.exit(0);
