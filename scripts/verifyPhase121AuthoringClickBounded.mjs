/**
 * Phase 121 D-121-60 — the authoring click is never held hostage by a frame that does not answer.
 * The REAL extension authoringClickApprovedAction (background.js SPECIAL block, mocked chrome with
 * frame fixtures that can never answer or answer slowly per call type) and the REAL Hub
 * performApprovedAuthoringClick (bridge stubbed).
 * - Never-answering depth-1 frame (inspect / handshake / all-frames probe) → the click runs and
 *   reveal proceeds; a frame skipped in the pre-click snapshot is never compared (no false positive).
 * - Slow frames within the bound → unchanged outcome.
 * - Click target: declared frame whose handshake / probe never answers → explicit failure, no click;
 *   frame_origin_mismatch unchanged; declared-mode framed click unchanged.
 * - Gesture watch install / collect that never answer → fail-closed.
 * - Service-worker trace: stages in order, no locators / origins / values.
 * - Hub wait ≥ the extension's worst-case bound; a never-answering extension → authoring_click_no_response.
 * Synthetic fixtures. Mutations must be caught.
 * Usage: node scripts/verifyPhase121AuthoringClickBounded.mjs
 */
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { D12160_BACKGROUND_EDITS, revertD12160BackgroundEdits } from './lib/phase121D60BackgroundEdits.mjs';
import { revertD12161BackgroundEdits } from './lib/phase121D61BackgroundEdits.mjs';
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
const BG = read('extension/background.js');
const CORR = read('extension/generic/frame-correlation.js');
const HUB = 'src/assistedMapping/currentTabAuthoring.ts';
const HUB_SRC = read(HUB);

const ORIGIN = 'https://fixture.example';
const CALL_TIMEOUT_MS = 80;
const REPLY_WAIT_MS = 3000;
const TRACE_TAG = '[D-121-60 authoring-click]';

// ─── Extension harness ────────────────────────────────────────────────────────
function loadExt(bgSrc) {
  const start = bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface');
  const end = bgSrc.indexOf('function openPageAndManagedAutofill');
  assert(start > 0 && end > start, 'fixture: Ext SPECIAL block located');
  let src = bgSrc.slice(start, end);
  src = replaceOnce(src, 'var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 5;', 'poll');
  src = replaceOnce(src, 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 5;', 'handshake');
  src = replaceOnce(
    src,
    'var SPECIAL_AUTHORING_CALL_TIMEOUT_MS = 2500;',
    `var SPECIAL_AUTHORING_CALL_TIMEOUT_MS = ${CALL_TIMEOUT_MS};`,
    'call timeout',
  );
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

/** Call type of one executeScript request (what a frame may fail to answer). */
function callType(details) {
  const t = details.target;
  const fsrc = details.func ? String(details.func) : '';
  const name = details.func && details.func.name;
  if (t.allFrames) {
    if (details.files) return 'correlation_files';
    if (fsrc.includes('__readFrameCorrelationNonces')) return 'handshake_read';
    if (name === 'specialFrameProbe') return 'probe_all';
    if (name === 'specialGestureWatchInstall') return 'gesture_install';
    if (name === 'specialGestureWatchCollect') return 'gesture_collect';
    return 'all_frames_other';
  }
  if (details.files) return 'inspect_files';
  if (name === 'specialFrameProbe') return 'probe_frame';
  if (fsrc.includes('__collectFrameCorrelation') || fsrc.includes('__resolveFrameByLocator')) return 'handshake_send';
  if (fsrc.includes('collectSpecialEligibleCredential')) return 'inspect_run';
  if (fsrc.includes('isSpecialDeclaredReadinessMet')) return 'declared_check';
  if (fsrc.includes('.click()')) return 'click';
  return 'other';
}

/**
 * frames = [{ frameId, origin, depth, locator?, creds?, passwords?, clickables?,
 *   hang?: callType[] (never answers), hangOnce?: callType[] (first call only), slowMs? }].
 * An all-frames call answers only when every frame does (as in Chrome).
 */
function mockChrome(frames) {
  const ctx = { frames: () => frames, clicks: 0, calls: [] };
  const credItems = (f) => (f.creds || []).map((locator) => ({ locator, password: (f.passwords || []).includes(locator) }));
  const hangs = (f, type) => {
    if ((f.hang || []).includes(type)) return true;
    if ((f.hangOnce || []).includes(type)) {
      f.__once = f.__once || {};
      if (!f.__once[type]) {
        f.__once[type] = true;
        return true;
      }
    }
    return false;
  };
  const chrome = {
    runtime: { lastError: null },
    tabs: { get: (id, cb) => setTimeout(() => cb({ id, url: `${ORIGIN}/` }), 0) },
    scripting: {
      executeScript(details, cb) {
        const type = callType(details);
        const t = details.target;
        const involved = t.allFrames ? frames : frames.filter((f) => f.frameId === t.frameIds[0]);
        ctx.calls.push(type);
        const hung = involved.map((f) => hangs(f, type)).some(Boolean);
        if (hung) return;
        const delay = Math.max(0, ...involved.map((f) => f.slowMs || 0));
        const done = (value, err) =>
          setTimeout(() => {
            chrome.runtime.lastError = err ? { message: err } : null;
            cb(value);
            chrome.runtime.lastError = null;
          }, delay);
        const byId = (id) => frames.find((f) => f.frameId === id);
        const probe = (f) => ({ origin: f.origin, protocol: new URL(f.origin).protocol, isTop: f.depth === 0, isDepth1: f.depth === 1 });
        if (type === 'correlation_files') {
          // eslint-disable-next-line no-new-func
          for (const f of frames) new Function('window', CORR)(frameWindow(f, ctx));
          return done(frames.map((f) => ({ frameId: f.frameId, result: undefined })));
        }
        if (type === 'handshake_read') {
          return done(frames.map((f) => ({ frameId: f.frameId, result: runInWindow(frameWindow(f, ctx), details.func, details.args) })));
        }
        if (type === 'probe_all') return done(frames.map((f) => ({ frameId: f.frameId, result: probe(f) })));
        if (t.allFrames) return done(frames.map((f) => ({ frameId: f.frameId, result: { seen: false } })));
        const fid = t.frameIds[0];
        const f = byId(fid);
        if (details.files) return f ? done(undefined) : done(undefined, 'Cannot access frame');
        if (!f) return done(undefined, 'No frame with id ' + fid);
        const args = details.args || [];
        if (type === 'probe_frame') return done([{ frameId: fid, result: probe(f) }]);
        if (type === 'handshake_send') return done([{ frameId: 0, result: runInWindow(frameWindow(f, ctx), details.func, args) }]);
        if (type === 'inspect_run') return done([{ frameId: fid, result: f.origin === args[0] ? credItems(f) : [] }]);
        if (type === 'declared_check') {
          if (f.origin !== args[0]) return done([{ frameId: fid, result: { met: false, originMismatch: true } }]);
          return done([{ frameId: fid, result: { met: (f.creds || []).includes(args[1]) } }]);
        }
        if (type === 'click') {
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
  return { chrome, ctx };
}

let traceSink = null;
const realInfo = console.info;
console.info = (...a) => {
  if (a[0] === TRACE_TAG) {
    if (traceSink) traceSink.push(a[1]);
    return;
  }
  realInfo(...a);
};

/** Run one click; resolves { reply | null (no reply within REPLY_WAIT_MS), clicks, trace, calls }. */
async function runClick(bgSrc, frames, msg) {
  const { chrome, ctx } = mockChrome(frames);
  const ext = loadExt(bgSrc)(chrome);
  const trace = [];
  traceSink = trace;
  const reply = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), REPLY_WAIT_MS);
    ext.click(msg, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
  traceSink = null;
  return { reply, clicks: ctx.clicks, trace, calls: ctx.calls };
}

const adFrames = (n = 6, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    frameId: 100 + i,
    origin: `https://ads${i + 1}.fixture-cdn.example`,
    depth: 1,
    locator: `iframe#f${i + 1}`,
    ...(extra[i + 1] || {}),
  }));
/** PayPal-shaped step: #email present, «בדוק» on #btnNext reveals #password in the top document. */
function paypalTop(extra = {}) {
  const top = { frameId: 0, origin: ORIGIN, depth: 0, creds: ['#email'], passwords: [] };
  top.clickables = {
    '#btnNext': () => {
      top.creds.push('#password');
      top.passwords.push('#password');
    },
  };
  return Object.assign(top, extra);
}
const revealMsg = (extra = {}) => ({
  allowedOrigin: ORIGIN,
  locator: '#btnNext',
  locatorType: 'css',
  approvedForAuthoringContinuation: true,
  kind: 'transition',
  readinessMode: 'reveal',
  readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 300 },
  requirePasswordSurface: true,
  ...extra,
});
const stagesOf = (trace) => trace.map((e) => e.stage);
const describe = (r) => JSON.stringify({ reply: r.reply, clicks: r.clicks });

// ─── Cases (each throws on failure) ───────────────────────────────────────────
const CASES = {
  async C1(bg) {
    const r = await runClick(bg, [paypalTop(), ...adFrames(6, { 3: { hang: ['inspect_files'] } })], revealMsg());
    assert(r.reply, 'C1 never-answering frame: extension must reply (click never ran before D-121-60)');
    assert(r.clicks === 1, `C1 click ran exactly once: ${describe(r)}`);
    assert(r.reply.ok === true && r.reply.revealed && r.reply.revealed.frame === null, `C1 reveal proceeds in top: ${describe(r)}`);
    assert(r.trace.some((e) => e.stage === 'snapshot_frame' && e.timedOut === true && e.kind === 'depth1'), 'C1 trace names the skipped frame (timedOut)');
    return r;
  },
  async C2(bg) {
    const r = await runClick(bg, [paypalTop(), ...adFrames(6, { 2: { hang: ['correlation_files'] } })], revealMsg());
    assert(r.reply, 'C2 handshake frame never answers: extension must reply');
    assert(r.clicks === 1 && r.reply.ok === true, `C2 click runs, reveal proceeds: ${describe(r)}`);
    assert(r.trace.some((e) => e.stage === 'handshake_listeners' && e.timedOut === true), 'C2 trace: handshake timed out');
    assert(r.trace.some((e) => e.stage === 'snapshot_frames' && e.correlation === 'unavailable'), 'C2 correlation reported unavailable (never silent)');
  },
  async C3(bg) {
    const r = await runClick(bg, [paypalTop(), ...adFrames(6, { 5: { hang: ['probe_all'] } })], revealMsg());
    assert(r.reply, 'C3 all-frames probe never answers: extension must reply');
    assert(r.clicks === 1 && r.reply.ok === true, `C3 top-only fallback, click runs: ${describe(r)}`);
    assert(stagesOf(r.trace).includes('frame_probe_top_only'), 'C3 trace: top-only fallback');
  },
  async C4(bg) {
    const build4 = (slowMs) => {
      const frames = adFrames(6, Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { slowMs }])));
      const f4 = frames[3];
      f4.creds = [];
      f4.passwords = [];
      const top = paypalTop({ creds: ['#email'] });
      top.clickables = {
        '#btnNext': () => {
          f4.creds.push('#pw');
          f4.passwords.push('#pw');
        },
      };
      return [top, ...frames];
    };
    const fast = await runClick(bg, build4(0), revealMsg());
    const slow = await runClick(bg, build4(30), revealMsg());
    assert(fast.reply && fast.reply.ok === true && fast.reply.revealed.frame?.frameLocator === 'iframe#f4', `C4 baseline reveals in iframe#f4: ${describe(fast)}`);
    assert(slow.reply, 'C4 slow frames within bound: reply');
    assert(JSON.stringify(slow.reply) === JSON.stringify(fast.reply) && slow.clicks === 1, `C4 slow frames within bound → unchanged: ${describe(slow)}`);
    assert(!slow.trace.some((e) => e.timedOut === true), 'C4 no call timed out within the bound');
  },
  async C5(bg) {
    const frames = adFrames(6, { 2: { creds: ['#pw'], passwords: ['#pw'], hangOnce: ['inspect_files'] } });
    const top = paypalTop();
    top.clickables = { '#btnNext': () => {} };
    const r = await runClick(bg, [top, ...frames], revealMsg());
    assert(r.reply, 'C5 reply');
    assert(r.clicks === 1, 'C5 click ran');
    assert(r.reply.ok === false && r.reply.reason === 'surface_not_revealed', `C5 frame skipped before the click is never compared (no false positive): ${describe(r)}`);
  },
  async C6(bg) {
    const frames = adFrames(6);
    frames[0].clickables = { '#login': () => {} };
    const framedMsg = revealMsg({ locator: '#login', frame: { frameLocator: 'iframe#f1', frameOrigin: frames[0].origin } });
    const a = await runClick(bg, [paypalTop({ hang: ['handshake_send'] }), ...frames.map((f) => ({ ...f }))], framedMsg);
    assert(a.reply, 'C6a declared click frame, handshake never answers: reply');
    assert(a.clicks === 0 && a.reply.ok === false && a.reply.reason === 'frame_correlation_unavailable', `C6a explicit failure, no click: ${describe(a)}`);
    const frames2 = adFrames(6, { 1: { hang: ['probe_frame'] } });
    frames2[0].clickables = { '#login': () => {} };
    const b = await runClick(bg, [paypalTop(), ...frames2], framedMsg);
    assert(b.reply, 'C6b declared click frame probe never answers: reply');
    assert(b.clicks === 0 && b.reply.ok === false && b.reply.reason === 'frame_missing', `C6b explicit failure (never skipped), no click: ${describe(b)}`);
  },
  async C7(bg) {
    const frames = adFrames(6);
    frames[0].clickables = { '#login': () => {} };
    const mismatch = await runClick(
      bg,
      [paypalTop(), ...frames],
      revealMsg({ locator: '#login', frame: { frameLocator: 'iframe#f1', frameOrigin: 'https://other-idp.example' } }),
    );
    assert(mismatch.reply && mismatch.reply.reason === 'frame_origin_mismatch' && mismatch.clicks === 0, `C7 frame_origin_mismatch unchanged: ${describe(mismatch)}`);
    const f = adFrames(6);
    const f1 = f[0];
    f1.creds = [];
    f1.clickables = { '#next': () => f1.creds.push('#user') };
    const desc = { frameLocator: 'iframe#f1', frameOrigin: f1.origin };
    const declared = await runClick(bg, [paypalTop(), ...f], {
      ...revealMsg({ locator: '#next', frame: desc, readinessMode: 'declared', requirePasswordSurface: false }),
      readiness: { locator: '#user', frame: desc, timeoutMs: 300 },
    });
    assert(declared.reply && declared.reply.ok === true && declared.clicks === 1, `C7 declared-mode framed click unchanged: ${describe(declared)}`);
  },
  async C8(bg) {
    const r = await runClick(bg, [paypalTop(), ...adFrames(6, { 5: { hang: ['gesture_install'] } })], revealMsg());
    assert(r.reply, 'C8 gesture install never answers: reply');
    assert(r.clicks === 0 && r.reply.reason === 'gesture_watch_unavailable', `C8 fail-closed, no click: ${describe(r)}`);
  },
  async C9(bg) {
    const r = await runClick(bg, [paypalTop(), ...adFrames(6, { 5: { hang: ['gesture_collect'] } })], revealMsg());
    assert(r.reply, 'C9 gesture collect never answers: reply');
    assert(r.clicks === 1 && r.reply.ok === false && r.reply.reason === 'gesture_watch_unavailable', `C9 missing gesture proof → fail-closed: ${describe(r)}`);
  },
  async C10(bg) {
    const r = await CASES.C1(bg);
    const s = stagesOf(r.trace);
    const order = ['received', 'tab_ready', 'frame_probe', 'handshake_listeners', 'handshake_send', 'handshake_read', 'snapshot_frames', 'snapshot_done', 'gesture_install', 'click_done', 'poll', 'gesture_collect', 'reply'];
    let at = -1;
    for (const stage of order) {
      const i = s.indexOf(stage, at + 1);
      assert(i > at, `C10 trace stage "${stage}" present in order (got ${s.join(',')})`);
      at = i;
    }
    assert(r.trace.every((e) => typeof e.t === 'number' && typeof e.id === 'string' && e.id.length === 6), 'C10 every trace entry has id + elapsed ms');
    const text = JSON.stringify(r.trace);
    for (const leak of ['#btnNext', '#email', '#password', 'iframe#', 'fixture', 'https://', '[data-pv']) {
      assert(!text.includes(leak), `C10 trace never carries locators / origins / values (found "${leak}")`);
    }
  },
};

// ─── Hub wait ─────────────────────────────────────────────────────────────────
function extensionWorstCaseMs(bgSrc) {
  const num = (name) => {
    const m = new RegExp(`var ${name} = (\\d+);`).exec(bgSrc);
    assert(m, `fixture: ${name} located`);
    return Number(m[1]);
  };
  const C = num('SPECIAL_AUTHORING_CALL_TIMEOUT_MS');
  const H = num('SPECIAL_FRAME_HANDSHAKE_WAIT_MS');
  const P = num('SPECIAL_READINESS_POLL_MS');
  // click-frame resolve 4C+H; pre-snapshot 6C+H; gesture install C; after the readiness window:
  // poll wait P + refresh C + snapshot 6C+H; gesture collect C.
  return 19 * C + 3 * H + P;
}
const TAB_GATE_HEADROOM_MS = 10_000;

function loadHub(hubSrc) {
  return withTempDir('pv-12160-hub-', (outdir) => loadHubIn(outdir, hubSrc));
}
async function loadHubIn(outdir, hubSrc) {
  const hubFile = join(root, HUB).replace(/\\/g, '/').toLowerCase();
  const plugin = {
    name: 'hub-bridge',
    setup(b) {
      b.onLoad({ filter: /currentTabAuthoring\.ts$/ }, (args) => {
        if (args.path.replace(/\\/g, '/').toLowerCase() !== hubFile) return undefined;
        const src = replaceOnce(
          hubSrc,
          "import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';",
          'const sendExtensionMessageAsync = (m: any): Promise<any> => (globalThis as any).__ext(m);\nconst probeExtensionAvailable = (): boolean => true;',
          'bridge import',
        );
        return { contents: src, loader: 'ts', resolveDir: dirname(args.path) };
      });
    },
  };
  const outfile = join(outdir, 'hub.mjs');
  await build({
    entryPoints: [join(root, HUB)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    plugins: [plugin],
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}${Math.random()}`);
}

const HUB_ACTION = {
  actionId: 'a1',
  kind: 'transition',
  locator: '#btnNext',
  approvedForAuthoringContinuation: true,
  readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 8000 },
};

async function hubCase(hubSrc, bgSrc) {
  const margin = /export const AUTHORING_CLICK_HUB_MARGIN_MS = ([\d_]+);/.exec(hubSrc);
  assert(margin, 'C11 Hub margin constant present');
  const marginMs = Number(margin[1].replace(/_/g, ''));
  const worst = extensionWorstCaseMs(bgSrc);
  assert(marginMs >= worst + TAB_GATE_HEADROOM_MS, `C11 Hub margin ${marginMs} ms ≥ extension worst case ${worst} ms + tab-gate headroom`);

  const hub = await loadHub(hubSrc);
  const realSetTimeout = globalThis.setTimeout;
  const scheduled = [];
  globalThis.setTimeout = (fn, ms, ...rest) => {
    scheduled.push(ms);
    return realSetTimeout(fn, ms >= 1000 ? 0 : ms, ...rest);
  };
  try {
    globalThis.__ext = () => new Promise(() => {});
    const silent = await Promise.race([
      hub.performApprovedAuthoringClick({ loginEntryUrl: `${ORIGIN}/login`, action: HUB_ACTION }),
      new Promise((resolve) => realSetTimeout(() => resolve('stalled'), 2000)),
    ]);
    assert(silent !== 'stalled', 'C11 a never-answering extension must not stall the Hub');
    assert(silent.ok === false && silent.reason === 'authoring_click_no_response', `C11 → authoring_click_no_response: ${JSON.stringify(silent)}`);
    assert(scheduled.includes(8000 + marginMs), `C11 Hub wait = readiness timeout + margin (${scheduled.join(',')})`);
    globalThis.__ext = async () => ({ ok: true, revealed: { frameKey: 'top', frame: null }, authoringTabId: 7 });
    const answered = await hub.performApprovedAuthoringClick({ loginEntryUrl: `${ORIGIN}/login`, action: HUB_ACTION });
    assert(answered.ok === true && answered.revealedFrame === null && answered.authoringTabId === 7, `C11 answered click unchanged: ${JSON.stringify(answered)}`);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    delete globalThis.__ext;
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const LABELS = {
  C1: 'never-answering depth-1 frame (inspect) → click runs, reveal proceeds',
  C2: 'handshake frame never answers → correlation unavailable, click runs',
  C3: 'all-frames probe never answers → top-only fallback, click runs',
  C4: 'slow frames within the bound → outcome unchanged (reveal in depth-1 frame)',
  C5: 'frame skipped in the pre-click snapshot is never compared (no false positive)',
  C6: 'declared click frame: handshake / probe never answers → explicit failure, no click',
  C7: 'frame_origin_mismatch unchanged; declared-mode framed click unchanged',
  C8: 'gesture install never answers → gesture_watch_unavailable, no click',
  C9: 'gesture collect never answers → gesture proof missing → fail-closed',
  C10: 'service-worker trace: stages in order, no locators / origins / values',
};

let passed = 0;
console.log('D-121-60 — bounded authoring click');
for (const [key, fn] of Object.entries(CASES)) {
  await fn(BG);
  console.log(`  ✓ ${key} — ${LABELS[key]}`);
  passed += 1;
}
await hubCase(HUB_SRC, BG);
console.log('  ✓ C11 — Hub wait ≥ extension worst case; never-answering extension → authoring_click_no_response');
passed += 1;

const STATIC = [
  ['clickInFrame unchanged (MAIN world, exact-one, .click())', () => {
    const at = BG.indexOf('      function clickInFrame(frameId, next) {');
    const fn = BG.slice(at, BG.indexOf('      function pollDeclared(', at));
    return fn.includes('chrome.scripting.executeScript(') && fn.includes("world: 'MAIN'") && fn.includes('targets.length !== 1') && fn.includes('targets[0].click();') && !fn.includes('specialAuthoringExec');
  }],
  ['runtime callers of the shared helpers stay unbounded', () => {
    const rt = BG.slice(BG.indexOf('/**\n * Phase 121.2 — SPECIAL login flow runtime'));
    return !rt.includes('bounded') && !rt.includes('specialAuthoringExec') && !rt.includes('specialAuthoringTraceStart');
  }],
  ['D-121-60 edits: exactly the listed ones; no webNavigation / debugger / getFrameId / site branches', () => {
    revertD12160BackgroundEdits(revertD12161BackgroundEdits(BG));
    const added = D12160_BACKGROUND_EDITS.map(([next]) => next).join('\n');
    return !/webNavigation|chrome\.debugger|getFrameId|paypal|hostname|serviceId|\.co\.il|\.value\b/i.test(added);
  }],
  ['manifest unchanged by D-121-60 (no permission added)', () => !read('extension/manifest.json').includes('webNavigation')],
];
for (const [label, check] of STATIC) {
  assert(check(), `static: ${label}`);
  console.log(`  ✓ static — ${label}`);
  passed += 1;
}

// ─── Mutations ────────────────────────────────────────────────────────────────
const MUT = [
  ['M1 pre-snapshot per-frame calls unbounded', 'C1', (s) => replaceOnce(s, "        },\n        true,\n      );\n    });\n  }, { bounded: true, trace: trace });", "        },\n        false,\n      );\n    });\n  }, { bounded: true, trace: trace });", 'M1')],
  ['M2 frames skipped before the click compared anyway', 'C5', (s) => replaceOnce(s, 'return !before[e.key] && !skippedBefore[specialFrameKeyOf(e.frame)];', 'return !before[e.key];', 'M2')],
  ['M3 probe timeout fails instead of top-only fallback', 'C3', (s) => replaceOnce(s, '      if (!allTimedOut) {\n        onProbes(allResults, allErr);', '      if (true) {\n        onProbes(allResults, allErr);', 'M3')],
  ['M4 handshake unbounded', 'C2', (s) => replaceOnce(s, '  var bounded = send.bounded === true;', '  var bounded = false;', 'M4')],
  ['M5 click frame probe timeout skipped (fail-open)', 'C6', (s) => replaceOnce(s, "          if (probeErr) {\n            cb({ ok: false, reason: 'frame_missing' });\n            return;\n          }\n          var p = probe && probe[0] && probe[0].result;", '          var p = probeErr ? { isDepth1: true, origin: descriptor.frameOrigin } : probe && probe[0] && probe[0].result;', 'M5')],
  ['M6 gesture install unbounded', 'C8', (s) => replaceOnce(s, "            trace('click_done', { ok: true });\n            next();\n          });\n        }, true);", "            trace('click_done', { ok: true });\n            next();\n          });\n        }, false);", 'M6')],
  ['M7 gesture collect timeout treated as proof', 'C9', (s) => replaceOnce(s, '          send(specialGestureVerdict(outcome, watch));', '          send(specialGestureVerdict(outcome, watch.timedOut ? { ok: true, seen: false } : watch));', 'M7')],
  ['M8 trace carries the click locator', 'C10', (s) => replaceOnce(s, "  trace('received', { mode: readinessMode,", "  trace('received', { locator: locator, mode: readinessMode,", 'M8')],
  ['M9 slow frame (within bound) treated as skipped', 'C4', (s) => replaceOnce(s, '          var timedOut = Boolean(inputs && inputs.timedOut === true);', '          var timedOut = Date.now() - frameStarted > 20;', 'M9')],
];
const HUB_MUT = [
  ['M10 Hub margin below the extension bound', (s) => replaceOnce(s, 'export const AUTHORING_CLICK_HUB_MARGIN_MS = 90_000;', 'export const AUTHORING_CLICK_HUB_MARGIN_MS = 20_000;', 'M10')],
  ['M11 Hub wait removed', (s) => replaceOnce(s, '  const response = await withAuthoringClickWait(', '  const response = await ((p: any, _a: unknown) => p)(', 'M11')],
];

console.log('\nMutations');
let caught = 0;
for (const [label, key, mutate] of MUT) {
  const mutated = mutate(BG);
  let failed = false;
  try {
    await CASES[key](mutated);
  } catch (e) {
    failed = true;
    console.log(`  ✓ mutation caught: ${label}  [${key}: ${String(e.message).slice(0, 90)}]`);
  }
  assert(failed, `mutation NOT caught: ${label}`);
  caught += 1;
}
for (const [label, mutate] of HUB_MUT) {
  let failed = false;
  try {
    await hubCase(mutate(HUB_SRC), BG);
  } catch (e) {
    failed = true;
    console.log(`  ✓ mutation caught: ${label}  [C11: ${String(e.message).slice(0, 90)}]`);
  }
  assert(failed, `mutation NOT caught: ${label}`);
  caught += 1;
}

console.log(`\nD-121-60 verify: ${passed} checks PASS, ${caught} mutations caught`);
process.exit(0);
