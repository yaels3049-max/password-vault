/**
 * Phase 121.1 — SPECIAL DRAFT authoring + progressive approval.
 * Evidence: AC-121.1-1 … AC-121.1-12
 * Usage: node scripts/verifyPhase121SpecialDraftAuthoring.mjs
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertIncludes(hay, needle, message) {
  assert(hay.includes(needle), message);
}

function assertNotIncludes(hay, needle, message) {
  assert(!hay.includes(needle), message);
}

async function loadModule(entry, name) {
  const outfile = join(mkdtempSync(join(tmpdir(), `pv-1211-${name}-`)), `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 121.1 — SPECIAL DRAFT authoring verification\n');

const authoring = await loadModule('src/loginContract/specialDraftAuthoring.ts', 'authoring');
const contract = await loadModule('src/loginContract/index.ts', 'contract');
const currentTabSrc = read('src/assistedMapping/currentTabAuthoring.ts');
const specialUiSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const autofillEditorSrc = read('src/admin/AutofillProfileEditor.tsx');
const bgSrc = read('extension/background.js');
const analyzeSrc = read('src/assistedMapping/analyzeLoginPage.ts');
const visualSrc = read('src/assistedMapping/visualMapping.ts');
// 121.1-IF: open/reuse + live top-origin check (R1) live in one shared SPECIAL gate
// that runs before any frame logic; handler slices are checked together with it.
const specialGateSrc = bgSrc.slice(
  bgSrc.indexOf('function specialAuthoringTabGate'),
  bgSrc.indexOf('function collectSpecialRevealSnapshot'),
);
function viaGate(fn) {
  return fn.includes('specialAuthoringTabGate(') ? `${specialGateSrc}\n${fn}` : fn;
}

// AC-121.1-1 patterns
for (const p of ['FLOATING_SCREEN', 'MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP']) {
  assert(authoring.isSpecialLoginPattern(p), `pattern ${p}`);
  const draft = authoring.ensureSpecialDraft(p, null);
  assert(draft.pattern === p, `draft pattern ${p}`);
  assert(Array.isArray(draft.steps) && draft.steps.length >= 1, `draft steps ${p}`);
}
// D-121-45: the pattern selector moved to the cross-cutting «אופי הכניסה» grid.
const patternGridSrc = read('src/admin/LoginPatternGrid.tsx');
assertIncludes(patternGridSrc, 'LOGIN_PATTERN_LABEL_HE', 'AC-121.1-1 pattern labels');
assertIncludes(read('src/admin/mappingCopy.ts'), "loginPatternTitle: 'אופי הכניסה'", 'AC-121.1-1 pattern selector');
assertIncludes(patternGridSrc, 'data-action="login-pattern"', 'AC-121.1-1 pattern control');
assertIncludes(
  read('src/loginContract/specialDraftAuthoring.ts'),
  'FLOATING_SCREEN_MULTI_STEP',
  'AC-121.1-1 all SPECIAL patterns in authoring module',
);
console.log('  ✓ AC-121.1-1 SPECIAL DRAFT patterns');

// AC-121.1-2 progressive approval — unapproved click blocked
const action = authoring.createActionCandidate({
  actionId: 'opener-1',
  kind: 'floating_opener',
  label: 'Open',
  locator: '#open',
});
assert(authoring.canPerformAuthoringClick(action) === false, 'unapproved blocked');
const approved = authoring.approveActionForAuthoringContinuation(action);
assert(authoring.canPerformAuthoringClick(approved) === true, 'approved allowed');
assertIncludes(currentTabSrc, 'canPerformAuthoringClick', 'Hub gates click');
assertIncludes(bgSrc, 'unapproved_authoring_click', 'Ext gates click');
// D-121-34: no separate approval button — the test press is the consent.
assertNotIncludes(specialUiSrc, 'approve-authoring-continuation', 'UI approval button removed (D-121-34)');
assertIncludes(specialUiSrc, 'authoring-continue-click', 'UI continue');
console.log('  ✓ AC-121.1-2 progressive approval gate');

// AC-121.1-3 / 4 existing-tab entry; no Login Entry reopen
assertIncludes(currentTabSrc, 'ADMIN_CURRENT_TAB_INSPECT', 'current-tab inspect');
assertIncludes(currentTabSrc, 'ADMIN_CURRENT_TAB_VISUAL_MAPPING_START', 'current-tab visual');
assertIncludes(currentTabSrc, 'reopenLoginEntry: false', 'Hub forbids reopen');
assertIncludes(bgSrc, 'ADMIN_CURRENT_TAB_INSPECT', 'Ext current inspect');
assertIncludes(bgSrc, 'reopen_login_entry_forbidden', 'Ext rejects reopen');
assertNotIncludes(currentTabSrc, 'ADMIN_LOGIN_PAGE_INSPECT_MESSAGE', 'does not use STANDARD inspect msg');
assertNotIncludes(currentTabSrc, 'ADMIN_VISUAL_MAPPING_START_MESSAGE', 'does not use STANDARD visual msg');
// STANDARD paths still open Login Entry (unchanged)
assertIncludes(analyzeSrc, 'ADMIN_LOGIN_PAGE_INSPECT_MESSAGE', 'STANDARD Analyze unchanged');
assertIncludes(visualSrc, 'ADMIN_VISUAL_MAPPING_START_MESSAGE', 'STANDARD Visual unchanged');
assertIncludes(bgSrc, 'openGenericRealSiteTab', 'STANDARD still opens tab');
assertIncludes(specialUiSrc, 'special-analyze-current-tab', 'SPECIAL uses current-tab analyze');
console.log('  ✓ AC-121.1-3/4 current-surface entry; STANDARD reopen paths untouched');

// AC-121.1-5 Visual never auto-fallback
assertIncludes(specialUiSrc, 'never auto-invoke Visual Mapping on Analyze fail', 'no auto Visual');
// On analyze fail: return without calling visual
const failBlock = specialUiSrc.slice(
  specialUiSrc.indexOf('async function runSpecialAnalyze'),
  specialUiSrc.indexOf('async function visualPickAction'),
);
assertIncludes(failBlock, 'if (!result.ok)', 'analyze fail branch');
assertNotIncludes(failBlock, 'startCurrentTabVisualMapping', 'Analyze fail does not call Visual');
console.log('  ✓ AC-121.1-5 Visual explicit-only');

// Architecture correction — SPECIAL Analyze routing proposes opener/transition
const routing = await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing');
const openerObs = [
  {
    actionCandidateId: 'act-1',
    tagName: 'button',
    label: 'כניסה לחשבון',
    locator: '#open-login',
    locatorType: 'css',
    matchCount: 1,
    visible: true,
  },
  {
    actionCandidateId: 'act-2',
    tagName: 'button',
    label: 'המשך',
    locator: '#next-step',
    locatorType: 'css',
    matchCount: 1,
    visible: true,
  },
];
const floatingProposals = routing.proposeSpecialActionCandidates({
  pattern: 'FLOATING_SCREEN',
  actionCandidates: openerObs,
});
assert(floatingProposals.length >= 1, 'SPECIAL Analyze proposes actions');
assert(
  floatingProposals.some((p) => p.kind === 'floating_opener'),
  'FLOATING_SCREEN proposes floating_opener',
);
assert(
  floatingProposals.every((p) => p.action.approvedForAuthoringContinuation === false),
  'proposed actions unapproved (progressive gate)',
);
assert(
  floatingProposals.every((p) => p.action.approvedForRuntime === false),
  'proposed actions not runtime-approved',
);
const multiProposals = routing.proposeSpecialActionCandidates({
  pattern: 'MULTI_STEP',
  actionCandidates: openerObs,
});
assert(
  multiProposals.some((p) => p.kind === 'intermediate_transition'),
  'MULTI_STEP proposes intermediate_transition',
);
assertIncludes(
  read('src/assistedMapping/currentTabAuthoring.ts'),
  'analyzeSpecialCurrentSurface',
  'unified SPECIAL current-surface Analyze',
);
assertIncludes(
  read('src/assistedMapping/currentTabAuthoring.ts'),
  'proposeSpecialActionCandidates',
  'Phase 121 routing wired',
);
assertIncludes(
  read('src/assistedMapping/currentTabAuthoring.ts'),
  'proposeFieldMappings',
  'Phase 120 field-Analyze retained separately',
);
assertIncludes(
  read('src/assistedMapping/specialAnalyzeRouting.ts'),
  'Do NOT claim Phase 120 field-Analyze understands openers',
  'explicit separation from Phase 120 field-Analyze',
);
assertIncludes(specialUiSrc, 'analyzeSpecialCurrentSurface', 'UI Analyze uses SPECIAL routing');
assertNotIncludes(
  failBlock,
  'startCurrentTabVisualMapping',
  'Analyze fail path still never auto-Visual',
);
assertIncludes(bgSrc, 'collectSpecialAuthoringActionCandidates', 'Ext collects action candidates');
assertIncludes(bgSrc, 'actionCandidates', 'Ext returns actionCandidates on current-tab inspect');
// STANDARD inspect must not be rewritten to require action candidates
const standardInspectSlice = bgSrc.slice(
  bgSrc.indexOf('function openPageAndInspectLoginStructure'),
  bgSrc.indexOf('function ensureSpecialAuthoringTab'),
);
assertNotIncludes(
  standardInspectSlice,
  'collectSpecialAuthoringActionCandidates',
  'STANDARD Login Entry inspect unchanged',
);
console.log('  ✓ SPECIAL Analyze opener/transition routing (Architecture correction)');

// §4.7 / D-121-20 — generic SPECIAL entry resolution (HOME vs DEDICATED)
const entryMod = await loadModule('src/loginContract/specialAuthoringEntry.ts', 'entry');
const home = entryMod.resolveSpecialAuthoringEntry({
  primaryUrl: 'https://bank.example.test/',
  loginUrl: null,
  metadata: { loginEntryType: 'primary_page' },
});
assert(home.ok === true, 'HOME ENTRY resolves');
assert(home.entryType === 'primary_page', 'HOME ENTRY type');
assert(home.authoringUrl === 'https://bank.example.test/', 'HOME → primary_url');
assert(home.allowedOrigin === 'https://bank.example.test', 'HOME origin from primary');

const homeEmptyLogin = entryMod.resolveSpecialAuthoringEntry({
  primaryUrl: 'https://bank.example.test/home',
  loginUrl: '',
  metadata: {},
});
assert(homeEmptyLogin.ok === true, 'empty login_url → HOME');
assert(homeEmptyLogin.entryType === 'primary_page', 'empty login → primary_page');
assert(
  homeEmptyLogin.authoringUrl === 'https://bank.example.test/home',
  'empty login uses primary_url',
);
assert(
  homeEmptyLogin.allowedOrigin === 'https://bank.example.test',
  'HOME origin from primary_url',
);

const dedicated = entryMod.resolveSpecialAuthoringEntry({
  primaryUrl: 'https://bank.example.test/',
  loginUrl: 'https://login.example.test/auth',
  metadata: { loginEntryType: 'direct_url' },
});
assert(dedicated.ok === true, 'DEDICATED ENTRY resolves');
assert(dedicated.entryType === 'direct_url', 'DEDICATED type');
assert(dedicated.authoringUrl === 'https://login.example.test/auth', 'DEDICATED → login_url');
assert(dedicated.allowedOrigin === 'https://login.example.test', 'DEDICATED origin from login_url');

const dedicatedMissing = entryMod.resolveSpecialAuthoringEntry({
  primaryUrl: 'https://bank.example.test/',
  loginUrl: null,
  metadata: { loginEntryType: 'direct_url' },
});
assert(dedicatedMissing.ok === false, 'DEDICATED without login_url fails closed');

const httpRejected = entryMod.resolveSpecialAuthoringEntry({
  primaryUrl: 'http://insecure.example.test/',
  loginUrl: null,
  metadata: { loginEntryType: 'primary_page' },
});
assert(httpRejected.ok === false, 'non-HTTPS origin fail-closed (not weakened)');

assertIncludes(specialUiSrc, 'resolveSpecialAuthoringEntry', 'UI uses §4.7 resolver');
assertIncludes(specialUiSrc, 'canUseCurrentSurface', 'Analyze/Visual gated on resolved entry');
assertNotIncludes(specialUiSrc.toLowerCase(), 'mizrahi', 'no Mizrahi site branch');
assertNotIncludes(specialUiSrc, 'serviceId ===', 'no serviceId branch');
assertNotIncludes(
  read('src/loginContract/specialAuthoringEntry.ts'),
  'hostname ===',
  'resolver has no hostname branch',
);
assertNotIncludes(
  read('src/loginContract/specialAuthoringEntry.ts'),
  'serviceId ===',
  'resolver has no serviceId branch',
);
assertNotIncludes(
  read('src/loginContract/specialAuthoringEntry.ts').toLowerCase(),
  'mizrahi',
  'resolver has no fixture-name branch',
);
console.log('  ✓ §4.7 SPECIAL entry resolution (HOME / DEDICATED)');

// §4.6 / D-121-21 — open OR reuse authoring tab (not Hub active tab)
assertIncludes(bgSrc, 'function ensureSpecialAuthoringTab', 'D-121-21 open/reuse helper');
assertIncludes(bgSrc, 'recently accessed already-open same-origin authoring tab', 'prefer reuse');
assertIncludes(bgSrc, 'chrome.tabs.create({ url: authoringUrl', 'opens resolved authoringUrl');
assertIncludes(bgSrc, 'reused: true', 'reuse same-origin tab');
assertIncludes(bgSrc, 'opened: true', 'open when no same-origin tab');
assertNotIncludes(bgSrc, 'function resolveCurrentAuthoringTabId', 'active-tab resolver removed');
// SPECIAL inspect/visual/click all route through ensureSpecialAuthoringTab
const specialInspectFn = viaGate(bgSrc.slice(
  bgSrc.indexOf('function inspectCurrentAuthoringTab'),
  bgSrc.indexOf('function visualMappingCurrentAuthoringTab'),
));
assertIncludes(specialInspectFn, 'ensureSpecialAuthoringTab', 'inspect uses open/reuse');
assertNotIncludes(
  specialInspectFn,
  'active: true, lastFocusedWindow: true',
  'inspect does not use Hub/active tab',
);
const specialVisualFn = viaGate(bgSrc.slice(
  bgSrc.indexOf('function visualMappingCurrentAuthoringTab'),
  bgSrc.indexOf('function authoringClickApprovedAction'),
));
assertIncludes(specialVisualFn, 'ensureSpecialAuthoringTab', 'visual uses open/reuse');
assertNotIncludes(
  specialVisualFn,
  'active: true, lastFocusedWindow: true',
  'visual does not use Hub/active tab',
);
const specialClickFn = viaGate(bgSrc.slice(
  bgSrc.indexOf('function authoringClickApprovedAction'),
  bgSrc.indexOf('chrome.runtime.onMessageExternal.addListener'),
));
assertIncludes(specialClickFn, 'ensureSpecialAuthoringTab', 'click uses open/reuse');
assertIncludes(currentTabSrc, 'authoringUrl: input.loginEntryUrl.trim()', 'Hub passes §4.7 authoringUrl');
assertIncludes(
  currentTabSrc,
  'ADMIN_CURRENT_TAB_INSPECT_MESSAGE',
  'SPECIAL inspect message (not STANDARD)',
);
assertNotIncludes(currentTabSrc, 'ADMIN_LOGIN_PAGE_INSPECT_MESSAGE', 'no STANDARD Analyze entry');
assertNotIncludes(currentTabSrc, 'ADMIN_VISUAL_MAPPING_START_MESSAGE', 'no STANDARD Visual entry');
// Fail-closed origin still enforced after open/reuse
assertIncludes(specialInspectFn, "reason: 'origin_mismatch'", 'inspect origin fail-closed');
assertIncludes(specialVisualFn, "reason: 'origin_mismatch'", 'visual origin fail-closed');
assertIncludes(bgSrc, 'originOf(authoringUrl) !== allowedOrigin', 'open rejects URL/origin mismatch');
assertIncludes(bgSrc, 'reopen_login_entry_forbidden', 'no Login Entry reopen after SPECIAL');
const ensureFn = bgSrc.slice(
  bgSrc.indexOf('function ensureSpecialAuthoringTab'),
  bgSrc.indexOf('function rejectIfReopenLoginEntryRequested'),
);
assertNotIncludes(ensureFn, 'hostname ===', 'open/reuse has no hostname branch');
assertNotIncludes(ensureFn, 'serviceId', 'open/reuse has no serviceId branch');
assertNotIncludes(ensureFn.toLowerCase(), 'mizrahi', 'open/reuse has no fixture-name branch');
console.log('  ✓ §4.6 / D-121-21 open/reuse authoring tab (not Hub)');

// §5.1 / D-121-22 — auto-Analyze after successful approved continuation click
function sliceBetween(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `slice ${start} → ${end}`);
  return src.slice(a, b);
}
const runAnalyzeFn = sliceBetween(
  specialUiSrc,
  'async function runSpecialAnalyze',
  'async function analyzeCurrentSurface',
);
const manualAnalyzeFn = sliceBetween(
  specialUiSrc,
  'async function analyzeCurrentSurface',
  'async function visualPickAction',
);
const continueFn = sliceBetween(
  specialUiSrc,
  'async function testAndChooseAction',
  'function renderActionPanel',
);
assertIncludes(runAnalyzeFn, 'analyzeSpecialCurrentSurface(', 'auto/manual share SPECIAL Analyze');
assertIncludes(manualAnalyzeFn, "runSpecialAnalyze('manual')", 'manual Analyze uses shared routine');
// Auto-Analyze only after successful approved click
assertIncludes(
  continueFn,
  'canPerformAuthoringClick(consented, approvedFrameOrigins, allowedOrigin)',
  'continue gated on the test-press consent (+ R2 frame origin)',
);
const clickIdx = continueFn.indexOf('performApprovedAuthoringClick(');
const failIdx = continueFn.indexOf('if (!result.ok)');
const failReturnIdx = continueFn.indexOf('return;', failIdx);
const autoIdx = continueFn.indexOf("runSpecialAnalyze('after_continue'");
assert(clickIdx >= 0 && failIdx > clickIdx, 'click result checked');
assert(autoIdx > failReturnIdx, 'auto-Analyze runs only after failure branch returned');
const failBranch = continueFn.slice(failIdx, failReturnIdx);
assertNotIncludes(failBranch, 'runSpecialAnalyze', 'failed click → no auto-Analyze');
assert(
  continueFn.split('runSpecialAnalyze(').length === 2,
  'exactly one auto-Analyze call in continuation',
);
// Analyze performs no click / no approval / no Visual / no persist / no ACTIVATE
for (const [needle, why] of [
  ['performApprovedAuthoringClick', 'Analyze performs no click'],
  ['startCurrentTabVisualMapping', 'Analyze never auto-invokes Visual (incl. on fail)'],
  ['approveActionForAuthoringContinuation', 'Analyze never approves for continuation'],
  ['approveActionForRuntime', 'Analyze never approves for runtime'],
  ['updateGlobalRegistryRow', 'Analyze results stay draft-only (no persist)'],
  ['LOGIN_CONTRACT_ACTIVATE_INTENT_KEY', 'Analyze has no ACTIVATE side effect'],
]) {
  assertNotIncludes(runAnalyzeFn, needle, why);
}
assertNotIncludes(continueFn, 'startCurrentTabVisualMapping', 'continuation never auto-Visual');
assertNotIncludes(continueFn, 'updateGlobalRegistryRow', 'continuation does not auto-save');
assertIncludes(runAnalyzeFn, 'selectFollowUpAfterContinue(', 'after_continue candidates via follow-up selection (D-121-34)');
assertIncludes(runAnalyzeFn, 'setPendingAction(selected)', 'manual: selected candidate → pending action');
assertIncludes(runAnalyzeFn, 'setFollowUpAction(selected)', 'after_continue: selected candidate → follow-up panel');
// Required plain-Hebrew copy
assertIncludes(specialUiSrc, 'המסך נפתח. מנתח את שדות הכניסה…', 'auto-Analyze started copy');
assertIncludes(specialUiSrc, 'שדות הכניסה זוהו. בדקו ושמרו מיפוי.', 'auto-Analyze success copy (D-121-43 vocabulary)');
assertIncludes(
  specialUiSrc,
  'המסך נפתח, אך לא כל השדות זוהו. ניתן להשתמש במיפוי חזותי.',
  'auto-Analyze partial copy',
);

// pickNewActionCandidate: never overwrites approved action; always unapproved
{
  let d = authoring.ensureSpecialDraft('FLOATING_SCREEN', null);
  const opener = authoring.approveActionForAuthoringContinuation(
    authoring.createActionCandidate({
      actionId: 'act-1',
      kind: 'floating_opener',
      label: 'כניסה',
      locator: '#open',
    }),
  );
  d = authoring.upsertPreambleAction(d, opener);
  const sameLocator = authoring.createActionCandidate({
    actionId: 'act-9',
    kind: 'floating_opener',
    label: 'כניסה',
    locator: '#open',
  });
  assert(
    authoring.pickNewActionCandidate(d, [sameLocator]) === null,
    'already-known locator is not re-proposed',
  );
  const collidingId = {
    ...authoring.createActionCandidate({
      actionId: 'act-1',
      kind: 'intermediate_transition',
      label: 'המשך',
      locator: '#next',
    }),
    approvedForAuthoringContinuation: true,
    approvedForRuntime: true,
  };
  const picked = authoring.pickNewActionCandidate(d, [sameLocator, collidingId]);
  assert(picked && picked.locator === '#next', 'new locator picked');
  assert(picked.actionId !== 'act-1', 'actionId collision re-ided');
  assert(picked.approvedForAuthoringContinuation === false, 'picked is unapproved (continuation)');
  assert(picked.approvedForRuntime === false, 'picked is unapproved (runtime)');
  assert(authoring.canPerformAuthoringClick(picked) === false, 'picked cannot be clicked');
  const merged = authoring.upsertPreambleAction(d, picked);
  const keptOpener = merged.preambleActions.find((a) => a.actionId === 'act-1');
  assert(
    keptOpener && keptOpener.locator === '#open' && keptOpener.approvedForAuthoringContinuation,
    'approved opener preserved',
  );
}

// No internal jargon in Admin-facing SPECIAL copy
const copyBlock = sliceBetween(specialUiSrc, 'export const SPECIAL_EDITOR_COPY_HE', '} as const;');
const jsxBlock = specialUiSrc.slice(specialUiSrc.lastIndexOf('  return ('));
const patternLabels = read('src/loginContract/specialDraftAuthoring.ts');
const labelBlock = sliceBetween(patternLabels, 'LOGIN_PATTERN_LABEL_HE', '};');
for (const block of [copyBlock, jsxBlock, labelBlock]) {
  for (const jargon of ['Orchestrator', 'Phase 120', 'Phase 121', '121.1', 'routing', 'loginFlowPlan', 'Digital Home']) {
    assertNotIncludes(block, jargon, `no internal jargon "${jargon}" in Admin copy`);
  }
}
assertNotIncludes(specialUiSrc, 'לא Orchestrator', 'old continuation jargon removed');
// Site-agnostic
assertNotIncludes(specialUiSrc.toLowerCase(), 'mizrahi', 'no fixture-name branch');
assertNotIncludes(specialUiSrc, 'hostname', 'no hostname branch');
console.log('  ✓ §5.1 / D-121-22 auto-Analyze after approved continuation; plain Hebrew copy');

// D-121-23 — approval panel labels + exact-label rule (text-only)
// Label = text after the tag's final '>' (attributes may contain '=>').
function literalButtonLabel(buttonSrc) {
  const label = buttonSrc.slice(buttonSrc.lastIndexOf('>') + 1);
  return label.includes('{') ? null : label.replace(/\s+/g, ' ').trim();
}
function buttonSources(src) {
  return src
    .split('<button')
    .slice(1)
    .map((part) => part.slice(0, part.indexOf('</button>')));
}
function buttonLabelFor(src, dataAction) {
  const btn = buttonSources(src).find((b) => b.includes(`data-action="${dataAction}"`));
  assert(btn, `button ${dataAction} exists`);
  const label = literalButtonLabel(btn);
  assert(label, `button ${dataAction} has literal label`);
  return label;
}
// D-121-32 (§4.13): panel labels render SPECIAL_BUTTON_PANEL_HE (specialActionBar.ts); runtime
// approval button removed; status line «מצב: …» (verified in verifyPhase121ActionBar.mjs §8).
const panelSrcForLabels = read('src/admin/specialActionBar.ts');
const panelConst = Object.fromEntries(
  [
    ...sliceBetween(panelSrcForLabels, 'export const SPECIAL_BUTTON_PANEL_HE', '} as const;').matchAll(
      /(\w+): '([^']+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
const expectedPanelLabels = {
  'authoring-continue-click': ['testOpen', 'בדוק את הכפתור וזהה את השדות'],
  'reject-action': ['reject', 'זה לא הכפתור'],
};
for (const [action, [key, label]] of Object.entries(expectedPanelLabels)) {
  const btn = buttonSources(specialUiSrc).find((b) => b.includes(`data-action="${action}"`));
  assert(btn && btn.includes(`SPECIAL_BUTTON_PANEL_HE.${key}`) && panelConst[key] === label, `${action} label = ${label}`);
}
assertNotIncludes(specialUiSrc, 'data-action="approve-runtime"', 'runtime approval button removed (D-121-32)');
assert(panelConst.title === 'נמצא כפתור באתר', 'approval panel title');
assertIncludes(specialUiSrc, 'SPECIAL_BUTTON_PANEL_HE.title', 'approval panel title rendered');
for (const old of [
  'אישור פעולה (המשך כתיבה)',
  'אשר להמשך כתיבה',
  'המשך (לחיצה מאושרת)',
  'אשר לריצה (ACTIVATE)',
  'אישור המשך:',
  'אישור ריצה:',
  '«המשך»',
]) {
  assertNotIncludes(specialUiSrc, old, `old label removed: ${old}`);
}
// data-action attributes unchanged
for (const action of [
  'reject-action',
  'authoring-continue-click',
  'special-analyze-current-tab',
  'save-special-draft',
]) {
  assertIncludes(specialUiSrc, `data-action="${action}"`, `data-action ${action} retained`);
}
// Every «…» quoted button name in Admin copy = an existing literal button label
// Visual buttons render labels from SPECIAL_VISUAL_BUTTON_HE (D-121-25); resolve those too.
const visualButtonConst = Object.fromEntries(
  [
    ...sliceBetween(specialUiSrc, 'export const SPECIAL_VISUAL_BUTTON_HE', '} as const;').matchAll(
      /(\w+): '([^']+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
// 121.1-IF: frame buttons render SPECIAL_FRAME_BUTTON_HE / assistedMapping label constants.
const frameButtonConst = Object.fromEntries(
  [
    ...sliceBetween(specialUiSrc, 'export const SPECIAL_FRAME_BUTTON_HE', '} as const;').matchAll(
      /(\w+): '([^']+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
const assistedTypesSrc = read('src/assistedMapping/types.ts');
const hubLabelConst = Object.fromEntries(
  [...assistedTypesSrc.matchAll(/export const (FRAME_\w+_LABEL_HE) = '([^']+)'/g)].map((m) => [m[1], m[2]]),
);
const actionBarModuleSrc = read('src/admin/specialActionBar.ts');
// D-121-43: action-bar labels reference the shared mapping copy (src/admin/mappingCopy.ts).
const mappingCopyConst = Object.fromEntries(
  [
    ...sliceBetween(read('src/admin/mappingCopy.ts'), 'export const ADMIN_MAPPING_COPY_HE', '} as const;').matchAll(
      /(\w+): '([^']+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
function constEntries(block) {
  return Object.fromEntries([
    ...[...block.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]),
    ...[...block.matchAll(/(\w+): ADMIN_MAPPING_COPY_HE\.(\w+)/g)]
      .filter((m) => mappingCopyConst[m[2]])
      .map((m) => [m[1], mappingCopyConst[m[2]]]),
  ]);
}
const actionBarConst = constEntries(
  sliceBetween(actionBarModuleSrc, 'export const SPECIAL_ACTION_BAR_HE', '} as const;'),
);
const activateLabelConst = constEntries(
  sliceBetween(actionBarModuleSrc, 'export const SPECIAL_ACTIVATE_LABEL_HE', '};'),
);
const allButtonLabels = new Set(
  buttonSources(specialUiSrc).flatMap((b) => {
    const out = [];
    const literal = literalButtonLabel(b);
    if (literal) out.push(literal);
    for (const m of b.matchAll(/SPECIAL_VISUAL_BUTTON_HE\.(\w+)/g)) {
      if (visualButtonConst[m[1]]) out.push(visualButtonConst[m[1]]);
    }
    for (const m of b.matchAll(/SPECIAL_FRAME_BUTTON_HE\.(\w+)/g)) {
      if (frameButtonConst[m[1]]) out.push(frameButtonConst[m[1]]);
    }
    for (const m of b.matchAll(/\{(FRAME_\w+_LABEL_HE)\}/g)) {
      if (hubLabelConst[m[1]]) out.push(hubLabelConst[m[1]]);
    }
    // D-121-30: action bar renders SPECIAL_ACTION_BAR_HE / SPECIAL_ACTIVATE_LABEL_HE (specialActionBar.ts).
    for (const m of b.matchAll(/SPECIAL_ACTION_BAR_HE\.(\w+)/g)) {
      if (actionBarConst[m[1]]) out.push(actionBarConst[m[1]]);
    }
    if (b.includes('SPECIAL_ACTIVATE_LABEL_HE[')) out.push(...Object.values(activateLabelConst));
    for (const m of b.matchAll(/SPECIAL_BUTTON_PANEL_HE\.(\w+)/g)) {
      if (panelConst[m[1]]) out.push(panelConst[m[1]]);
    }
    return out;
  }),
);
const quotedNames = [...copyBlock.matchAll(/«([^«»]+)»/g)].map((m) => m[1].trim());
assert(quotedNames.length > 0, 'copy quotes button labels');
for (const name of quotedNames) {
  assert(
    allButtonLabels.has(name),
    `quoted «${name}» matches an existing button label (have: ${[...allButtonLabels].join(' | ')})`,
  );
}
// D-121-34: «זה הכפתור הנכון» removed; every such message now points to the test button.
assertNotIncludes(copyBlock, 'זה הכפתור הנכון', 'copy no longer names «זה הכפתור הנכון»');
for (const key of [
  'actionFound',
  'fieldsIdentifiedWithAction',
  'autoAnalyzeSuccessWithAction',
  'visualActionFound',
  'continueNeedsApproval',
]) {
  const line = sliceBetween(copyBlock, `${key}:`, "',");
  assertIncludes(line, '«בדוק את הכפתור וזהה את השדות»', `${key} names «בדוק את הכפתור וזהה את השדות»`);
}
console.log('  ✓ D-121-23 approval panel labels; copy quotes exact button labels');

// §4.8 / D-121-24 — Managed Autofill grid guidance while pattern is SPECIAL (UI only)
{
  const registrySrc = read('src/admin/RegistryAdmin.tsx');
  // Trigger = SPECIAL patterns only
  for (const p of ['FLOATING_SCREEN', 'MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP']) {
    assert(authoring.isSpecialLoginPattern(p), `D-121-24 trigger on ${p}`);
  }
  assert(authoring.isSpecialLoginPattern('STANDARD') === false, 'D-121-24 no trigger on STANDARD');
  // Live selection lifted, not persisted (D-121-45: owned by the parent, set from the «אופי הכניסה» grid)
  assertIncludes(registrySrc, 'onPatternChange={onAuthoringPatternSelected}', 'parent owns the live pattern');
  assertIncludes(registrySrc, 'selectedPattern={selectedAuthoringPattern}', 'SPECIAL grid follows the parent selection');
  // D-121-43: the same row-keyed selection also routes «בדיקת מילוי» (selectedPattern).
  assertIncludes(registrySrc, 'isSpecialLoginPattern(selectedAuthoringPattern)', 'parent derives SPECIAL');
  assertIncludes(registrySrc, 'authoringPatternSelection.rowId === selectedRowId', 'selection keyed by row');
  assertIncludes(registrySrc, 'specialPatternSelected={specialPatternSelected}', 'passed to Managed Autofill grid');
  const selectionUses = registrySrc.split('authoringPatternSelection').length - 1;
  // declaration + three reads inside specialPatternSelected derivation
  assert(selectionUses === 4, `pattern selection only read for guidance (uses=${selectionUses})`);
  // Managed Autofill: default = STANDARD behavior; flag touches only gates + visibility (D-121-45)
  assertIncludes(autofillEditorSrc, 'specialPatternSelected = false,', 'default keeps STANDARD behavior');
  const flagUses = autofillEditorSrc.split('specialPatternSelected').length - 1;
  assert(flagUses === 5, `flag used only in prop/default/2 gates/visibility (uses=${flagUses})`);
  const canAnalyzeDef = sliceBetween(autofillEditorSrc, 'const canAnalyze =', ';');
  const canVisualDef = sliceBetween(autofillEditorSrc, 'const canVisualMap =', ';');
  assertIncludes(canAnalyzeDef, '!specialPatternSelected', 'Analyze disabled when SPECIAL');
  assertIncludes(canVisualDef, '!specialPatternSelected', 'Visual disabled when SPECIAL');
  assertIncludes(buttonSources(autofillEditorSrc).find((b) => b.includes('data-action="analyze"')) ?? '', 'disabled={!canAnalyze}', 'analyze button uses gate');
  assertIncludes(buttonSources(autofillEditorSrc).find((b) => b.includes('data-action="visual-mapping"')) ?? '', 'disabled={!canVisualMap}', 'visual buttons use gate');
  assertIncludes(autofillEditorSrc, 'if (!canAnalyze) {', 'Analyze handler guarded');
  assertIncludes(autofillEditorSrc, 'if (!canVisualMap) {', 'Visual handler guarded');
  const saveDef = sliceBetween(autofillEditorSrc, 'const canSave =', ';');
  assertNotIncludes(saveDef, 'specialPatternSelected', 'Save gate unchanged');
  for (const action of ['analyze', 'visual-mapping', 'save', 'approve', 'clear']) {
    assertIncludes(autofillEditorSrc, `data-action="${action}"`, `Managed data-action ${action} retained`);
  }
  // D-121-38 Part A: the Admin Test moved to «בדיקת מילוי».
  assertIncludes(
    readFileSync(join(root, 'src/admin/AdminFillTestGrid.tsx'), 'utf8'),
    'data-action="managed-test"',
    'managed-test action lives in the fill-test grid',
  );
  // D-121-45 (Owner decision): the SPECIAL-selected notice is removed; the grid is not rendered instead.
  assertNotIncludes(autofillEditorSrc, 'SPECIAL_PATTERN_GRID_NOTICE_HE', 'SPECIAL-selected notice removed');
  assertNotIncludes(autofillEditorSrc, 'special-pattern-mapping-elsewhere', 'SPECIAL-selected notice removed');
  assertIncludes(autofillEditorSrc, 'if (fields.length === 0 || specialPatternSelected) {', 'STANDARD grid hidden while SPECIAL is selected');
  // Grid stays mounted (edits kept); no migration / SPECIAL write into autofillProfile
  assertIncludes(registrySrc, '<AutofillProfileEditor', 'Managed grid still mounted');
  assertNotIncludes(autofillEditorSrc, 'loginFlowPlan', 'Managed grid never touches loginFlowPlan');
  assertNotIncludes(autofillEditorSrc, 'LOGIN_FLOW_PLAN_META_KEY', 'no SPECIAL write from Managed grid');
  assertNotIncludes(specialUiSrc, 'autofillProfile: {\n            fieldMappings: draft', 'no SPECIAL → autofill migration');
  for (const src of [registrySrc, autofillEditorSrc]) {
    assertNotIncludes(src.toLowerCase(), 'mizrahi', 'no fixture-name branch');
  }
}
console.log('  ✓ §4.8 / D-121-24 Managed Autofill guidance + Analyze/Visual disabled only when SPECIAL');

// §4.9 / D-121-25 — SPECIAL Visual Mapping feedback: indicator, stale clear, timeout, cancel
{
  const pickSrc = read('extension/generic/visual-target-pick.js');
  const typesSrc = read('src/assistedMapping/types.ts');
  const armedFn = sliceBetween(specialUiSrc, 'async function runArmedVisualPick', 'function cancelArmedVisualPick');
  const cancelFn = sliceBetween(specialUiSrc, 'function cancelArmedVisualPick', 'function onPatternChange');
  const visualActionFn = sliceBetween(specialUiSrc, 'async function visualPickAction', 'async function visualPickField');
  const visualFieldFn = sliceBetween(specialUiSrc, 'async function visualPickField', 'function panelAction');

  // 1. In-progress indicator on the pressed control + status line naming the target
  assert(visualButtonConst.waitingField === 'ממתין ללחיצה על השדה…', 'field waiting label');
  assert(visualButtonConst.waitingAction === 'ממתין ללחיצה על הכפתור…', 'action waiting label');
  for (const [action, waitingKey, idleKey] of [
    ['special-visual-field', 'waitingField', 'field'],
    ['special-visual-opener', 'waitingAction', 'opener'],
    ['special-visual-transition', 'waitingAction', 'transition'],
  ]) {
    const btn = buttonSources(specialUiSrc).find((b) => b.includes(`data-action="${action}"`));
    assert(btn, `${action} button exists`);
    assertIncludes(btn, `SPECIAL_VISUAL_BUTTON_HE.${waitingKey}`, `${action} shows waiting text while armed`);
    assertIncludes(btn, `SPECIAL_VISUAL_BUTTON_HE.${idleKey}`, `${action} idle label`);
    assertIncludes(btn, 'armedPick?.target ===', `${action} indicator keyed to the pressed control`);
  }
  assertIncludes(specialUiSrc, 'role="status" data-status="special-visual-armed"', 'status line while armed');
  assertIncludes(specialUiSrc, '<strong>{armedPick.label}</strong>', 'status names the awaited target');
  assertIncludes(visualFieldFn, "target: 'field', fieldId, label: fieldLabel", 'field pick names field label');

  // 2. Stale success AND error cleared on start (Visual, Analyze, continuation)
  const armedStart = armedFn.slice(0, armedFn.indexOf('startCurrentTabVisualMapping('));
  assertIncludes(armedStart, 'setError(null);', 'Visual start clears error');
  assertIncludes(armedStart, 'setSuccess(null);', 'Visual start clears success');
  const manualAnalyze = sliceBetween(specialUiSrc, 'async function analyzeCurrentSurface', 'async function visualPickAction');
  assertIncludes(manualAnalyze, 'setError(null);', 'Analyze start clears error');
  assertIncludes(manualAnalyze, 'setSuccess(null);', 'Analyze start clears success');
  const contStart = continueFn.slice(0, continueFn.indexOf('performApprovedAuthoringClick('));
  assertIncludes(contStart, 'setError(null);', 'continuation start clears error');
  // D-121-27: stale success is replaced by the site-tab status at continuation start.
  assert(
    contStart.includes('setSuccess(null);') ||
      contStart.includes('setSuccess(SPECIAL_EDITOR_COPY_HE.siteTabActive);'),
    'continuation start replaces stale success',
  );
  assertIncludes(visualActionFn, 'runArmedVisualPick(', 'opener/transition use armed pick');
  assertIncludes(visualFieldFn, 'runArmedVisualPick(', 'field uses armed pick');

  // 3. Bounded timeout: page-side bound + Hub safety; disarm + release + message
  // D-121-42: constants promoted to shared ADMIN_* names (same values).
  assertIncludes(typesSrc, 'ADMIN_VISUAL_PICK_TIMEOUT_MS = 60_000', '60s bound');
  assertIncludes(typesSrc, 'ADMIN_VISUAL_PICK_HUB_GRACE_MS = 5_000', '5s Hub grace');
  assertIncludes(currentTabSrc, 'pickTimeoutMs: ADMIN_VISUAL_PICK_TIMEOUT_MS', 'Hub sends bound');
  const specialVisualFn2 = sliceBetween(bgSrc, 'function visualMappingCurrentAuthoringTab', 'function cancelVisualMappingCurrentAuthoringTab');
  assertIncludes(specialVisualFn2, 'timeoutMs: boundMs', 'Ext arms with bound');
  assertIncludes(specialVisualFn2, 'SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS', 'Ext caps bound');
  assertIncludes(pickSrc, "disarm('visual_pick_timeout')", 'page timeout disarms');
  const finishFn = sliceBetween(pickSrc, 'function finish(result)', 'resolve(result);');
  assertIncludes(finishFn, "doc.removeEventListener('click', onClick, true)", 'disarm removes listener');
  assertIncludes(finishFn, 'clearTimeout(timer)', 'finish clears timer');
  assertIncludes(armedFn, 'ADMIN_VISUAL_PICK_TIMEOUT_MS + ADMIN_VISUAL_PICK_HUB_GRACE_MS', 'Hub safety timer');
  const hubTimer = sliceBetween(armedFn, 'pickHubTimerRef.current = setTimeout', '}, ADMIN_VISUAL_PICK_TIMEOUT_MS');
  assertIncludes(hubTimer, 'cancelCurrentTabVisualMapping(', 'Hub timeout disarms page pick');
  assertIncludes(hubTimer, 'releasePick()', 'Hub timeout releases editor');
  assertIncludes(hubTimer, 'setError(pickTimeoutMessage(pick))', 'Hub timeout shows message');
  assertIncludes(armedFn, "result.reason === 'visual_pick_timeout'", 'page timeout mapped to message');
  const releaseFn = sliceBetween(specialUiSrc, 'function releasePick', 'async function runArmedVisualPick');
  assertIncludes(releaseFn, 'setArmedPick(null)', 'release clears armed state');
  assertIncludes(releaseFn, 'setBusy(false)', 'release unlocks editor');

  // 4. Cancel: visible while armed; disarms page listener; releases; writes nothing
  const cancelBtn = buttonSources(specialUiSrc).find((b) => b.includes('data-action="special-visual-cancel"'));
  assert(cancelBtn && literalButtonLabel(cancelBtn) === 'ביטול', 'cancel button labeled «ביטול»');
  assertNotIncludes(cancelBtn, 'disabled=', 'cancel stays enabled while editor busy');
  const armedPanel = sliceBetween(specialUiSrc, '{armedPick ? (', ') : null}');
  assertIncludes(armedPanel, 'data-action="special-visual-cancel"', 'cancel rendered only while armed');
  assertIncludes(cancelFn, 'pickTokenRef.current += 1', 'cancel invalidates pending pick');
  assertIncludes(cancelFn, 'cancelCurrentTabVisualMapping(', 'cancel disarms page pick');
  assertIncludes(cancelFn, 'releasePick()', 'cancel releases editor');
  for (const w of ['setDraft', 'setPendingAction', 'updateGlobalRegistryRow', 'upsertStepFieldMappings']) {
    assertNotIncludes(cancelFn, w, `cancel writes no mapping (${w})`);
  }
  // Late response after cancel/timeout ignored → no mapping written
  const afterAwait = armedFn.slice(armedFn.indexOf('await startCurrentTabVisualMapping('));
  assertIncludes(afterAwait, 'if (pickTokenRef.current !== token) return null;', 'stale response ignored');
  assertIncludes(visualFieldFn, 'if (!picked) return;', 'field writes only on success');
  assertIncludes(visualActionFn, 'if (!picked) return;', 'action writes only on success');
  assertIncludes(bgSrc, "message.type === 'ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL'", 'Ext cancel message');
  const extCancel = sliceBetween(bgSrc, 'function cancelVisualMappingCurrentAuthoringTab', 'function authoringClickApprovedAction');
  assertIncludes(extCancel, "__disarmVisualTargetPick('visual_pick_cancelled')", 'Ext calls page disarm');
  assertIncludes(extCancel, "reason: 'origin_mismatch'", 'cancel keeps origin fail-closed');
  assertIncludes(extCancel, 'allFrames: true', 'cancel disarms every frame (§IF-0)');
  assertIncludes(pickSrc, "global.__disarmVisualTargetPick('visual_pick_superseded')", 'no stacked listeners');

  // 5. Exact-label rule for new messages (checked by the «…» sweep above) + specifics
  // D-121-42: field-pick copy comes from the shared module (also used by the STANDARD grid).
  const sharedPickCopy = read('src/admin/visualPickCopy.ts');
  for (const [key, sharedKey, label] of [
    ['visualPickCancelHint', 'cancelHint', '«ביטול»'],
    ['visualPickTimeoutField', 'timeoutField', '«מיפוי חזותי»'],
  ]) {
    assertIncludes(copyBlock, `${key}: ADMIN_VISUAL_PICK_COPY_HE.${sharedKey},`, `${key} uses shared copy`);
    assertIncludes(sliceBetween(sharedPickCopy, `${sharedKey}:`, "',"), label, `${sharedKey} quotes ${label}`);
  }
  for (const [key, label] of [
    // D-121-31 (§4.12): opener / transition picks renamed; timeouts quote the new labels.
    ['visualPickTimeoutOpener', '«סמנו בעצמכם את כפתור פתיחת המסך הצף»'],
    ['visualPickTimeoutTransition', '«סמנו בעצמכם את כפתור המעבר בין השלבים»'],
  ]) {
    assertIncludes(sliceBetween(copyBlock, `${key}:`, "',"), label, `${key} quotes ${label}`);
  }

  // Unchanged: pick semantics, STANDARD. (§IF-0: SPECIAL Visual arms per frameId.)
  assertNotIncludes(specialVisualFn2, 'allFrames', 'visual arm is per-frame, never allFrames');
  assertIncludes(pickSrc, 'function isIdentifiableControl(el)', 'pick identification unchanged');
  assertIncludes(pickSrc, 'assertLocatorDeterministic(chosen.locator, el, doc)', 'locator determinism unchanged');
  assertIncludes(pickSrc, "finish({ ok: false, reason: 'origin_mismatch', fieldId: fieldId });", 'pick origin fail-closed unchanged');
  assertIncludes(pickSrc, "options && typeof options.timeoutMs === 'number' && options.timeoutMs > 0", 'bound opt-in only');
  // D-121-42 supersedes "STANDARD unbounded / never disarms": STANDARD now uses its own
  // bounded + cancellable pick (fresh tab); it never uses the SPECIAL session-tab cancel.
  const standardVisualFn = sliceBetween(bgSrc, 'function openPageAndVisualMapping', '\n}\n');
  assertIncludes(standardVisualFn, 'pickOptions.timeoutMs = pickBoundMs', 'STANDARD Visual arms with bound (D-121-42)');
  assertNotIncludes(visualSrc, 'ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL', 'STANDARD Hub never uses the SPECIAL cancel');
  assertNotIncludes(autofillEditorSrc, 'cancelCurrentTabVisualMapping', 'STANDARD grid never uses the SPECIAL cancel');
  for (const src of [pickSrc, extCancel, armedFn]) {
    assertNotIncludes(src.toLowerCase(), 'mizrahi', 'no fixture-name branch');
    assertNotIncludes(src, 'hostname ===', 'no hostname branch');
  }
}
console.log('  ✓ §4.9 / D-121-25 SPECIAL Visual indicator, stale clear, timeout, cancel');

// §5.2 / D-121-26 — pending selection vs draft membership (fixes D-121-22 regression)
{
  const mk = (actionId, kind, locator) =>
    authoring.createActionCandidate({ actionId, kind, label: locator, locator });
  const snapshot = (d) => JSON.stringify(d);
  // D-121-46 A1: openers and transitions coexist only in FLOATING_SCREEN_MULTI_STEP.
  const base = authoring.ensureSpecialDraft('FLOATING_SCREEN_MULTI_STEP', null);

  // Manual Analyze: top candidate already in draft → pending = that (existing) action
  const approvedOpener = authoring.approveActionForAuthoringContinuation(
    mk('act-1', 'floating_opener', '#logInBtn'),
  );
  const withOpener = authoring.upsertPreambleAction(base, approvedOpener);
  const before = snapshot(withOpener);
  const manualPick = contract.selectPendingForManualAnalyze(withOpener, [
    mk('act-7', 'floating_opener', '#logInBtn'),
    mk('act-8', 'intermediate_transition', '#other'),
  ]);
  assert(manualPick && manualPick.locator === '#logInBtn', 'manual: top candidate even if in draft');
  assert(manualPick.actionId === 'act-1', 'manual: existing draft action returned');
  assert(manualPick.approvedForAuthoringContinuation === true, 'manual: existing approval state shown');
  assert(snapshot(withOpener) === before, 'manual select does not modify draft');
  // Top candidate not in draft → unapproved, re-id'd on actionId collision
  const freshTop = contract.selectPendingForManualAnalyze(withOpener, [
    mk('act-1', 'intermediate_transition', '#next'),
  ]);
  assert(freshTop && freshTop.locator === '#next', 'manual: fresh top candidate');
  assert(freshTop.actionId !== 'act-1', 'manual: colliding actionId re-ided');
  assert(!freshTop.approvedForAuthoringContinuation && !freshTop.approvedForRuntime, 'fresh is unapproved');
  assert(contract.selectPendingForManualAnalyze(withOpener, []) === null, 'manual: no proposals → null');

  // after_continue: skip clicked + already-approved draft actions
  const afterPick = contract.selectPendingAfterContinue(
    withOpener,
    [mk('a', 'floating_opener', '#logInBtn'), mk('b', 'intermediate_transition', '#step2')],
    approvedOpener,
  );
  assert(afterPick && afterPick.locator === '#step2', 'after_continue skips clicked action');
  const approvedOther = authoring.approveActionForAuthoringContinuation(
    mk('act-2', 'intermediate_transition', '#approved2'),
  );
  const withTwo = authoring.upsertPreambleAction(withOpener, approvedOther);
  const afterPick2 = contract.selectPendingAfterContinue(
    withTwo,
    [mk('c', 'intermediate_transition', '#approved2'), mk('d', 'intermediate_transition', '#step3')],
    mk('x', 'floating_opener', '#elsewhere'),
  );
  assert(afterPick2 && afterPick2.locator === '#step3', 'after_continue skips approved draft actions');
  assert(
    contract.selectPendingAfterContinue(withTwo, [mk('e', 'floating_opener', '#logInBtn')], approvedOpener) === null,
    'after_continue: nothing new → null (pending kept by caller)',
  );

  // Propose ≠ draft write; approve adds; reject removes
  const cand = contract.selectPendingForManualAnalyze(base, [mk('p1', 'floating_opener', '#open')]);
  assert(contract.listDraftActions(base).length === 0, 'propose leaves draft empty');
  const added = authoring.upsertPreambleAction(base, authoring.approveActionForAuthoringContinuation(cand));
  assert(
    contract.listDraftActions(added).some((a) => a.locator === '#open' && a.approvedForAuthoringContinuation),
    'approve adds action to draft',
  );
  const runtimeAdded = authoring.upsertPreambleAction(base, authoring.approveActionForRuntime(cand));
  assert(
    contract.listDraftActions(runtimeAdded).some((a) => a.locator === '#open' && a.approvedForRuntime),
    'runtime approve on non-draft action adds it (approved)',
  );
  const removed = contract.removeDraftAction(added, cand);
  assert(contract.listDraftActions(removed).length === 0, 'reject removes action from draft');
  assert(contract.listDraftActions(added).length === 1, 'removeDraftAction is pure');
  assert(
    contract.removeDraftAction(base, cand).preambleActions.length === 0,
    'reject on non-draft action is a no-op',
  );
  const stepDraft = authoring.ensureSpecialDraft('MULTI_STEP', null);
  stepDraft.steps[0].exitTransition = { ...mk('t1', 'intermediate_transition', '#t'), approvedForAuthoringContinuation: true };
  const stepRemoved = contract.removeDraftAction(stepDraft, mk('zz', 'intermediate_transition', '#t'));
  assert(!('exitTransition' in stepRemoved.steps[0]), 'reject removes matching exit transition (by locator)');

  // Editor wiring
  assertIncludes(runAnalyzeFn, 'selectPendingForManualAnalyze(current, proposedActions)', 'manual Analyze uses top-candidate rule');
  assertIncludes(runAnalyzeFn, 'selectFollowUpAfterContinue({', 'after_continue uses the D-121-34 follow-up rule');
  for (const needle of ['upsertPreambleAction', 'pickNewActionCandidate', 'listDraftActions']) {
    assertNotIncludes(runAnalyzeFn, needle, `Analyze does not write/skip via ${needle}`);
  }
  assertNotIncludes(runAnalyzeFn, '!pendingAction', 'manual replaces pending (no stale-pending guard)');
  assertIncludes(continueFn, "runSpecialAnalyze('after_continue', { base: chosenDraft, tested: chosen, slot", 'tested action passed to after_continue');
  assertIncludes(continueFn, 'actionForTestPress(draftCopy(draft, shown))', 'tested action = latest draft copy of the shown proposal');
  // D-121-34: the test press adds the action to the draft; «זה לא הכפתור» removes it.
  const rejectFn = sliceBetween(specialUiSrc, 'function rejectAction', 'async function testAndChooseAction');
  assertIncludes(continueFn, 'writeDraftAction(draft, consented)', 'test press adds to draft');
  assertNotIncludes(specialUiSrc, 'function approvePendingRuntime', 'separate runtime approval removed');
  assertNotIncludes(specialUiSrc, 'function approvePendingAuthoring', 'separate approval handler removed');
  assertIncludes(rejectFn, 'removeDraftAction(draft, shown)', '«זה לא הכפתור» removes from draft');
  assertIncludes(rejectFn, 'setPanelAction(slot, null)', '«זה לא הכפתור» clears the panel');
  assertNotIncludes(rejectFn, 'upsertPreambleAction', '«זה לא הכפתור» never upserts');
  const visualActionFn = sliceBetween(specialUiSrc, 'async function visualPickAction', 'async function visualPickField');
  assertIncludes(visualActionFn, 'selectPendingForManualAnalyze(draft, [candidate])', 'Visual follows manual rule');
  assertNotIncludes(visualActionFn, 'setDraft', 'Visual action pick does not write draft');
  for (const key of ['reject', 'testOpen']) {
    assertIncludes(specialUiSrc, `SPECIAL_BUTTON_PANEL_HE.${key}`, `panel button ${key} present`);
  }
  assertIncludes(specialUiSrc, 'actionAlreadyApproved', 'already-approved copy wired');
  assertNotIncludes(specialUiSrc.toLowerCase(), 'mizrahi', 'D-121-26 site-agnostic');
}
console.log('  ✓ §5.2 / D-121-26 manual top-candidate pending; after_continue skip; approve adds; reject removes; Visual same rule');

// §4.6.1 / D-121-27 — deterministic, visible SPECIAL authoring tab
{
  const ORIGIN = 'https://fixture.example';
  const tabHelpersSrc = bgSrc.slice(
    bgSrc.indexOf('function ensureSpecialAuthoringTab'),
    bgSrc.indexOf('function rejectIfReopenLoginEntryRequested'),
  );
  function makeChrome(tabs) {
    const calls = { created: [], updated: [], focused: [] };
    const chrome = {
      runtime: { lastError: undefined },
      tabs: {
        get(id, cb) {
          const tab = tabs.find((t) => t.id === id);
          chrome.runtime.lastError = tab ? undefined : { message: 'No tab with id' };
          cb(tab);
          chrome.runtime.lastError = undefined;
        },
        query(_q, cb) {
          chrome.runtime.lastError = undefined;
          cb(tabs.slice());
        },
        create(opts, cb) {
          const tab = { id: 900 + calls.created.length, url: opts.url, status: 'complete', windowId: 1 };
          tabs.push(tab);
          calls.created.push(opts);
          cb(tab);
        },
        update(id, props, cb) {
          calls.updated.push({ id, props });
          cb(tabs.find((t) => t.id === id));
        },
        onUpdated: { addListener() {}, removeListener() {} },
      },
      windows: {
        update(id, props, cb) {
          calls.focused.push({ id, props });
          cb();
        },
      },
    };
    return { chrome, calls };
  }
  function loadTabHelpers(chrome) {
    return new Function(
      'chrome',
      'isAllowedGenericAutofillUrl',
      'GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS',
      `${tabHelpersSrc}\nreturn { ensureSpecialAuthoringTab, activateSpecialAuthoringTab, withAuthoringTab };`,
    )(chrome, () => true, 1000);
  }
  function ensure(tabs, message) {
    const { chrome, calls } = makeChrome(tabs);
    const h = loadTabHelpers(chrome);
    let out = null;
    h.ensureSpecialAuthoringTab(
      { allowedOrigin: ORIGIN, authoringUrl: `${ORIGIN}/`, ...message },
      (r) => {
        out = r;
      },
    );
    return { out, calls };
  }
  const fixtureTabs = () => [
    { id: 11, url: `${ORIGIN}/a`, lastAccessed: 100, status: 'complete', windowId: 1 },
    { id: 12, url: `${ORIGIN}/b`, lastAccessed: 300, status: 'complete', windowId: 2 },
    { id: 13, url: 'https://other.example/', lastAccessed: 900, status: 'complete', windowId: 1 },
    { id: 14, url: `${ORIGIN}/c`, lastAccessed: 200, status: 'complete', windowId: 1 },
  ];

  // Ext honors a valid session tab (even if not most recent)
  let r = ensure(fixtureTabs(), { tabId: 14 });
  assert(r.out.ok && r.out.tabId === 14 && r.out.sessionTab === true, 'valid message.tabId honored');
  // Session tab gone → fallback (most recently accessed same-origin)
  r = ensure(fixtureTabs(), { tabId: 77 });
  assert(r.out.ok && r.out.tabId === 12 && r.out.sessionTab === false, 'gone session tab → lastAccessed fallback');
  // Session tab origin mismatch → fallback (never the foreign tab)
  r = ensure(fixtureTabs(), { tabId: 13 });
  assert(r.out.ok && r.out.tabId === 12, 'origin-mismatch session tab → fallback');
  // No session tab: lastAccessed wins, not first query result (11)
  r = ensure(fixtureTabs(), {});
  assert(r.out.tabId === 12, 'fallback uses lastAccessed, not query order');
  assert(r.calls.created.length === 0, 'reuse does not open a new tab');
  // None same-origin → open §4.7 authoringUrl (unchanged)
  r = ensure([{ id: 13, url: 'https://other.example/', lastAccessed: 900, status: 'complete' }], {});
  assert(r.out.ok && r.out.opened === true, 'no same-origin tab → opens authoringUrl');
  assert(r.calls.created[0].url === `${ORIGIN}/`, 'opens resolved authoringUrl');
  // Missing origin still fail-closed
  r = ensure(fixtureTabs(), { allowedOrigin: '' });
  assert(r.out.ok === false, 'missing origin fail-closed');

  // activate + focus window
  {
    const { chrome, calls } = makeChrome(fixtureTabs());
    const h = loadTabHelpers(chrome);
    let activated = null;
    h.activateSpecialAuthoringTab(12, (a) => {
      activated = a;
    });
    assert(activated === true, 'activation reported');
    assert(calls.updated[0].id === 12 && calls.updated[0].props.active === true, 'tab activated');
    assert(calls.focused[0].id === 2 && calls.focused[0].props.focused === true, 'tab window focused');
    const tagged = h.withAuthoringTab({ ok: false, reason: 'x' }, 12, { reused: true }, true);
    assert(tagged.authoringTabId === 12 && tagged.authoringTabActivated === true, 'response tagged with authoringTabId');
  }

  // Responses include authoringTabId (inspect / visual / click / cancel)
  const inspectFn = viaGate(bgSrc.slice(
    bgSrc.indexOf('function inspectCurrentAuthoringTab'),
    bgSrc.indexOf('function visualMappingCurrentAuthoringTab'),
  ));
  const visualFn = viaGate(bgSrc.slice(
    bgSrc.indexOf('function visualMappingCurrentAuthoringTab'),
    bgSrc.indexOf('function cancelVisualMappingCurrentAuthoringTab'),
  ));
  const cancelFn = bgSrc.slice(
    bgSrc.indexOf('function cancelVisualMappingCurrentAuthoringTab'),
    bgSrc.indexOf('function authoringClickApprovedAction'),
  );
  const clickFn = viaGate(bgSrc.slice(
    bgSrc.indexOf('function authoringClickApprovedAction'),
    bgSrc.indexOf('function openPageAndManagedAutofill'),
  ));
  assert(/withAuthoringTab\(\w+, tabId, ensured\)/.test(inspectFn), 'inspect response has authoringTabId');
  assertIncludes(visualFn, 'withAuthoringTab(result, tabId, ensured, activated)', 'visual response has authoringTabId');
  assertIncludes(clickFn, 'withAuthoringTab(result, tabId, ensured, activated)', 'click response has authoringTabId');
  assertIncludes(cancelFn, 'authoringTabId: tabId', 'cancel response has authoringTabId');
  // Inspect-only Analyze stays in background
  assertNotIncludes(inspectFn, 'activateSpecialAuthoringTab', 'inspect does not steal focus');
  // Activate + focus BEFORE Visual arm and BEFORE click
  const vAct = visualFn.indexOf('activateSpecialAuthoringTab(tabId');
  assert(vAct > 0 && vAct < visualFn.indexOf('armVisualTargetPick('), 'activate before Visual arm');
  assert(vAct > visualFn.indexOf("reason: 'origin_mismatch'"), 'Visual activation after origin gate');
  const cAct = clickFn.indexOf('activateSpecialAuthoringTab(tabId');
  assert(cAct > 0 && cAct < clickFn.indexOf('.click()'), 'activate before continuation click');
  assert(cAct > clickFn.indexOf("reason: 'origin_mismatch'"), 'click activation after origin gate');
  // Cancel targets the session tab; origin fail-closed retained
  assertIncludes(cancelFn, "typeof message.tabId === 'number' ? message.tabId : armedTabId", 'cancel targets session tab');
  assertIncludes(cancelFn, "reason: 'origin_mismatch'", 'cancel origin fail-closed');
  // §IF-0 supersedes the frame-0-only scope for SPECIAL authoring: per-frame targets
  // (never allFrames for arm / click), cancel disarms every frame of the session tab.
  assertIncludes(inspectFn, 'enumerateSpecialAuthoringFrames(tabId, allowedOrigin', 'inspect enumerates frames after R1');
  assertIncludes(visualFn, 'enumerateSpecialAuthoringFrames(tabId, allowedOrigin', 'visual enumerates frames after R1');
  assertNotIncludes(visualFn, 'allFrames', 'visual arms one executeScript per frameId');
  assertNotIncludes(clickFn.slice(clickFn.indexOf('function authoringClickApprovedAction')), 'allFrames', 'click targets one resolved frame');
  assertIncludes(cancelFn, 'allFrames: true', 'cancel disarms all frames');
  assertNotIncludes(tabHelpersSrc.toLowerCase(), 'mizrahi', 'tab selection site-agnostic');
  assertNotIncludes(tabHelpersSrc, 'hostname', 'tab selection has no hostname branch');

  // Hub: resends session tab as tabId on every SPECIAL message, reads authoringTabId back
  assert(
    currentTabSrc.split('...sessionTabField(input)').length - 1 === 4,
    'Hub sends tabId on inspect / visual / cancel / click',
  );
  assertIncludes(currentTabSrc, "typeof response?.authoringTabId === 'number'", 'Hub reads authoringTabId');
  for (const call of [
    'analyzeSpecialCurrentSurface({',
    'startCurrentTabVisualMapping({',
    'performApprovedAuthoringClick({',
  ]) {
    const at = specialUiSrc.indexOf(call);
    const body = specialUiSrc.slice(at, specialUiSrc.indexOf('});', at));
    assertIncludes(body, 'authoringTabId: sessionTabId()', `${call} passes session tab`);
  }
  assert(
    specialUiSrc.split('rememberSessionTab(result)').length - 1 === 3,
    'editor stores authoringTabId from analyze / visual / click',
  );
  assert(
    specialUiSrc.split('cancelCurrentTabVisualMapping({').length - 1 === 3 &&
      specialUiSrc.split('authoringTabId: sessionTab').length - 1 >= 6,
    'cancel (button / Hub timer / unmount) targets session tab',
  );
  assertIncludes(specialUiSrc, 's && s.rowId === row.id ? s.tabId : null', 'session tab scoped to service row');
  assert(/sessionTabRef\.current = null;\s*\}, \[row\.id\]\);/.test(specialUiSrc), 'session reset on row change');
  const unmountFx = sliceBetween(specialUiSrc, 'if (armedPickRef.current) {', '[],');
  assertIncludes(unmountFx, 'sessionTabRef.current = null;', 'session reset on unmount (after cancel)');
  // Copy: plain Hebrew site-tab status
  assertIncludes(specialUiSrc, 'siteTabActive: ADMIN_VISUAL_PICK_COPY_HE.siteTabActive,', 'site-tab status copy (shared, D-121-42)');
  assertIncludes(read('src/admin/visualPickCopy.ts'), "siteTabActive: 'פועל בלשונית האתר שנפתחה.'", 'site-tab status copy text');
  assertIncludes(specialUiSrc, 'data-status="special-site-tab"', 'site-tab status shown while armed');
  assertIncludes(continueFn, 'setSuccess(SPECIAL_EDITOR_COPY_HE.siteTabActive)', 'site-tab status during continuation');
  // STANDARD untouched
  assertNotIncludes(autofillEditorSrc, 'authoringTabId', 'STANDARD editor has no session tab');
  const stdVisualFn = bgSrc.slice(
    bgSrc.indexOf('function openPageAndVisualMapping'),
    bgSrc.indexOf('function', bgSrc.indexOf('function openPageAndVisualMapping') + 10),
  );
  assertNotIncludes(stdVisualFn, 'activateSpecialAuthoringTab', 'STANDARD Visual unchanged');
}
console.log('  ✓ §4.6.1 / D-121-27 session tab resend; lastAccessed fallback; activate + focus before click / Visual');

// AC-121.1-6/7 draft-only persist; dual-write rejected
const draft = authoring.ensureSpecialDraft('FLOATING_SCREEN', null);
const withMaps = authoring.upsertStepFieldMappings(draft, 'step-1', [
  { fieldId: 'username', locatorType: 'css', locator: '#user' },
]);
// D-121-64: the guard checks what the SPECIAL write sends, not locator overlap with STANDARD.
const storedProfile = { fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }] };
const dual = authoring.assertSpecialWriteKeepsAutofillProfile({
  rowMetadata: { autofillProfile: storedProfile },
  patchMetadata: { autofillProfile: { fieldMappings: [...storedProfile.fieldMappings, { fieldId: 'password', locatorType: 'css', locator: '#pass' }] }, loginFlowPlan: { draft: withMaps } },
});
assert(dual.ok === false, 'AC-121.1-7 dual-write rejected');
assert(authoring.assertSpecialWriteKeepsAutofillProfile({ rowMetadata: { autofillProfile: storedProfile }, patchMetadata: { loginFlowPlan: { draft: withMaps } } }).ok, 'D-121-64 shared STANDARD / SPECIAL locator allowed');
assertIncludes(specialUiSrc, 'LOGIN_FLOW_PLAN_META_KEY', 'save draft key');
assertIncludes(specialUiSrc, 'assertSpecialWriteKeepsAutofillProfile', 'save checks dual-write');
// D-121-43: shared save copy; «נשמר — עדיין לא אושר למשתמשים» comes from the shared status line.
assertIncludes(specialUiSrc, 'draftSaved: ADMIN_MAPPING_COPY_HE.saved,', 'save copy = shared «המיפוי נשמר בהצלחה»');
// D-121-45: the shared status line lives in the «אופי הכניסה» grid.
assertIncludes(read('src/admin/LoginPatternGrid.tsx'), 'specialMappingStatus(row.metadata)', 'saved-not-approved shown by the shared status line');
console.log('  ✓ AC-121.1-6/7 draft-only mappings; dual-write rejected');

// AC-121.1-8 snapshot
const incomplete = authoring.ensureSpecialDraft('MULTI_STEP', null);
const snap = contract.createImmutableDraftSnapshot(incomplete);
assert(snap.ok === true, 'snapshot builds');
assert(snap.snapshot.isComplete === false, 'incomplete flagged');
incomplete.steps[0].fieldMappings = [
  { fieldId: 'username', locatorType: 'css', locator: '#u' },
];
assert(
  snap.snapshot.plan.steps[0].fieldMappings.length === 0,
  'snapshot immutable vs draft mutate',
);
// D-121-30: snapshot check moved to specialActionBar.checkSpecialDraft (A1 + snapshot);
// result copy is plain Hebrew (asserted in verifyPhase121ActionBar.mjs).
const actionBarSrc = read('src/admin/specialActionBar.ts');
assertIncludes(actionBarSrc, 'createImmutableDraftSnapshot(normalized', 'UI check wires snapshot (after A1)');
assertIncludes(specialUiSrc, 'checkSpecialDraft(draft)', 'editor uses the shared draft check');
// D-121-43: the snapshot check is the automatic completeness line (button removed).
assertIncludes(specialUiSrc, 'data-status="mapping-completeness"', 'snapshot affordance = automatic completeness line');
assertNotIncludes(specialUiSrc, 'validate-draft-snapshot', 'D-121-43: check button removed');
console.log('  ✓ AC-121.1-8 snapshot representation');

// AC-121.1-9 thin ACTIVATE via planner
assertIncludes(specialUiSrc, 'LOGIN_CONTRACT_ACTIVATE_INTENT_KEY', 'activate intent');
assertIncludes(specialUiSrc, 'STANDARD_TO_SPECIAL', 'S→SP');
assertIncludes(specialUiSrc, 'SPECIAL_TO_SPECIAL', 'SP→SP');
// D-121-30: SPECIAL→STANDARD is sent by the regular grid activation, not the SPECIAL editor.
assertNotIncludes(specialUiSrc, 'SPECIAL_TO_STANDARD', 'SP→S no longer in SPECIAL editor');
assertIncludes(actionBarSrc, "transition: 'SPECIAL_TO_STANDARD'", 'SP→S via grid payload builder');
assertIncludes(autofillEditorSrc, 'buildGridProfileMetadataPatch(', 'grid writes via payload builder');
assertNotIncludes(specialUiSrc, 'planLoginContractActivate(', 'UI uses intent→registry merge not local bypass');
console.log('  ✓ AC-121.1-9 thin ACTIVATE via 121.0 intent');

// AC-121.1-10 no SPECIAL runtime
for (const needle of [
  'LoginFlowOrchestrator',
  'executeSpecialLogin',
  'runSpecialAdminTest',
  'orchestrateSpecial',
]) {
  assertNotIncludes(specialUiSrc, needle, `no ${needle}`);
  assertNotIncludes(currentTabSrc, needle, `no ${needle} hub`);
}
assertIncludes(bgSrc, 'fill_or_submit_forbidden', 'authoring click bans fill/submit');
console.log('  ✓ AC-121.1-10 no SPECIAL runtime');

// AC-121.1-11 STANDARD unchanged
assertIncludes(autofillEditorSrc, 'analyzeLoginPageForMapping', 'STANDARD Analyze retained');
assertIncludes(autofillEditorSrc, 'startVisualMappingForField', 'STANDARD Visual retained');
assertNotIncludes(autofillEditorSrc, 'analyzeCurrentTabForMapping', 'STANDARD editor not switched to current-tab');
assert(
  contract.resolveActiveLoginContract({}).mode === 'STANDARD',
  'missing activation ≡ STANDARD',
);
console.log('  ✓ AC-121.1-11 STANDARD path frozen');

// AC-121.1-12 noted — regression suite run separately
console.log('  ✓ AC-121.1-12 (regression suite invoked by Developer evidence)');

console.log('\nPASS — Phase 121.1 SPECIAL DRAFT authoring (AC-121.1-1…12 core)');
