/**
 * Phase 121.1 D-121-34 (arch-phase121.md §4.15) — test-then-choose + the tested button
 * is never replaced.
 * Evidence: «זה הכפתור הנכון» removed; the test press sets the continuation flag before
 * the click; R3 success → both flags + «מצב: נבדק ונבחר — המסך נפתח»; failure → both
 * cleared + «מצב: לא נבחר — המסך לא נפתח»; after_continue keeps the tested action and
 * proposes only from the revealed surface, pattern-relevant kinds, never same kind on
 * the same surface, into «נמצא כפתור נוסף»; manual Analyze unchanged; legacy states;
 * Ext click gate unchanged; old-string sweep.
 * Usage: node scripts/verifyPhase121TestThenChoose.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';
import { revertPhase126PartAManifest } from './lib/phase126PartA.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const assertIncludes = (hay, needle, message) => assert(hay.includes(needle), message);
const assertNotIncludes = (hay, needle, message) => assert(!hay.includes(needle), message);

const loadModule = (entry, name) => withTempDir(`pv-121ttc-${name}-`, (outdir) => loadModuleIn(outdir, entry, name));
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
function fnBody(src, signature) {
  const at = src.indexOf(signature);
  assert(at >= 0, `found ${signature}`);
  const next = src.slice(at + signature.length).search(/\n  (async )?function |\n  const |\n  return \(/);
  return src.slice(at, next < 0 ? undefined : at + signature.length + next);
}

console.log('Phase 121.1 D-121-34 — test-then-choose verification\n');

const bar = await loadModule('src/admin/specialActionBar.ts', 'bar');
const C = await loadModule('src/loginContract/index.ts', 'contract');
const F = await loadModule('src/assistedMapping/followUpSelection.ts', 'followup');
const uiSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const barSrc = read('src/admin/specialActionBar.ts');
const followSrc = read('src/assistedMapping/followUpSelection.ts');
const hubSrc = read('src/assistedMapping/currentTabAuthoring.ts');
const bgSrc = read('extension/background.js');
const P = bar.SPECIAL_BUTTON_PANEL_HE;

const FRAME = { frameLocator: '#iframeLogIn', frameOrigin: 'https://bank.example' };
const mk = (actionId, kind, locator, frame = null) =>
  C.createActionCandidate({ actionId, kind, label: locator, locator, frame });

// ─── 1. Labels, removed button, exact-label rule, old-string sweep ───────────
{
  assert(P.testOpen === 'בדוק את הכפתור וזהה את השדות' && P.reject === 'זה לא הכפתור', 'panel buttons exact');
  assert(P.statusTestedChosen === 'מצב: נבדק ונבחר — המסך נפתח', 'success status exact');
  assert(P.statusNotChosen === 'מצב: לא נבחר — המסך לא נפתח', 'failure status exact');
  assert(P.followUpTitle === 'נמצא כפתור נוסף' && P.title === 'נמצא כפתור באתר', 'panel titles exact');
  assert(!('approve' in P) && !('approved' in P), '«זה הכפתור הנכון» / «הכפתור נבחר» labels removed');

  const panel = fnBody(uiSrc, 'function renderActionPanel');
  const buttons = panel.split('<button').slice(1);
  // D-121-67 E: the opener panel adds «מיפוי חזותי» (renderRemapButton) after the two buttons.
  assert(buttons.length === 2, 'panel has exactly two test / reject buttons');
  assertIncludes(buttons[0], '{SPECIAL_BUTTON_PANEL_HE.testOpen}', 'first button «בדוק…»');
  assertIncludes(buttons[1], '{SPECIAL_BUTTON_PANEL_HE.reject}', 'second button «זה לא הכפתור»');
  assertIncludes(buttons[1], "{action.kind === 'floating_opener' ? renderRemapButton('opener') : null}", 'opener panel: «מיפוי חזותי» after «זה לא הכפתור»');
  assertIncludes(uiSrc, "{pendingAction && proposalShown(pendingAction) ? renderActionPanel('primary', pendingAction) : null}", 'primary panel (D-121-67 B: on its step)');
  assertIncludes(uiSrc, "{followUpAction && proposalShown(followUpAction) ? renderActionPanel('followUp', followUpAction) : null}", 'separate follow-up panel, same buttons (D-121-67 B: on its step)');
  assertIncludes(panel, "slot === 'primary' ? SPECIAL_BUTTON_PANEL_HE.title : SPECIAL_BUTTON_PANEL_HE.followUpTitle", 'follow-up panel titled «נמצא כפתור נוסף»');
  assertNotIncludes(uiSrc, 'approve-authoring-continuation', 'approval button removed');

  const copyBlock = uiSrc.slice(uiSrc.indexOf('export const SPECIAL_EDITOR_COPY_HE'), uiSrc.indexOf('export const SPECIAL_FRAME_BUTTON_HE'));
  const copyLine = (key) => {
    const m = copyBlock.match(new RegExp(`\\n  ${key}:\\s*'([^']+)'`));
    return m ? m[1] : null;
  };
  for (const key of ['actionFound', 'continueNeedsApproval', 'fieldsIdentifiedWithAction', 'visualActionFound', 'autoAnalyzeSuccessWithAction', 'actionAlreadyApproved']) {
    const line = copyLine(key);
    assert(line, `copy ${key} present`);
    assertIncludes(line, `«${P.testOpen}»`, `${key} points to «${P.testOpen}»`);
  }
  assert(copyLine('buttonSelected') === null, 'approval success message removed');
  const labels = new Set([...Object.values(P), 'אשר מסגרת', 'שמור מיפוי', 'אשר מיפוי', 'ביטול', 'מיפוי חזותי', 'קבל מיפוי', 'סמנו בעצמכם את כפתור פתיחת המסך הצף', 'סמנו בעצמכם את כפתור המעבר בין השלבים']);
  for (const q of [...copyBlock.matchAll(/«([^«»]+)»/g)].map((m) => m[1])) {
    assert(labels.has(q), `quoted «${q}» is a current button label`);
  }

  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name)) files.push(rel);
    }
  };
  walk('src');
  for (const rel of files) {
    const src = read(rel);
    for (const old of ['זה הכפתור הנכון', 'הכפתור נבחר ונשמר בטיוטה']) {
      assertNotIncludes(src, old, `${rel}: old string removed: ${old}`);
    }
  }
}
console.log('  ✓ 1. two panel buttons, «זה הכפתור הנכון» removed, exact status / titles, exact-label rule, old-string sweep');

// ─── 2. Flag transitions (real helpers + unchanged contract gate) ─────────────
{
  const fresh = mk('p1', 'floating_opener', '#logInBtn');
  assert(!fresh.approvedForAuthoringContinuation && !fresh.approvedForRuntime, 'proposal starts unapproved');
  assert(C.canPerformAuthoringClick(fresh) === false, 'unchanged gate: a proposal cannot be clicked');
  const consented = bar.actionForTestPress(fresh);
  assert(consented.approvedForAuthoringContinuation === true && consented.approvedForRuntime === false, 'test press sets the continuation flag only');
  assert(C.canPerformAuthoringClick(consented) === true, 'after the press the unchanged gate allows this one click');
  assert(fresh.approvedForAuthoringContinuation === false, 'helpers are pure');

  const chosen = bar.actionAfterTestSuccess(consented);
  assert(chosen.approvedForAuthoringContinuation === true && chosen.approvedForRuntime === true, 'R3 success → both flags');
  assert(bar.actionStatusHe(chosen, 'opened') === P.statusTestedChosen, `success → «${P.statusTestedChosen}»`);
  assert(bar.actionSelected(chosen) === true, 'success → chosen');

  const cleared = bar.actionAfterTestFailure(consented);
  assert(cleared.approvedForAuthoringContinuation === false && cleared.approvedForRuntime === false, 'R3 failure → both flags cleared');
  assert(bar.actionStatusHe(cleared, 'not_opened') === P.statusNotChosen, `failure → «${P.statusNotChosen}»`);
  assert(C.canPerformAuthoringClick(cleared) === false, 'failure → not clickable until pressed again');

  // Legacy: both flags → «מצב: נבחר»; re-test failure clears both. One flag → not chosen.
  const legacyBoth = { ...fresh, approvedForAuthoringContinuation: true, approvedForRuntime: true };
  assert(bar.actionStatusHe(legacyBoth, undefined) === P.statusSelected, `legacy both flags → «${P.statusSelected}»`);
  const retestFail = bar.actionAfterTestFailure(bar.actionForTestPress(legacyBoth));
  assert(!retestFail.approvedForAuthoringContinuation && !retestFail.approvedForRuntime, 'legacy re-test failure clears both flags');
  for (const one of [{ ...fresh, approvedForAuthoringContinuation: true }, { ...fresh, approvedForRuntime: true }]) {
    assert(bar.actionSelected(one) === false && bar.actionStatusHe(one, undefined) === P.statusWaiting, 'legacy single flag → not chosen');
  }
  // Validator unchanged: a stored runtime-approved action is what completes the draft.
  const draft = {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [{ ...chosen, readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 } }],
    steps: [{ stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }, { fieldId: 'password', locatorType: 'css', locator: '#pass' }] }],
  };
  assert(bar.checkSpecialDraft(draft).complete === true, 'tested + chosen action → draft complete');
  assert(bar.checkSpecialDraft({ ...draft, preambleActions: [{ ...draft.preambleActions[0], ...cleared }] }).complete === false, 'failed test → draft incomplete (validator unchanged)');

  // R2 / reserved kinds still respected by the test gate.
  const framed = bar.actionForTestPress(mk('p2', 'floating_opener', '#open', FRAME));
  assert(C.canPerformAuthoringClick(framed, new Set(), 'https://site.example') === false, 'framed action: unapproved origin blocks the test');
  assert(C.canPerformAuthoringClick(framed, new Set([FRAME.frameOrigin]), 'https://site.example') === true, 'framed action: approved origin allows the test');
  assert(C.canPerformAuthoringClick({ ...consented, kind: 'final_submit' }) === false, 'final_submit stays reserved');
}
console.log('  ✓ 2. test press = continuation flag; success → both + «נבדק ונבחר»; failure → both cleared + «לא נבחר»; legacy; R2 / final_submit');

// ─── 3. Editor order: consent written before the click; outcomes ─────────────
{
  const fn = fnBody(uiSrc, 'async function testAndChooseAction');
  const iPress = fn.indexOf('const consented = actionForTestPress(draftCopy(draft, shown));');
  const iWrite = fn.indexOf('const consentDraft = writeDraftAction(draft, consented);');
  const iCopy = fn.indexOf('const action = draftCopy(consentDraft, consented);');
  const iSet = fn.indexOf('setDraft(consentDraft);');
  const iClick = fn.indexOf('performApprovedAuthoringClick({');
  assert(iPress > 0 && iPress < iWrite && iWrite < iCopy && iCopy < iSet && iSet < iClick, 'continuation flag set and written to the draft before the click');
  assertIncludes(fn.slice(iClick, iClick + 80), 'action,', 'click receives the consented draft copy');
  const iFail = fn.indexOf('if (!result.ok) {');
  const failBranch = fn.slice(iFail, fn.indexOf('return;', iFail));
  // D-121-35 (G4): a not-proven test (user gesture) clears the outcome instead of «המסך לא נפתח».
  for (const needle of ['writeDraftAction(consentDraft, actionAfterTestFailure(action))', 'setTestOutcome(action.actionId, notProven ? null : testFailureOutcome(result.reason))', 'setError(result.message)']) {
    assertIncludes(failBranch, needle, `failure branch: ${needle}`);
  }
  assertNotIncludes(failBranch, 'runSpecialAnalyze', 'failure → no auto-Analyze');
  const success = fn.slice(fn.indexOf('return;', iFail));
  const iChosen = success.indexOf('writeDraftAction(consentDraft, actionAfterTestSuccess(action))');
  const iOpened = success.indexOf("setTestOutcome(action.actionId, 'opened')");
  const iAuto = success.indexOf("runSpecialAnalyze('after_continue', { base: chosenDraft, tested: chosen, slot");
  assert(iChosen > 0 && iOpened > iChosen && iAuto > iOpened, 'success: both flags + outcome before auto-Analyze on the new draft');
  assert(success.indexOf('setAnalyzing(true)') < iAuto, 'D-121-31 busy indicator kept for auto-Analyze');
  assertIncludes(fn, 'if (!canUseCurrentSurface || !canPerformAuthoringClick(consented, approvedFrameOrigins, allowedOrigin)) {', 'handler guard = button gate');

  const testBtn = fnBody(uiSrc, 'function renderActionPanel').split('<button')[1];
  assertIncludes(testBtn, 'busy ||', 'test button respects busy');
  assertIncludes(testBtn, '!canUseCurrentSurface ||', 'test button respects canUseCurrentSurface');
  assertIncludes(testBtn, '!canPerformAuthoringClick(actionForTestPress(action), approvedFrameOrigins, allowedOrigin)', 'test button respects R2 frame approval');
  assertNotIncludes(testBtn, 'actionSelected', 'test button enabled without prior approval');
  assertIncludes(fnBody(uiSrc, 'function renderActionPanel'), '{actionStatusHe(action, testOutcomes[action.actionId], pendingInDraft(action))}', 'status line per action');

  // Ext click gate unchanged: Hub still requires the flag and sends it; Ext still rejects without it.
  assertIncludes(hubSrc, 'if (!canPerformAuthoringClick(input.action, input.approvedFrameOrigins ?? new Set(), allowedOrigin)) {', 'Hub click gate unchanged');
  assertIncludes(hubSrc, 'approvedForAuthoringContinuation: true,\n    readinessMode,', 'click message still carries the continuation flag');
  assertIncludes(bgSrc, "if (!message || message.approvedForAuthoringContinuation !== true) {\n    sendResponse({ ok: false, reason: 'unapproved_authoring_click' });", 'Ext click gate unchanged');
}
console.log('  ✓ 3. editor: consent → draft → click; success / failure outcomes; enabled without approval; Ext gate unchanged');

// ─── 4. after_continue selection: no replacement, revealed surface, kinds ─────
{
  const base = C.ensureSpecialDraft('FLOATING_SCREEN', null);
  const tested = bar.actionAfterTestSuccess(mk('act-1', 'floating_opener', '#logInBtn'));
  const withTested = C.upsertPreambleAction(base, tested);
  const snapshot = JSON.stringify(withTested);
  // Fields revealed inside the login iframe; an unrelated top-document opener candidate exists.
  const revealed = F.revealedSurfaceKeys({
    fieldProposals: [
      { fieldId: 'username', locator: '#input_user', frame: FRAME, state: 'ready' },
      { fieldId: 'password', locator: '#input_pass', frame: FRAME, state: 'ready' },
    ],
    stepMappings: [],
  });
  assert(revealed.size === 1 && revealed.has(C.frameKey(FRAME)), 'revealed surface = the frame where the new fields were found');
  const extraTopOpener = mk('o2', 'floating_opener', 'div[aria-label="IPB Center TLV"]');
  const candidates = [extraTopOpener, mk('o1', 'floating_opener', '#logInBtn'), mk('t1', 'intermediate_transition', '#next', FRAME)];
  for (const pattern of ['FLOATING_SCREEN', 'FLOATING_SCREEN_MULTI_STEP', 'MULTI_STEP']) {
    const pick = F.selectFollowUpAfterContinue({ draft: withTested, pattern, candidates: [extraTopOpener], tested, revealedSurfaceKeys: revealed });
    assert(pick === null, `${pattern}: extra top-document opener is never proposed after the test`);
  }
  // Same kind on the same surface is excluded even if the surface counts as revealed.
  const topRevealed = new Set([C.frameKey(null)]);
  assert(
    F.selectFollowUpAfterContinue({ draft: withTested, pattern: 'FLOATING_SCREEN_MULTI_STEP', candidates: [extraTopOpener], tested, revealedSurfaceKeys: topRevealed }) === null,
    'same kind + same surface as the tested action → no proposal',
  );
  const testedTransition = bar.actionAfterTestSuccess(mk('t0', 'intermediate_transition', '#next1'));
  assert(
    F.selectFollowUpAfterContinue({ draft: base, pattern: 'MULTI_STEP', candidates: [mk('t9', 'intermediate_transition', '#next2')], tested: testedTransition, revealedSurfaceKeys: topRevealed }) === null,
    'MULTI_STEP: another transition on the tested transition\'s surface → no proposal (manual Analyze for further steps)',
  );
  // FLOATING_SCREEN: no follow-up panel at all (nothing needed after the opener).
  assert(F.followUpKindsForPattern('FLOATING_SCREEN').length === 0, 'FLOATING_SCREEN needs no follow-up kind');
  assert(
    F.selectFollowUpAfterContinue({ draft: withTested, pattern: 'FLOATING_SCREEN', candidates, tested, revealedSurfaceKeys: revealed }) === null,
    'FLOATING_SCREEN: no follow-up even with a transition on the revealed surface',
  );
  // FLOATING_SCREEN_MULTI_STEP: transition inside the revealed frame → follow-up.
  const fsms = F.selectFollowUpAfterContinue({ draft: withTested, pattern: 'FLOATING_SCREEN_MULTI_STEP', candidates, tested, revealedSurfaceKeys: revealed });
  assert(fsms && fsms.locator === '#next' && C.frameKey(fsms.frame) === C.frameKey(FRAME), 'FLOATING_SCREEN_MULTI_STEP: transition from the revealed frame proposed');
  assert(!fsms.approvedForAuthoringContinuation && !fsms.approvedForRuntime, 'follow-up is an unapproved proposal');
  assert(JSON.stringify(withTested) === snapshot, 'selection does not modify the draft (§5.2)');
  // A transition on a non-revealed surface is never proposed.
  assert(
    F.selectFollowUpAfterContinue({ draft: withTested, pattern: 'FLOATING_SCREEN_MULTI_STEP', candidates: [mk('t2', 'intermediate_transition', '#topNext')], tested, revealedSurfaceKeys: revealed }) === null,
    'transition outside the revealed surface → no proposal',
  );
  // MULTI_STEP fixture: opener-kind link tested on top; step 1 revealed on top; transition proposed.
  const msBase = C.ensureSpecialDraft('MULTI_STEP', null);
  const msTested = bar.actionAfterTestSuccess(mk('m1', 'floating_opener', '#loginLink'));
  // D-121-46 A1: an opener is never written into a MULTI_STEP draft; the selection check
  // below still gets a raw draft holding the tested id (id-collision logic only).
  assert(!(C.upsertPreambleAction(msBase, msTested).preambleActions ?? []).length, 'D-121-46 A1: opener not written into MULTI_STEP');
  const msDraft = { ...msBase, preambleActions: [msTested] };
  const msRevealed = F.revealedSurfaceKeys({ fieldProposals: [{ fieldId: 'username', locator: '#user', frame: null, state: 'ready' }], stepMappings: [] });
  const ms = F.selectFollowUpAfterContinue({
    draft: msDraft,
    pattern: 'MULTI_STEP',
    candidates: [mk('x1', 'floating_opener', '#promo'), mk('m1', 'intermediate_transition', '#idNext')],
    tested: msTested,
    revealedSurfaceKeys: msRevealed,
  });
  assert(ms && ms.locator === '#idNext' && ms.kind === 'intermediate_transition', 'MULTI_STEP: transition from the revealed surface proposed');
  assert(ms.actionId !== 'm1', 'actionId collision with the tested action re-ided (tested action never overwritten)');
  // Already-approved draft actions and the tested action itself are skipped.
  const approvedNext = C.approveActionForAuthoringContinuation(mk('m2', 'intermediate_transition', '#idNext'));
  assert(
    F.selectFollowUpAfterContinue({ draft: C.upsertPreambleAction(msDraft, approvedNext), pattern: 'MULTI_STEP', candidates: [mk('z', 'intermediate_transition', '#idNext')], tested: msTested, revealedSurfaceKeys: msRevealed }) === null,
    'already-approved draft action not re-proposed',
  );
  // Revealed-surface fallback: every field already mapped → the step's mapping surfaces.
  const fallback = F.revealedSurfaceKeys({
    fieldProposals: [],
    stepMappings: [{ fieldId: 'username', locator: '#input_user', frame: FRAME }, { fieldId: 'password', locator: '', frame: null }],
  });
  assert(fallback.size === 1 && fallback.has(C.frameKey(FRAME)), 'fallback: surfaces of mapped fields only');
  assert(F.revealedSurfaceKeys({ fieldProposals: [{ frame: null, state: 'frame_not_addressable' }], stepMappings: [] }).size === 0, 'unaddressable fields never define a surface');
  assert(
    F.selectFollowUpAfterContinue({ draft: withTested, pattern: 'FLOATING_SCREEN_MULTI_STEP', candidates, tested, revealedSurfaceKeys: new Set() }) === null,
    'no revealed surface → no proposal (fail-closed)',
  );
}
console.log('  ✓ 4. after_continue: extra top opener never proposed; same kind / same surface excluded; revealed surface only; FLOATING_SCREEN none; MULTI_STEP / FS+MS transition');

// ─── 5. Editor wiring: tested action stays, follow-up panel, manual unchanged ──
{
  const run = fnBody(uiSrc, 'async function runSpecialAnalyze');
  const iManual = run.indexOf('if (!afterTest) {');
  const iAfter = run.indexOf('} else {', iManual);
  const iEnd = run.indexOf('const actionToTest', iAfter);
  assert(iManual > 0 && iAfter > iManual && iEnd > iAfter, 'manual / after_continue branches present');
  const manualBranch = run.slice(iManual, iAfter);
  const afterBranch = run.slice(iAfter, iEnd);
  assertIncludes(manualBranch, 'selected = selectPendingForManualAnalyze(current, proposedActions);', 'manual Analyze: D-121-26 top proposal');
  assertIncludes(manualBranch, 'setPendingAction(selected);', 'manual Analyze: shown in the primary panel');
  assertNotIncludes(afterBranch, 'setPendingAction', 'after_continue never replaces the tested action');
  assertIncludes(afterBranch, 'selectFollowUpAfterContinue({', 'after_continue: follow-up rule');
  assertIncludes(afterBranch, 'tested: afterTest.tested,', 'follow-up rule receives the tested action');
  assertIncludes(afterBranch, 'fieldProposals: framed,', 'revealed surface from this Analyze\'s field proposals');
  assertIncludes(afterBranch, 'if (selected) setFollowUpAction(selected);', 'follow-up goes to «נמצא כפתור נוסף»');
  assertIncludes(afterBranch, "afterTest.slot === 'followUp' ||", 'a tested follow-up is never replaced either');
  assertIncludes(afterBranch, "testOutcomes[followUpAction.actionId] === 'opened'", 'a chosen follow-up is never replaced');
  assert(run.indexOf('const current = afterTest?.base ?? draft;') > 0, 'after_continue works on the draft written by the test press');
  // Manual rule itself unchanged: top proposal even when already in the draft, with its flags.
  const d = C.upsertPreambleAction(C.ensureSpecialDraft('FLOATING_SCREEN', null), bar.actionAfterTestSuccess(mk('act-1', 'floating_opener', '#logInBtn')));
  const top = C.selectPendingForManualAnalyze(d, [mk('act-7', 'floating_opener', '#logInBtn')]);
  assert(top.actionId === 'act-1' && bar.actionStatusHe(top, undefined) === P.statusSelected, 'manual: draft action shown with its status');

  // §5.2: only the test press writes an action; Analyze never does; reject removes.
  for (const needle of ['writeDraftAction', 'upsertPreambleAction', 'actionForTestPress', 'actionAfterTestSuccess']) {
    assertNotIncludes(run, needle, `Analyze does not write / approve (${needle})`);
  }
  const visual = fnBody(uiSrc, 'async function visualPickAction');
  assertNotIncludes(visual, 'setDraft', 'Visual action pick does not write the draft');
  const reject = fnBody(uiSrc, 'function rejectAction');
  assertIncludes(reject, 'setDraft(removeDraftAction(draft, shown));', '«זה לא הכפתור» removes it from the draft');
  assertIncludes(reject, "if (!(stepSelector && shown.kind === 'intermediate_transition')) {", 'D-121-67 A: a multi-step proposal never removes another step\'s exit');
  assertIncludes(reject, "setTestOutcome(shown.actionId, null);", '«זה לא הכפתור» clears the status');
}
console.log('  ✓ 5. editor: tested action stays; follow-up in its own panel; manual Analyze unchanged; §5.2');

// ─── 6. Scope ───────────────────────────────────────────────────────────────
{
  for (const src of [followSrc, fnBody(barSrc, 'export type ActionTestOutcome')]) {
    for (const needle of ['hostname', 'serviceId', 'mizrahi', '.co.il', 'final_submit']) {
      assertNotIncludes(src.toLowerCase(), needle, `no site branch / reserved kind in selection: ${needle}`);
    }
  }
  assertNotIncludes(uiSrc.toLowerCase(), 'mizrahi', 'editor site-agnostic');
  // Phase 126 Part A (G-3): the manifest may differ only by the Part A lines (was: git diff empty).
  const manifestHead = execSync('git show HEAD:extension/manifest.json', { cwd: root }).toString().replace(/\r\n/g, '\n');
  assert(revertPhase126PartAManifest(readFileSync(join(root, 'extension/manifest.json'), 'utf8')) === manifestHead, 'manifest unchanged');
}
console.log('  ✓ 6. no site / hostname / serviceId branches; final_submit untouched; manifest unchanged');

console.log('\nPASS — Phase 121.1 D-121-34 test-then-choose (§4.15)');
