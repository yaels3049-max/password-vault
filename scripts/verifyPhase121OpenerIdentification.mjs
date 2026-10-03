/**
 * Phase 121.1 D-121-35 — generic opener / transition identification (G1–G4).
 * Synthetic fixtures only (no site names). Usage:
 *   node scripts/verifyPhase121OpenerIdentification.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
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

function loadModule(entry, name) {
  return withTempDir(`pv-12135-${name}-`, async (outdir) => {
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
    return await import(pathToFileURL(outfile).href);
  });
}

const PAGE_FILES = [
  'extension/generic/managed-target-eligibility.js',
  'extension/generic/locator-determinism.js',
  'extension/generic/page-structure-inspect.js',
  'extension/generic/visual-target-pick.js',
];

function loadDom(html, origin = 'https://fixture.example.test') {
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
    if (hiddenStyle(this)) return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 };
    return { width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 };
  };
  Proto.getClientRects = function getClientRects() {
    const r = this.getBoundingClientRect();
    return r.width > 0 ? [r] : [];
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  for (const rel of PAGE_FILES) {
    const run = new Function('window', 'document', 'globalThis', 'CSS', `${read(rel)}\n//# sourceURL=${rel}`);
    run(window, window.document, window, globalThis.CSS);
  }
  return window;
}

/** Extract a top-level `function name(...) {...}` from source by brace matching. */
function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
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

const FORBIDDEN_LOCATOR_RE = /nth-|:contains|:has-text|\/\/|xpath/i;

console.log('Phase 121.1 D-121-35 — opener / transition identification\n');

const detSrc = read('extension/generic/locator-determinism.js');
const inspectSrc = read('extension/generic/page-structure-inspect.js');
const pickSrc = read('extension/generic/visual-target-pick.js');
const bgSrc = read('extension/background.js');
const hubSrc = read('src/assistedMapping/currentTabAuthoring.ts');
const typesSrc = read('src/assistedMapping/types.ts');
const routingSrc = read('src/assistedMapping/specialAnalyzeRouting.ts');
const editorSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const manifestSrc = read('extension/manifest.json');

// ─── G1 — locator vocabulary ────────────────────────────────────────────────
console.log('G1 — text-free action locator vocabulary');
{
  const w = loadDom(`
    <a id="skip" href="#main" aria-label="skip to content">skip</a>
    <a class="login-trigger" href="#" role="button" data-target="#login" data-toggle="modal"><span id="inner">Open</span></a>
    <button data-toggle="modal" data-target="#signup">Sign</button>
    <div role="button" data-testid="open-auth">X</div>
    <button aria-controls="auth-panel">Y</button>
    <a href="/account/entry">Z</a>
    <button class="open-auth css-1abcde active">W</button>
    <a class="trigger" href="#">T1</a>
    <a class="trigger" href="#" role="button">T2</a>
    <a href="javascript:void(0)" class="jsx-99887">J</a>
    <input id="user" name="user" data-testid="user-field" autocomplete="username" />
    <main id="main"></main>`);
  const LD = w.LocatorDeterminism;
  const ins = w.__pageStructureInspectHelpers;
  const pick = w.__visualTargetPickHelpers;
  const doc = w.document;

  const opener = doc.querySelector('a.login-trigger');
  const openerCands = ins.buildCandidates(opener, { action: true });
  const chosen = LD.chooseDeterministicLocator(openerCands, opener, doc);
  assert(chosen && chosen.locator === 'a[data-toggle="modal"][data-target="#login"]', `opener locator: ${chosen && chosen.locator}`);
  assert(LD.assertLocatorDeterministic(chosen.locator, opener, doc), 'opener exact-one + identity');
  pass('G1.1', `real opener (no id/name/aria-label) → ${chosen.locator} (exact-one + identity)`);

  const onlyToggle = doc.querySelector('button[data-target="#signup"]');
  const tChosen = LD.chooseDeterministicLocator(ins.buildCandidates(onlyToggle, { action: true }), onlyToggle, doc);
  assert(tChosen && tChosen.locator === 'button[data-toggle="modal"][data-target="#signup"]', 'data-toggle/data-target only');
  pass('G1.2', 'element with only data-toggle / data-target gets an exact-one locator');

  const testAttr = doc.querySelector('div[role="button"]');
  const ta = LD.chooseDeterministicLocator(ins.buildCandidates(testAttr, { action: true }), testAttr, doc);
  assert(ta && ta.locator === 'div[data-testid="open-auth"]', `test attr: ${ta && ta.locator}`);
  const ctrl = doc.querySelector('button[aria-controls]');
  const ca = LD.chooseDeterministicLocator(ins.buildCandidates(ctrl, { action: true }), ctrl, doc);
  assert(ca && ca.locator === 'button[aria-controls="auth-panel"]', 'aria-controls');
  const real = doc.querySelector('a[href="/account/entry"]');
  const ra = LD.chooseDeterministicLocator(ins.buildCandidates(real, { action: true }), real, doc);
  assert(ra && ra.locator === 'a[href="/account/entry"]', 'real-path href');
  const cls = doc.querySelector('button.open-auth');
  const clsCands = ins.buildCandidates(cls, { action: true });
  assert(clsCands.some((c) => c.locator === 'button.open-auth'), 'stable class used');
  assert(!clsCands.some((c) => /css-1abcde|active/.test(c.locator)), 'generated / state classes rejected');
  const t2 = doc.querySelectorAll('a.trigger')[1];
  const t2c = LD.chooseDeterministicLocator(ins.buildCandidates(t2, { action: true }), t2, doc);
  assert(t2c && t2c.locator === 'a.trigger[role="button"]', `role combo: ${t2c && t2c.locator}`);
  pass('G1.3', 'data-testid / aria-controls / real href / tag.class / role-combined strategies');

  const jsA = doc.querySelector('a[href^="javascript"]');
  assert(ins.buildCandidates(jsA, { action: true }).length === 0, 'javascript: href + generated class → no locator');
  const hashA = doc.querySelectorAll('a.trigger')[0];
  assert(!ins.buildCandidates(hashA, { action: true }).some((c) => c.locator.includes('href')), 'href="#" never used');
  assert(LD.isRealPathHref('/x') && !LD.isRealPathHref('#') && !LD.isRealPathHref('') && !LD.isRealPathHref('#login') && !LD.isRealPathHref('javascript:void(0)'), 'href filter');
  for (const good of ['login-trigger', 'btn', 'loginTrigger', 'open_auth']) assert(LD.isStableClassName(good), `stable ${good}`);
  for (const bad of ['css-1q2w3e', 'sc-bdVaJa', 'Button_root__3xYz9', 'jss123', 'active', 'show', 'is-open', '1abc', 'x']) {
    assert(!LD.isStableClassName(bad), `reject ${bad}`);
  }
  pass('G1.4', 'href empty / "#" / fragment / javascript: rejected; hashed / numeric / state classes rejected');

  const all = [];
  doc.querySelectorAll('a, button, div[role="button"]').forEach((el) => {
    ins.buildCandidates(el, { action: true }).forEach((c) => all.push(c.locator));
    pick.buildCandidates(el, { action: true }).forEach((c) => all.push(c.locator));
  });
  assert(all.length > 0 && all.every((l) => !FORBIDDEN_LOCATOR_RE.test(l)), 'no positional / text / xpath');
  assert(!all.some((l) => /Open|Sign|skip to/.test(l.replace(/aria-label="[^"]*"/, ''))), 'never text content');
  pass('G1.5', 'no text-content, nth-child/positional, or XPath locators');

  // Existing field locator choices unchanged: fields never receive the extended vocabulary.
  const input = doc.getElementById('user');
  const fieldIns = ins.buildCandidates(input).map((c) => c.locator);
  const fieldPick = pick.buildCandidates(input).map((c) => c.locator);
  const expected = ['#user', 'input[name="user"]', 'input[autocomplete="username"]'];
  assert(JSON.stringify(fieldIns) === JSON.stringify(expected), `inspect field candidates: ${fieldIns}`);
  assert(JSON.stringify(fieldPick) === JSON.stringify(expected), `pick field candidates: ${fieldPick}`);
  // Existing strategies stay first for actions (appended after id / name / autocomplete / aria-label).
  const skip = doc.getElementById('skip');
  const skipCands = ins.buildCandidates(skip, { action: true }).map((c) => c.locator);
  assert(skipCands[0] === '#skip' && skipCands[1] === 'a[aria-label="skip to content"]', 'existing strategies first');
  pass('G1.6', 'field candidates byte-identical (inspect + pick); existing strategies first for actions');

  assert(detSrc.includes('function actionLocatorCandidates(el)'), 'shared vocabulary in locator-determinism.js');
  assert(inspectSrc.includes('sharedVocab.actionLocatorCandidates(el)') && pickSrc.includes('sharedVocab.actionLocatorCandidates(el)'), 'both builders use shared vocabulary');
  assert(/forAction && sharedVocab/.test(inspectSrc) && /forAction && sharedVocab/.test(pickSrc), 'opt-in for actions only');
  pass('G1.7', 'single shared vocabulary (locator-determinism.js) used by both candidate builders, action-only');
}

// ─── G3 — skip-link filter + popup-first ranking ────────────────────────────
console.log('\nG3 — skip-link filter and popup-first ranking');
{
  const w = loadDom(`
    <a href="#main" aria-label="skip to content">skip</a>
    <a href="#nav-missing" class="nav-jump">jump</a>
    <a href="#panel" aria-controls="panel" class="panel-toggle">panel</a>
    <button id="help">Help</button>
    <a class="login-trigger" href="#" role="button" data-target="#login" data-toggle="modal"><span>Open</span></a>
    <main id="main"></main><div id="panel"></div>`);
  const LD = w.LocatorDeterminism;
  const doc = w.document;
  const out = w.collectSpecialAuthoringActionCandidates();
  const locs = out.map((a) => a.locator);
  assert(!locs.some((l) => l.includes('skip to content')), `skip link excluded: ${locs}`);
  assert(locs.includes('a[data-toggle="modal"][data-target="#login"]'), 'href="#" modal trigger kept');
  assert(locs.includes('a.nav-jump'), 'fragment to a missing element is not a skip link');
  assert(locs.includes('a[aria-controls="panel"]'), 'fragment anchor with popup semantics kept');
  pass('G3.1', 'skip link excluded; href="#" modal trigger kept; popup-semantics fragment kept');

  assert(out[0].popupSemantics === true && out[1].popupSemantics === true, 'popup-first');
  assert(out.filter((a) => !a.popupSemantics).every((a) => out.indexOf(a) >= 2), 'non-popup after popup');
  assert(out.map((a) => a.actionCandidateId).join(',') === out.map((_, i) => `act-${i + 1}`).join(','), 'ids after ranking');
  pass('G3.2', 'candidates with popup semantics ranked first (stable), ids assigned after ranking');

  assert(LD.isSkipLink(doc.querySelector('a[href="#main"]')) === true, 'isSkipLink true');
  const bare = doc.createElement('a');
  bare.setAttribute('href', '#');
  doc.body.appendChild(bare);
  assert(LD.isSkipLink(bare) === false, 'href="#" alone is not a skip link');
  for (const attr of ['aria-haspopup', 'aria-controls', 'aria-expanded', 'data-toggle', 'data-bs-toggle', 'data-target', 'data-bs-target']) {
    const a = doc.createElement('a');
    a.setAttribute('href', '#main');
    a.setAttribute(attr, 'x');
    doc.body.appendChild(a);
    assert(LD.isSkipLink(a) === false, `popup attr ${attr} → not a skip link`);
  }
  pass('G3.3', 'skip-link predicate: "#<existing id>" without popup semantics only');

  const routing = await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing');
  const proposals = routing.proposeSpecialActionCandidates({
    pattern: 'FLOATING_SCREEN',
    actionCandidates: [
      { actionCandidateId: 'act-1', tagName: 'a', label: 'a.menu', locator: 'a.menu', locatorType: 'css', matchCount: 1 },
      { actionCandidateId: 'act-2', tagName: 'a', label: 'a.pop', locator: 'a.pop', locatorType: 'css', matchCount: 1, popupSemantics: true },
      { actionCandidateId: 'act-3', tagName: 'button', label: 'Login', locator: '#login-btn', locatorType: 'css', matchCount: 1 },
    ],
  });
  assert(proposals[0].actionCandidateId === 'act-3', 'confidence stays primary');
  assert(proposals[1].actionCandidateId === 'act-2' && proposals[2].actionCandidateId === 'act-1', 'popup tie-breaker');
  assert(proposals.every((p) => p.action.approvedForAuthoringContinuation === false && p.kind !== 'final_submit'), 'unapproved, no final_submit');
  pass('G3.4', 'Hub routing: confidence primary, popup semantics tie-breaker; proposals unapproved; no final_submit');
}

// ─── G2 — action pick mode ──────────────────────────────────────────────────
console.log('\nG2 — SPECIAL action pick mode');
{
  const html = `
    <a class="login-trigger" href="#" role="button" data-target="#login" data-toggle="modal"><span id="inner">Open</span></a>
    <a id="skipper" href="#main">skip</a>
    <button id="hidden-btn" style="display:none">H</button>
    <div id="plain">text</div>
    <button id="field-btn">B</button>
    <input id="user" name="user" />
    <main id="main"></main>`;
  const w = loadDom(html);
  const doc = w.document;
  const pick = w.__visualTargetPickHelpers;

  const r = pick.identifyActionTarget(doc.getElementById('inner'), doc);
  assert(r.ok === true && r.tagName === 'a', 'inner span resolves to ancestor anchor');
  assert(doc.querySelector(r.locator) === doc.querySelector('a.login-trigger'), 'identity = ancestor anchor');
  assert(r.locator === 'a[data-toggle="modal"][data-target="#login"]', 'action locator');
  pass('G2.1', `inner span → nearest actionable ancestor <a> → ${r.locator}`);

  // D-121-41 supersedes the D-121-35 pick filters: non-actionable elements and skip links are accepted.
  const plainPick = pick.identifyActionTarget(doc.getElementById('plain'), doc);
  assert(plainPick.ok === true && plainPick.locator === '#plain', 'non-actionable visible element accepted (D-121-41)');
  assert(pick.identifyActionTarget(doc.getElementById('hidden-btn'), doc).reason === 'action_target_not_visible', 'hidden');
  const skipPick = pick.identifyActionTarget(doc.getElementById('skipper'), doc);
  assert(skipPick.ok === true && skipPick.locator === '#skipper', 'skip link accepted in manual pick (D-121-41)');
  pass('G2.2', 'hidden → not visible; non-actionable element and skip link accepted (D-121-41)');

  function clickAndPick(target, options) {
    const p = w.armVisualTargetPick({ expectedOrigin: 'https://fixture.example.test', fieldId: 'f', ...options });
    target.dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
    return p;
  }
  const armed = await clickAndPick(doc.getElementById('inner'), { mode: 'pick', pickTarget: 'action', timeoutMs: 1000 });
  assert(armed.ok === true && armed.locator === r.locator && armed.fieldId === 'f', `armed action pick: ${JSON.stringify(armed)}`);
  assert(armed.frameOrigin === 'https://fixture.example.test' && armed.isTop === true, 'frame tags');
  pass('G2.3', 'armVisualTargetPick(pickTarget:"action") resolves the ancestor locator with frame tags');

  const fieldPick = await clickAndPick(doc.getElementById('field-btn'), { mode: 'pick', timeoutMs: 1000 });
  assert(fieldPick.ok === false && fieldPick.reason === 'unsupported_target', 'field pick rejects buttons');
  assert(pick.isIdentifiableControl(doc.getElementById('field-btn')) === false, 'isIdentifiableControl(button) false');
  const standard = await clickAndPick(doc.getElementById('field-btn'), { pickTarget: 'action' });
  assert(standard.ok === false && standard.reason === 'unsupported_target', 'STANDARD (no mode) ignores pickTarget');
  pass('G2.4', 'field pick still rejects buttons; STANDARD pick (no mode) ignores pickTarget');

  // linkedom has no capture phase ordering; assert the document-level swallow via defaultPrevented.
  const press = () => {
    const ev = new w.Event('pointerdown', { bubbles: true, cancelable: true });
    doc.getElementById('inner').dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const p = w.armVisualTargetPick({ expectedOrigin: 'https://fixture.example.test', fieldId: 'f', mode: 'pick', pickTarget: 'action', timeoutMs: 1000 });
  assert(press() === true, 'pointerdown swallowed while action pick armed');
  doc.getElementById('inner').dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
  await p;
  assert(press() === false, 'swallow listeners removed on finish');
  const fp = w.armVisualTargetPick({ expectedOrigin: 'https://fixture.example.test', fieldId: 'f', mode: 'pick', timeoutMs: 1000 });
  assert(press() === false, 'field pick does not swallow presses (unchanged)');
  doc.getElementById('user').dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
  await fp;
  assert(/doc\.addEventListener\(type, swallowPointer, true\)/.test(pickSrc), 'capture-phase registration');
  pass('G2.5', 'press swallowed (capture) only during action pick; listeners removed after');

  assert(bgSrc.includes("var pickTarget = message.pickTarget === 'action' ? 'action' : 'field';"), 'bg pickTarget');
  assert(bgSrc.includes('pickTarget: targetKind,'), 'bg passes pickTarget to armVisualTargetPick');
  assert(hubSrc.includes("...(pickTarget === 'action' ? { pickTarget } : {}),"), 'hub sends pickTarget');
  assert(editorSrc.includes("...(pick.target === 'action' ? { pickTarget: 'action' as const } : {}),"), 'editor wires action pick');
  assert(pickSrc.includes("var pickTarget = mode && options.pickTarget === 'action' ? 'action' : 'field';"), 'SPECIAL-only');
  pass('G2.6', 'wiring: visualPickAction → startCurrentTabVisualMapping → background → armVisualTargetPick');

  const hub = await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub');
  const types = await loadModule('src/assistedMapping/types.ts', 'types');
  const aMsg = hub.interpretCurrentTabVisualResponse({ ok: false, reason: 'unsupported_target' }, 'action:floating_opener', 'action');
  assert(aMsg.message === types.VISUAL_ACTION_UNSUPPORTED_TARGET_HE, 'action unsupported message');
  assert(types.VISUAL_ACTION_SKIP_LINK_HE === undefined, 'skip-link message removed (D-121-41)');
  const fMsg = hub.interpretCurrentTabVisualResponse({ ok: false, reason: 'unsupported_target' }, 'username');
  assert(fMsg.message === types.VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE, 'field message unchanged');
  const ok = hub.interpretCurrentTabVisualResponse({ ok: true, locator: r.locator, state: 'IDENTIFIED_ACTION' }, 'action:floating_opener', 'action');
  assert(ok.ok === true && ok.locator === r.locator, 'action success');
  pass('G2.7', 'Hub: action-specific failure messages; field messages unchanged');
}

// ─── G4 — test-proof integrity ──────────────────────────────────────────────
console.log('\nG4 — trusted-gesture watch during the test');
{
  const src = ['specialGestureWatchInstall', 'specialGestureWatchCollect', 'specialGestureVerdict']
    .map((n) => extractFunction(bgSrc, n))
    .join('\n');
  function fakeWindow() {
    const listeners = [];
    const win = {
      addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
      removeEventListener: (type, fn, capture) => {
        const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
        if (i >= 0) listeners.splice(i, 1);
      },
      fire: (type, isTrusted) => listeners.filter((l) => l.type === type).forEach((l) => l.fn({ type, isTrusted })),
      listeners,
    };
    return win;
  }
  function funcs(win) {
    return new Function('window', `${src}\nreturn { install: specialGestureWatchInstall, collect: specialGestureWatchCollect, verdict: specialGestureVerdict };`)(win);
  }

  const win = fakeWindow();
  const g = funcs(win);
  g.install('t1');
  assert(win.listeners.length === 2 && win.listeners.every((l) => l.capture === true), 'pointerdown + keydown capture');
  g.install('t1');
  assert(win.listeners.length === 2, 'idempotent per token');
  win.fire('pointerdown', false);
  win.fire('keydown', false);
  let c = g.collect('t1');
  assert(c.seen === false, 'synthetic (untrusted) events ignored — the Ext click is not a user gesture');
  assert(win.listeners.length === 0 && win.__pvSpecialGestureWatch === undefined, 'listeners removed, nothing stored');
  pass('G4.1', 'watch installs pointerdown/keydown capture listeners; untrusted events ignored; cleaned up after');

  g.install('t2');
  win.fire('pointerdown', true);
  c = g.collect('t2');
  assert(c.seen === true, 'trusted pointerdown seen');
  g.install('t3');
  win.fire('keydown', true);
  assert(g.collect('t3').seen === true, 'trusted keydown seen');
  g.install('t4');
  win.fire('pointerdown', true);
  g.install('t5');
  assert(win.listeners.length === 2 && g.collect('t5').seen === false, 'new token replaces old watch');
  pass('G4.2', 'trusted pointerdown / keydown during the window are detected');

  assert(JSON.stringify(g.verdict({ ok: true }, { ok: true, seen: true })) === JSON.stringify({ ok: false, reason: 'user_gesture_during_test' }), 'gesture → not proven');
  assert(g.verdict({ ok: true, revealed: 1 }, { ok: true, seen: false }).ok === true, 'no gesture → success kept');
  assert(g.verdict({ ok: false, reason: 'surface_not_revealed' }, { ok: true, seen: true }).reason === 'surface_not_revealed', 'failure unchanged');
  assert(g.verdict({ ok: true }, { ok: false }).reason === 'gesture_watch_unavailable', 'fail-closed when watch unavailable');
  pass('G4.3', 'gesture during test → not proven; fail-closed if the watch cannot be read');

  const handler = extractFunction(bgSrc, 'authoringClickApprovedAction');
  assert(/specialGestureWatchRun\(tabId, specialGestureWatchInstall, token,[\s\S]*clickInFrame\(frameId, next\)/.test(handler), 'watch installed before the Ext click');
  assert(/function reply\(outcome\)[\s\S]*specialGestureWatchCollect[\s\S]*specialGestureVerdict\(outcome, watch\)/.test(handler), 'every reply collects + removes');
  assert(handler.includes('refreshGestureWatch(function () {\n                pollDeclared(deadline);') && handler.includes('pollReveal(before, deadline);'), 'refreshed during readiness polling');
  const runFn = extractFunction(bgSrc, 'specialGestureWatchRun');
  assert(runFn.includes('allFrames: true') && runFn.includes("world: 'ISOLATED'"), 'all frames, isolated world');
  assert(handler.includes("message.approvedForAuthoringContinuation !== true") && handler.includes("SPECIAL_RESERVED_ACTION_KINDS.indexOf(message.kind) >= 0"), 'click gate + final_submit reserved unchanged');
  assert(!/chrome\.storage|localStorage|sessionStorage/.test(src + runFn), 'stores nothing');
  pass('G4.4', 'background: install before click, refresh while polling, collect on every reply; gate unchanged');

  const hub = await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub2');
  const EXACT = 'נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.';
  assert(hub.authoringClickFailureMessageHe('user_gesture_during_test') === EXACT, 'exact Hebrew message');
  assert(typesSrc.includes(EXACT), 'message constant');
  const failStart = editorSrc.indexOf('if (!result.ok) {', editorSrc.indexOf('async function testAndChooseAction'));
  const failBranch = editorSrc.slice(failStart, editorSrc.indexOf('return;', failStart));
  assert(failBranch.includes('writeDraftAction(consentDraft, actionAfterTestFailure(action))'), 'not selected');
  assert(failBranch.includes('setTestOutcome(action.actionId, notProven ? null : testFailureOutcome(result.reason));'), 'no "not opened" claim when not proven');
  assert(failBranch.includes('setError(result.message)') && !failBranch.includes('runSpecialAnalyze'), 'message shown, no auto-Analyze');
  pass('G4.5', 'Hub: exact not-proven message; editor: button not selected, no auto-Analyze');
}

// ─── D-121-41 — Admin manual pick unrestricted; skip-link rule narrowed to Analyze ─
console.log('\nD-121-41 — manual pick unrestricted; skip-link rule narrowed to Analyze');
{
  const w = loadDom(`
    <a href="#modal-auth" id="openAnchor">Log in</a>
    <a href="#role-dlg" class="dlg-open">Open A</a>
    <a href="#hidden-attr" class="hid-open">Open B</a>
    <a href="#aria-hid" class="aria-open">Open C</a>
    <a href="#native-dlg" class="native-open">Open D</a>
    <a href="#vis-hid" class="vh-open">Open E</a>
    <a href="#zero-box" class="zero-open">Open F</a>
    <a href="#modal-inner" class="inner-open">Open G</a>
    <a href="#page-content" class="content-jump">Skip to content</a>
    <a href="#real-btn" class="skip-to-btn">Skip to button</a>
    <button id="real-btn" aria-haspopup="dialog">Sign in</button>
    <button class="basket" aria-controls="basket-panel">Basket</button>
    <div id="promo-banner">Promo <span id="promo-inner">text</span></div>
    <p>no attributes</p>
    <span class="dup">one</span><span class="dup">two</span>
    <div id="modal-auth" style="display:none"><input id="user" name="user" /></div>
    <div id="role-dlg" role="dialog"></div>
    <div id="hidden-attr" hidden></div>
    <div id="aria-hid" aria-hidden="true"></div>
    <dialog id="native-dlg"></dialog>
    <div id="vis-hid" style="visibility:hidden"></div>
    <div id="zero-box"></div>
    <div aria-modal="true"><form id="modal-inner"></form></div>
    <section id="page-content"></section>`);
  const LD = w.LocatorDeterminism;
  const doc = w.document;
  const pick = w.__visualTargetPickHelpers;
  doc.getElementById('zero-box').getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 });

  const hiddenTargets = ['a#openAnchor', 'a.dlg-open', 'a.hid-open', 'a.aria-open', 'a.native-open', 'a.vh-open', 'a.zero-open', 'a.inner-open'];
  for (const sel of hiddenTargets) {
    assert(LD.isSkipLink(doc.querySelector(sel)) === false, `${sel}: hidden / dialog target → not a skip link`);
  }
  assert(LD.isSkipLink(doc.querySelector('a.content-jump')) === true, 'anchor → visible content is a skip link');
  assert(LD.isSkipLink(doc.querySelector('a.skip-to-btn')) === true, 'skip link → visible real button is a skip link');
  pass('D41.1', 'isSkipLink: display:none / [hidden] / aria-hidden / visibility:hidden / zero-size / dialog targets are not skip links; visible content is');

  const out = w.collectSpecialAuthoringActionCandidates();
  const locs = out.map((a) => a.locator);
  assert(locs.includes('#openAnchor'), `anchor → hidden modal container kept in Analyze with its id locator: ${locs}`);
  for (const loc of ['a.dlg-open', 'a.hid-open', 'a.aria-open', 'a.native-open', 'a.vh-open', 'a.zero-open', 'a.inner-open']) {
    assert(locs.includes(loc), `${loc} kept in Analyze`);
  }
  assert(!locs.includes('a.content-jump'), 'anchor → visible content excluded in Analyze');
  assert(!locs.includes('a.skip-to-btn'), 'skip link → visible real button still excluded in Analyze');
  assert(locs.includes('#real-btn'), 'the real button itself kept');
  pass('D41.2', 'Analyze keeps anchors to hidden / dialog targets; still excludes anchors to visible content (incl. the skip link → real button shape)');

  const routing = await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing41');
  const opener = out.find((a) => a.locator === '#openAnchor');
  const basket = out.find((a) => a.locator === 'button[aria-controls="basket-panel"]');
  assert(opener && basket && basket.popupSemantics === true && opener.popupSemantics === false, 'observations');
  const proposals = routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: [basket, opener] });
  assert(proposals[0].action.locator === '#openAnchor' && proposals[0].confidence === 'high', 'label confidence first');
  assert(proposals.every((p) => p.kind !== 'final_submit' && p.action.approvedForAuthoringContinuation === false), 'unapproved, no final_submit');
  pass('D41.3', 'ranking unchanged: labelled opener link ranks above a popup-semantics control with a generic label');

  const a1 = pick.identifyActionTarget(doc.getElementById('openAnchor'), doc);
  assert(a1.ok === true && a1.locator === '#openAnchor' && a1.tagName === 'a', `pick anchor → hidden modal: ${JSON.stringify(a1)}`);
  const a2 = pick.identifyActionTarget(doc.querySelector('a.content-jump'), doc);
  assert(a2.ok === true && a2.locator === 'a.content-jump', `pick anchor → visible content: ${JSON.stringify(a2)}`);
  assert(LD.assertLocatorDeterministic(a1.locator, doc.getElementById('openAnchor'), doc) && LD.assertLocatorDeterministic(a2.locator, doc.querySelector('a.content-jump'), doc), 'exact-one + identity');
  pass('D41.4', 'manual pick accepts both anchor shapes; id locator wins; exact-one + identity');

  const inner = pick.identifyActionTarget(doc.getElementById('promo-inner'), doc);
  assert(inner.ok === true && inner.locator === '#promo-inner' && inner.tagName === 'span', 'non-actionable element with its own id → itself');
  const banner = pick.identifyActionTarget(doc.getElementById('promo-banner'), doc);
  assert(banner.ok === true && banner.locator === '#promo-banner' && banner.tagName === 'div', 'non-actionable visible element accepted');
  const text = pick.identifyActionTarget(doc.getElementById('promo-banner').firstChild, doc);
  assert(text.ok === true && text.locator === '#promo-banner', 'text node → parent element');
  const viaAncestor = pick.identifyActionTarget(doc.getElementById('real-btn'), doc);
  assert(viaAncestor.ok === true && viaAncestor.locator === '#real-btn', 'actionable element itself');
  pass('D41.5', 'manual pick of a non-actionable visible element with a deterministic locator is accepted');

  const bare = pick.identifyActionTarget(doc.querySelector('p'), doc);
  assert(bare.ok === false && bare.reason === 'no_locator_candidates', `no locator: ${JSON.stringify(bare)}`);
  const dup = pick.identifyActionTarget(doc.querySelector('span.dup'), doc);
  assert(dup.ok === false && dup.reason === 'no_exact_one_locator', `not exact-one: ${JSON.stringify(dup)}`);
  assert(pick.identifyActionTarget(doc.body, doc).reason === 'unsupported_target', 'page background is not a choice');
  const hub = await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub41');
  const types = await loadModule('src/assistedMapping/types.ts', 'types41');
  for (const r of [bare, dup]) {
    const m = hub.interpretCurrentTabVisualResponse(r, 'action:floating_opener', 'action');
    assert(m.ok === false && m.message === types.VISUAL_ACTION_UNSUPPORTED_TARGET_HE, `«לא ניתן לזהות…» for ${r.reason}`);
  }
  pass('D41.6', 'no deterministic locator → «לא ניתן לזהות את הכפתור שנבחר…»');

  const armed = await (() => {
    const p = w.armVisualTargetPick({ expectedOrigin: 'https://fixture.example.test', fieldId: 'action:floating_opener', mode: 'pick', pickTarget: 'action', timeoutMs: 1000 });
    doc.getElementById('openAnchor').dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
    return p;
  })();
  assert(armed.ok === true && armed.locator === '#openAnchor' && armed.state === 'IDENTIFIED_ACTION', `armed pick: ${JSON.stringify(armed)}`);
  const fieldPick = await (() => {
    const p = w.armVisualTargetPick({ expectedOrigin: 'https://fixture.example.test', fieldId: 'username', mode: 'pick', timeoutMs: 1000 });
    doc.getElementById('promo-banner').dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
    return p;
  })();
  assert(fieldPick.ok === false && fieldPick.reason === 'unsupported_target', 'field pick unchanged (non-field rejected)');
  pass('D41.7', 'armed action pick resolves the anchor; field pick unchanged');

  const pickFn = extractFunction(pickSrc, 'identifyActionTarget');
  assert(!/isSkipLink|skip_link_target/.test(pickSrc), 'no skip-link rejection in the pick');
  assert(pickFn.includes('var el = actionable || clicked;'), 'nearest actionable ancestor, else the clicked element');
  assert(!/skip_link_target|קישור דילוג/.test(hubSrc + typesSrc + read('src/assistedMapping/index.ts')), 'skip-link reason / message removed from the Hub');
  assert(inspectSrc.includes('shared.isSkipLink(el)) continue;'), 'Analyze still applies the skip-link filter');
  pass('D41.8', 'skip-link rule lives in Analyze only; Hub skip-link message removed');
}

// ─── Binding constraints ────────────────────────────────────────────────────
console.log('\nBinding constraints');
{
  assert(!/webNavigation|"debugger"/.test(manifestSrc), 'manifest: no webNavigation / debugger');
  const newCode = [
    extractFunction(detSrc, 'actionLocatorCandidates'),
    extractFunction(detSrc, 'isSkipLink'),
    extractFunction(detSrc, 'isVisibleInPageContent'),
    extractFunction(pickSrc, 'identifyActionTarget'),
    extractFunction(bgSrc, 'specialGestureWatchInstall'),
    extractFunction(bgSrc, 'specialGestureWatchCollect'),
    extractFunction(bgSrc, 'specialGestureWatchRun'),
    extractFunction(inspectSrc, 'collectSpecialAuthoringActionCandidates'),
  ].join('\n');
  assert(!/webNavigation|chrome\.debugger|getFrameId/.test(newCode), 'no webNavigation / debugger / getFrameId');
  assert(!/hostname|serviceId|\.co\.il|\.com\b|bank|fixture/i.test(newCode), 'no site / hostname / serviceId branches');
  assert(routingSrc.includes('popupSemantics?: boolean;'), 'routing observation field');
  pass('B.1', 'no manifest / permission change; no webNavigation / debugger / getFrameId; no site branches');
}

console.log(`\nD-121-35 verify: ${passCount} checks PASS`);
