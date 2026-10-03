/**
 * Phase 121.1 D-121-36 — declared-frame readiness: a loading frame is not a foreign frame.
 * Runs the real background.js resolveDeclaredFrame / specialDeclaredReadinessMet / pollDeclared
 * against a synthetic frame timeline (no site names). Usage:
 *   node scripts/verifyPhase121DeclaredFrameReadiness.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
let passCount = 0;
function pass(id, what) {
  passCount += 1;
  console.log(`  ✓ ${id} — ${what}`);
}

const loadModule = (entry, name) => withTempDir(`pv-12136-${name}-`, (outdir) => loadModuleIn(outdir, entry, name));
async function loadModuleIn(outdir, entry, name) {
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
  });
  return import(pathToFileURL(outfile).href);
}

function extractFunction(src, name, from = 0) {
  const start = src.indexOf(`function ${name}(`, from);
  assert(start >= 0, `function ${name} present`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

const bgSrc = read('extension/background.js');
const clickHandler = extractFunction(bgSrc, 'authoringClickApprovedAction');
const pollDeclaredSrc = extractFunction(clickHandler, 'pollDeclared');

const TOP = 'https://top.example.test';
const FRAME = 'https://frame.example.test';
const OTHER = 'https://other.example.test';
const DESCRIPTOR = { frameLocator: '#login-frame', frameOrigin: FRAME };
const READY_LOCATOR = '#user';

const blankEmpty = { origin: '', protocol: 'about:', field: false };
const blankNull = { origin: 'null', protocol: 'about:', field: false };
// Initial about:blank inherits the parent's origin; its protocol stays about:.
const blankInherited = { origin: TOP, protocol: 'about:', field: false };
const loadedNoField = { origin: FRAME, protocol: 'https:', field: false };
const loadedReady = { origin: FRAME, protocol: 'https:', field: true };
const foreign = { origin: OTHER, protocol: 'https:', field: true };

/**
 * Build a sandbox with the real background functions. `probeAt(tick)` / `pageAt(tick)` give the
 * frame state seen by the resolve probe and by the in-frame readiness check on poll tick N.
 */
function sandbox({ probeAt, pageAt, frameMatch = 'ok' }) {
  const state = { tick: -1 };
  const chrome = {
    runtime: { lastError: null },
    scripting: {
      executeScript(details, cb) {
        assert(details.func && details.func.name === 'specialFrameProbe', 'only the frame probe is executed directly');
        const s = probeAt(state.tick);
        const location = { origin: s.origin, protocol: s.protocol };
        const run = new Function('location', 'window', `return (${details.func.toString()})();`);
        const win = {};
        win.top = {};
        win.parent = win.top;
        cb([{ result: run(location, win) }]);
      },
    },
  };
  function specialFrameNonceHandshake(_tabId, _resolve, cb) {
    cb(frameMatch === 'none' ? { ok: true, matches: [{ state: 'none' }] } : { ok: true, matches: [{ state: 'ok', frameId: 7 }] });
  }
  function specialInjectThenRun(_tabId, frameId, _files, run, cb) {
    const s = frameId === 0 ? { origin: TOP, protocol: 'https:', field: pageAt(state.tick).field } : pageAt(state.tick);
    const exec = new Function(
      'location',
      'isSpecialDeclaredReadinessMet',
      'args',
      `return (${run.func.toString()}).apply(null, args);`,
    );
    cb(exec({ origin: s.origin, protocol: s.protocol }, () => s.field, run.args));
  }
  const names = ['specialAuthoringExec', 'specialIsHttpsExactOrigin', 'specialIsLoadingFrameDocument', 'specialFrameProbe', 'resolveDeclaredFrame', 'specialDeclaredReadinessMet'];
  const factory = new Function(
    'chrome',
    'specialFrameNonceHandshake',
    'specialInjectThenRun',
    'SPECIAL_INSPECT_FILES',
    'SPECIAL_AUTHORING_CALL_TIMEOUT_MS',
    `${names.map((n) => extractFunction(bgSrc, n)).join('\n')}\nreturn { ${names.join(', ')} };`,
  );
  const api = factory(chrome, specialFrameNonceHandshake, specialInjectThenRun, [], 2500);
  return { api, state };
}

/** Run the real pollDeclared loop until reply. */
function runPoll(timeline, { timeoutMs = 400, pollMs = 5, pageTimeline = timeline, frameMatch } = {}) {
  const at = (arr) => (tick) => arr[Math.max(0, Math.min(tick, arr.length - 1))];
  const { api, state } = sandbox({ probeAt: at(timeline), pageAt: at(pageTimeline), frameMatch });
  return new Promise((resolve) => {
    const counted = (tabId, allowedOrigin, readiness, cb) => {
      state.tick += 1;
      api.specialDeclaredReadinessMet(tabId, allowedOrigin, readiness, cb);
    };
    const poll = new Function(
      'specialDeclaredReadinessMet',
      'tabId',
      'allowedOrigin',
      'readinessLocator',
      'readinessFrame',
      'readinessTarget',
      'reply',
      'refreshGestureWatch',
      'SPECIAL_READINESS_POLL_MS',
      `${pollDeclaredSrc}\nreturn pollDeclared;`,
    )(counted, 1, TOP, READY_LOCATOR, DESCRIPTOR, 'field', (outcome) => resolve({ outcome, ticks: state.tick + 1 }), (next) => next(), pollMs);
    poll(Date.now() + timeoutMs);
  });
}

console.log('Phase 121.1 D-121-36 — declared-frame readiness (loading ≠ foreign)\n');

// ─── 1 — readiness polling: loading frame = not yet ─────────────────────────
console.log('1 — readiness polling');
{
  let r = await runPoll([blankEmpty, blankNull, loadedNoField, loadedReady]);
  assert(r.outcome.ok === true && r.ticks === 4, `blank → correct origin → met: ${JSON.stringify(r)}`);
  pass('1.1', 'frame blank ("" then "null") → correct origin → readiness met');

  r = await runPoll([blankInherited, loadedReady]);
  assert(r.outcome.ok === true && r.ticks === 2, `inherited-origin about:blank pending: ${JSON.stringify(r)}`);
  pass('1.2', 'initial about: document with inherited parent origin → pending, then met');

  r = await runPoll([blankEmpty, foreign]);
  assert(r.outcome.ok === false && r.outcome.reason === 'frame_origin_mismatch' && r.outcome.liveOrigin === OTHER, `blank → foreign: ${JSON.stringify(r)}`);
  assert(r.ticks === 2, 'hard fail immediately on the foreign origin');
  pass('1.3', 'frame blank → other HTTPS origin → hard frame_origin_mismatch (liveOrigin forwarded)');

  r = await runPoll([blankEmpty], { timeoutMs: 60 });
  assert(r.outcome.ok === false && r.outcome.reason === 'readiness_timeout' && r.ticks > 1, `stays blank → timeout: ${JSON.stringify(r)}`);
  pass('1.4', 'frame stays blank → keeps polling → readiness_timeout');

  r = await runPoll([blankEmpty], { timeoutMs: 40, frameMatch: 'none' });
  assert(r.outcome.reason === 'readiness_timeout', 'frame_missing still pending until timeout');
  pass('1.5', 'frame_missing handling unchanged (pending until timeout)');

  r = await runPoll([foreign]);
  assert(r.outcome.reason === 'frame_origin_mismatch' && r.ticks === 1, 'foreign on first probe → hard fail');
  pass('1.6', 'a real different HTTPS origin is a hard fail on the first tick');
}

// ─── 1b — non-polling callers unchanged ─────────────────────────────────────
console.log('\n1b — non-polling resolveDeclaredFrame unchanged');
{
  for (const blank of [blankEmpty, blankNull, blankInherited]) {
    const { api } = sandbox({ probeAt: () => blank, pageAt: () => blank });
    const res = await new Promise((resolve) => api.resolveDeclaredFrame(1, TOP, DESCRIPTOR, resolve));
    assert(res.ok === false && res.reason === 'frame_origin_mismatch' && res.liveOrigin === blank.origin, `non-polling blank: ${JSON.stringify(res)}`);
  }
  const { api } = sandbox({ probeAt: () => loadedReady, pageAt: () => loadedReady });
  const ok = await new Promise((resolve) => api.resolveDeclaredFrame(1, TOP, DESCRIPTOR, resolve));
  assert(ok.ok === true && ok.frameId === 7, 'resolves loaded frame');
  const clickCall = clickHandler.slice(clickHandler.indexOf('resolveDeclaredFrame(tabId, allowedOrigin, clickFrame'));
  assert(!clickCall.slice(0, clickCall.indexOf('\n      }\n')).includes('loadingIsPending'), 'click-frame resolution not polling-scoped');
  // 121.2 RT-4.1 step 6: the SPECIAL runtime fill re-resolve is the only other opt-in.
  const optCallers = bgSrc.match(/loadingIsPending: true/g) || [];
  const runtimeFn = extractFunction(bgSrc, 'runSpecialLoginFlow');
  const fillResolve = extractFunction(runtimeFn, 'resolveFillDocument');
  // 121.3: opener + transition clicks share resolveActionDocument (not polling-scoped).
  const openerResolve = extractFunction(runtimeFn, 'resolveActionDocument');
  assert(
    optCallers.length === 2 &&
      extractFunction(bgSrc, 'specialDeclaredReadinessMet').includes('{ loadingIsPending: true }') &&
      fillResolve.includes('{ loadingIsPending: true }') &&
      !openerResolve.includes('loadingIsPending'),
    'only readiness polling and the SPECIAL fill re-resolve opt in',
  );
  pass('1b.1', 'resolveDeclaredFrame without the option: blank frame → frame_origin_mismatch as before; only readiness polling + SPECIAL fill re-resolve opt in');
}

// ─── 2 — checkIn originMismatch path ────────────────────────────────────────
console.log('\n2 — in-frame readiness check (checkIn) origin path');
{
  // Probe already sees the declared origin, but the in-frame check lands on a (re)loading document.
  let r = await runPoll([loadedNoField, loadedNoField, loadedReady], { pageTimeline: [blankEmpty, blankNull, loadedReady] });
  assert(r.outcome.ok === true && r.ticks === 3, `checkIn blank → pending: ${JSON.stringify(r)}`);
  pass('2.1', 'checkIn sees blank / "null" document → not yet → later met');

  r = await runPoll([loadedNoField], { pageTimeline: [foreign] });
  assert(r.outcome.ok === false && r.outcome.reason === 'frame_origin_mismatch' && r.outcome.liveOrigin === OTHER, `checkIn foreign: ${JSON.stringify(r)}`);
  pass('2.2', 'checkIn sees another HTTPS origin → hard frame_origin_mismatch with liveOrigin');

  const { api } = sandbox({ probeAt: () => blankEmpty, pageAt: () => blankEmpty });
  const top = await new Promise((resolve) =>
    api.specialDeclaredReadinessMet(1, 'https://different-top.example.test', { locator: READY_LOCATOR, frame: null }, resolve),
  );
  assert(top.ok === false && top.reason === 'origin_mismatch', 'top document origin mismatch stays hard (R1)');
  pass('2.3', 'top-document readiness origin mismatch stays a hard fail (R1 unchanged)');

  const pred = new Function(`${extractFunction(bgSrc, 'specialIsLoadingFrameDocument')}\nreturn specialIsLoadingFrameDocument;`)();
  assert(pred('', '') && pred('null', 'about:') && pred(TOP, 'about:') && pred('null', '') && pred(undefined, undefined), 'loading cases');
  assert(!pred(FRAME, 'https:') && !pred(OTHER, 'https:') && !pred('http://x.example.test', 'http:') && !pred(OTHER, ''), 'real origins are not loading');
  pass('2.4', 'loading predicate: empty / "null" / non-HTTP(S) protocol only');
}

// ─── 3 — copy ────────────────────────────────────────────────────────────────
console.log('\n3 — copy');
{
  const hub = await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub');
  const types = await loadModule('src/assistedMapping/types.ts', 'types');
  const EXACT = 'המסגרת עדיין לא נטענה או נסגרה — נסו שוב.';
  assert(types.FRAME_NOT_LOADED_HE === EXACT, 'exact copy');
  for (const live of ['', 'null', '  ', undefined]) {
    const msg = hub.authoringClickFailureMessageHe('frame_origin_mismatch', live);
    assert(msg === EXACT && !msg.includes('שייכת כעת לאתר אחר'), `empty origin copy for ${JSON.stringify(live)}`);
    assert(types.FRAME_ORIGIN_CHANGED_HE(live ?? '') === EXACT, 'FRAME_ORIGIN_CHANGED_HE empty → not loaded');
  }
  const visual = hub.interpretCurrentTabVisualResponse({ ok: false, reason: 'frame_origin_mismatch', frameOrigin: '' }, 'username');
  assert(visual.message === EXACT, 'visual path copy');
  const real = hub.authoringClickFailureMessageHe('frame_origin_mismatch', OTHER);
  assert(real.includes('שייכת כעת לאתר אחר') && real.includes(OTHER), 'real foreign origin keeps the existing text');
  pass('3.1', `empty / "null" liveOrigin → «${EXACT}»; real foreign origin keeps «…שייכת כעת לאתר אחר (origin)…»`);
}

// ─── Binding ────────────────────────────────────────────────────────────────
console.log('\nBinding constraints');
{
  const manifest = read('extension/manifest.json');
  assert(!/webNavigation|"debugger"/.test(manifest), 'manifest');
  const newCode = [extractFunction(bgSrc, 'specialIsLoadingFrameDocument'), extractFunction(bgSrc, 'resolveDeclaredFrame'), extractFunction(bgSrc, 'specialDeclaredReadinessMet')].join('\n');
  assert(!/webNavigation|chrome\.debugger|getFrameId/.test(newCode), 'no webNavigation / debugger / getFrameId');
  assert(!/hostname|serviceId|\.co\.il|bank/i.test(newCode), 'no site branches');
  assert(clickHandler.includes('SPECIAL_RESERVED_ACTION_KINDS.indexOf(message.kind) >= 0') && clickHandler.includes('message.approvedForAuthoringContinuation !== true'), 'click gate + final_submit reserved');
  assert(clickHandler.includes('specialGestureVerdict(outcome, watch)'), 'D-121-35 G4 preserved');
  pass('B.1', 'no manifest / permission change; no webNavigation / debugger / getFrameId; no site branches; gates + G4 preserved');
}

console.log(`\nD-121-36 verify: ${passCount} checks PASS`);
