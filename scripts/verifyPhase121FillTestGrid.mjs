/**
 * Phase 121 D-121-38 Part A — unified Admin Test grid «בדיקת מילוי».
 * Evidence: harness moved out of the managed grid; route per selected «אופי הכניסה»
 * (D-121-43: the context selector is removed); STANDARD run path unchanged; SPECIAL
 * runs the saved mapping only, with the shared dirty copy.
 * Usage: node scripts/verifyPhase121FillTestGrid.mjs
 */
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
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

function count(hay, needle) {
  return hay.split(needle).length - 1;
}

console.log('Phase 121 D-121-38 Part A — «בדיקת מילוי» grid verification\n');

const SPECIAL_COMING_SOON = 'בדיקת מילוי לכניסה מיוחדת תופעל בקרוב.';
const DIRTY = 'יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.';
const PATTERN_LATER = 'בדיקת מילוי לסוג כניסה זה תופעל בשלב מאוחר יותר.';
// D-121-43: the SPECIAL dirty guard uses the same wording as STANDARD.
const DRAFT_DIRTY = DIRTY;

const gridSrc = read('src/admin/AdminFillTestGrid.tsx');
const ctxSrc = read('src/admin/fillTestContext.ts');
const managedSrc = read('src/admin/AutofillProfileEditor.tsx');
const registrySrc = read('src/admin/RegistryAdmin.tsx');

// --- 1. Harness moved: absent from the managed grid, present once in the new grid ---
for (const needle of [
  'data-section="managed-test-harness"',
  'data-section="managed-test-unavailable"',
  'data-action="managed-test"',
  'data-temp-test-field',
  'managed-test-structure',
  'executeAdminManagedAutofillTest',
  'stampAdminTestPassed',
  'tempTestValues',
  'כניסה לאתר ומילוי שדות',
]) {
  assertNotIncludes(managedSrc, needle, `harness absent from managed grid: ${needle}`);
}
for (const needle of [
  'data-section="managed-test-harness"',
  'data-section="managed-test-unavailable"',
  'data-action="managed-test"',
  'data-temp-test-field={field.id}',
  'data-testid="managed-test-structure"',
]) {
  assert(count(gridSrc, needle) === 1, `new grid renders exactly one ${needle}`);
}
assertIncludes(gridSrc, 'data-section="fill-test-grid"', 'grid section marker');
assertIncludes(ctxSrc, "title: 'בדיקת מילוי'", 'grid title');
console.log('  ✓ harness moved out of «מילוי אוטומטי מנוהל» (no duplicate)');

// --- 2. Sibling top-level grid in Registry Admin, same block as the other grids ---
const specialIdx = registrySrc.indexOf('<SpecialLoginDraftEditor');
const managedIdx = registrySrc.indexOf('<AutofillProfileEditor', specialIdx);
const fillIdx = registrySrc.indexOf('<AdminFillTestGrid', managedIdx);
assert(specialIdx > 0 && managedIdx > specialIdx && fillIdx > managedIdx, 'grid order: אופי הכניסה → מנוהל → בדיקת מילוי');
const block = registrySrc.slice(specialIdx, registrySrc.indexOf('</>', fillIdx));
assert(block.indexOf('<AdminFillTestGrid') > 0, 'fill-test grid in the same fragment as its siblings');
assertIncludes(block, 'onSharedStateChange={setManagedGridState}', 'managed grid reports shared state');
assertIncludes(block, 'fillTestRunning={fillTestRunning}', 'managed grid observes test running');
assertIncludes(block, 'managedGrid={managedGridState}', 'fill-test grid observes managed grid');
assertIncludes(block, 'onTestingChange={setFillTestRunning}', 'fill-test grid reports testing');
assertIncludes(block, 'row={selectedRow}', 'fill-test grid receives the selected row');
for (const needle of ['shufersal', 'pagi', 'hostname ===', 'serviceId ===']) {
  assertNotIncludes(block.toLowerCase(), needle, `no ${needle} branch around the grid`);
  assertNotIncludes(gridSrc.toLowerCase(), needle, `no ${needle} branch in the grid`);
  assertNotIncludes(ctxSrc.toLowerCase(), needle, `no ${needle} branch in the selector`);
}
console.log('  ✓ sibling grid wired in Registry Admin; shared dirty/busy/testing state lifted');

// --- 3. Managed grid still reports dirty + locks while the test runs ---
assertIncludes(managedSrc, 'onSharedStateChange?.({', 'managed grid reports state');
assertIncludes(managedSrc, 'hasUnsavedChanges,', 'dirty state shared');
assertIncludes(managedSrc, 'const testing = fillTestRunning;', 'managed grid locks while the fill test runs');

// --- 4. STANDARD run path unchanged (moved verbatim) ---
const canRun = gridSrc.slice(gridSrc.indexOf('const canRunManagedTest ='), gridSrc.indexOf('async function requestManagedTest'));
for (const needle of [
  "plan.route === 'standard'",
  '!testing',
  'savedProfileReady',
  '!hasUnsavedChanges',
  'allTempValuesFilled',
  '!grid.busy',
]) {
  assertIncludes(canRun, needle, `STANDARD enable guard: ${needle}`);
}
const requestFn = gridSrc.slice(gridSrc.indexOf('async function requestManagedTest'), gridSrc.indexOf('const specialRunnable ='));
for (const needle of [
  'executeAdminManagedAutofillTest({',
  'savedProfile: existing,',
  'tempCredentials: tempTestValues,',
  'formatManagedFillDiagnosticsForOperator(outcome)',
  "console.info('[A2 ManagedFillDiagnostics]', outcome.fillDiagnostics);",
  'stampAdminTestPassed(grid.fieldAuthoring, mappedIds, configVersion)',
  '...withoutLoginContractKeys(row.metadata),',
  '[AUTOFILL_PROFILE_ACTION_KEY]: \'save\',',
  '[AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: false,',
  '[AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY]: false,',
  'formatAdminManagedTestResultSummary(outcome)',
  "setError('בדיקת המילוי המנוהל נכשלה. נסו שוב.');",
  'await onSaved();',
]) {
  assertIncludes(requestFn, needle, `STANDARD run path: ${needle}`);
}
assertNotIncludes(requestFn, 'tempTestValues[', 'temps never serialized into the stamp write');
assertNotIncludes(gridSrc, 'localStorage', 'temps not persisted (localStorage)');
assertNotIncludes(gridSrc, 'sessionStorage', 'temps not persisted (sessionStorage)');
assertNotIncludes(gridSrc, 'console.log', 'no logging of temps');
console.log('  ✓ STANDARD route = Phase 120.5 path (guards, A2, contract-safe stamp)');

// --- 5. SPECIAL (121.2): only through the shared Hub engine; no direct Ext / plan writes ---
for (const needle of ['sendExtensionMessage', 'chrome.', 'HUB_SPECIAL', 'LOGIN_FLOW_PLAN_META_KEY']) {
  assertNotIncludes(gridSrc, needle, `SPECIAL route never talks to the Ext / plan directly: ${needle}`);
}
const specialFn = gridSrc.slice(gridSrc.indexOf('async function requestSpecialTest'), gridSrc.indexOf('const showTempInputs'));
assertIncludes(specialFn, 'executeAdminSpecialLoginFlowTest({', 'SPECIAL route uses the shared engine wrapper');
assertIncludes(specialFn, "contextChoice: 'special_draft',", 'D-121-43: SPECIAL route always runs the saved mapping (draft)');
assertNotIncludes(gridSrc, "'special_active'", 'D-121-43: the grid never offers the approved plan');
for (const needle of ['updateGlobalRegistryRow', 'stampAdminTestPassed', 'onSaved', 'fieldAuthoring']) {
  assertNotIncludes(specialFn, needle, `SPECIAL route writes nothing: ${needle}`);
}
assertNotIncludes(gridSrc, SPECIAL_COMING_SOON, 'coming-soon note removed');
assertNotIncludes(ctxSrc, SPECIAL_COMING_SOON, 'coming-soon copy removed');
assertIncludes(ctxSrc, `specialPatternLater: '${PATTERN_LATER}'`, 'exact pattern-later copy');
assertNotIncludes(ctxSrc, 'specialDraftDirty:', 'D-121-43: no separate draft-dirty copy');
assertIncludes(ctxSrc, `dirty: '${DIRTY}'`, 'exact dirty copy');
for (const gone of ['contextLabel', 'standardSaved', 'specialDraft:', 'specialActive', 'specialResultContext', 'FILL_TEST_CONTEXT_LABEL_HE', 'fillTestPlanOptions']) {
  assertNotIncludes(ctxSrc, gone, `D-121-43: selector copy / model removed: ${gone}`);
}
for (const gone of ['data-field="fill-test-context"', '<select', 'setContext(']) {
  assertNotIncludes(gridSrc, gone, `D-121-43: no context selector in the grid: ${gone}`);
}
assertIncludes(registrySrc, 'selectedPattern={selectedAuthoringPattern}', 'grid receives the live «אופי הכניסה» selection');

// --- 6. Runtime: route per selected «אופי הכניסה» ---
async function bundle(entry, name, extra = {}) {
  const outfile = join(mkdtempSync(join(tmpdir(), `pv-121ft-${name}-`)), `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: true,
    logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' },
    ...extra,
  });
  return import(pathToFileURL(outfile).href);
}

const ctx = await bundle('src/admin/fillTestContext.ts', 'ctx', { packages: 'external' });
const lc = await bundle('src/loginContract/index.ts', 'lc', { packages: 'external' });
const {
  LOGIN_CONTRACT_ACTIVATION_META_KEY: ACT,
  LOGIN_FLOW_PLAN_META_KEY: PLAN,
  serializeLoginFlowPlanBag,
  resolveActiveLoginContract,
} = lc;

const profile = {
  configVersion: 1,
  supportState: 'not_configured',
  loginEntryUrl: 'https://example.com/login',
  allowedOrigin: 'https://example.com',
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
};
function makeDraft(planVersion = 1) {
  return {
    planVersion,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [
      {
        actionId: 'opener-1',
        kind: 'floating_opener',
        label: 'Open login',
        locatorType: 'css',
        locator: '#open-login',
        approvedForRuntime: true,
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
      },
    ],
    steps: [
      {
        stepId: 'step-credentials',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}

const metaStandard = { autofillProfile: profile };
const metaDraft = { autofillProfile: profile, [PLAN]: serializeLoginFlowPlanBag({ draft: makeDraft(1), active: null }) };
const metaActive = {
  autofillProfile: profile,
  [ACT]: { mode: 'SPECIAL', activePlanVersion: 2 },
  [PLAN]: serializeLoginFlowPlanBag({ draft: makeDraft(2), active: makeDraft(2) }),
};
const metaInvalid = {
  autofillProfile: profile,
  [ACT]: { mode: 'SPECIAL', activePlanVersion: 2 },
  [PLAN]: serializeLoginFlowPlanBag({ draft: makeDraft(3), active: makeDraft(9) }),
};
assert(resolveActiveLoginContract(metaActive).mode === 'SPECIAL', 'fixture: active is SPECIAL');
assert(resolveActiveLoginContract(metaInvalid).mode === 'SPECIAL_INVALID', 'fixture: invalid is SPECIAL_INVALID');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const route = (metadata, selected) => ctx.fillTestRoute(metadata, selected ?? ctx.savedAuthoringPattern(metadata));
let r = route(metaStandard);
assert(r.route === 'standard' && !r.specialInvalid && ctx.savedAuthoringPattern(metaStandard) === 'STANDARD', 'STANDARD saved → STANDARD route');
r = route(metaDraft);
assert(r.route === 'special' && r.specialRunnable && same(r.specialMappedFieldIds, ['username', 'password']), 'saved SPECIAL draft → SPECIAL route (saved draft)');
r = route(metaDraft, 'STANDARD');
assert(r.route === 'standard', 'selected STANDARD → STANDARD route even with a saved draft');
r = route(metaActive);
assert(r.route === 'special' && r.specialRunnable, 'live SPECIAL → SPECIAL route (saved draft; no active choice)');
r = route(metaInvalid);
assert(r.specialInvalid === true, 'SPECIAL_INVALID: note flagged');
r = route({});
assert(r.route === 'standard' && !r.specialPatternLater, 'nothing saved: STANDARD route');
r = route({}, 'FLOATING_SCREEN');
assert(r.route === 'special' && !r.specialRunnable && !r.specialPatternLater, 'selected FLOATING_SCREEN, nothing saved: SPECIAL route, not runnable yet');
r = route(metaDraft, 'FLOATING_SCREEN_MULTI_STEP');
assert(r.route === 'special' && r.specialPatternLater, 'selected FLOATING_SCREEN_MULTI_STEP: pattern-later (121.3: MULTI_STEP runs)');
console.log('  ✓ route per selected «אופי הכניסה» (STANDARD / saved draft / live SPECIAL / SPECIAL_INVALID)');

// --- 7. SSR render per state (API + executor stubbed; no network) ---
const stubPlugin = {
  name: 'stub-io',
  setup(b) {
    b.onResolve({ filter: /adminRegistryApi$/ }, () => ({ path: 'api', namespace: 'stub' }));
    b.onResolve({ filter: /execution\/managedAutofill$/ }, () => ({ path: 'maf', namespace: 'stub' }));
    b.onResolve({ filter: /execution\/specialLoginFlow$/ }, () => ({ path: 'slf', namespace: 'stub' }));
    b.onResolve({ filter: /execution\/specialLoginFlowMessages$/ }, () => ({ path: 'slfm', namespace: 'stub' }));
    b.onLoad({ filter: /^slf$/, namespace: 'stub' }, () => ({
      contents: `
        export async function executeAdminSpecialLoginFlowTest() { throw new Error('no runs in verify'); }
        export function formatSpecialRunDetail() { return ''; }
      `,
      loader: 'js',
    }));
    b.onLoad({ filter: /^slfm$/, namespace: 'stub' }, () => ({
      contents: `export function specialAdminPresentation() { return { kind: 'failure', message: '' }; }`,
      loader: 'js',
    }));
    b.onLoad({ filter: /^api$/, namespace: 'stub' }, () => ({
      contents: 'export async function updateGlobalRegistryRow() { throw new Error("no writes in verify"); }',
      loader: 'js',
    }));
    b.onLoad({ filter: /^maf$/, namespace: 'stub' }, () => ({
      contents: `
        export async function executeAdminManagedAutofillTest() { throw new Error('no runs in verify'); }
        export function formatAdminManagedTestResultSummary() { return ''; }
        export function formatManagedFillDiagnosticsForOperator() { return ''; }
        export function stopAdminFillTest() {}
      `,
      loader: 'js',
    }));
  },
};
const entryDir = mkdtempSync(join(tmpdir(), 'pv-121ft-ssr-src-'));
const entryFile = join(entryDir, 'entry.jsx');
writeFileSync(
  entryFile,
  `import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Grid from ${JSON.stringify(join(root, 'src/admin/AdminFillTestGrid.tsx').replace(/\\/g, '/'))};
export function render(props) { return renderToStaticMarkup(createElement(Grid, props)); }
`,
);
const outSsr = join(mkdtempSync(join(tmpdir(), 'pv-121ft-ssr-')), 'ssr.mjs');
await build({
  entryPoints: [entryFile],
  outfile: outSsr,
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: true,
  jsx: 'automatic',
  logLevel: 'silent',
  nodePaths: [join(root, 'node_modules')],
  define: { 'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"' },
  plugins: [stubPlugin],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
const ssr = await import(pathToFileURL(outSsr).href);

const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
function row(metadata) {
  return { id: 'row-1', updated_at: 't1', login_fields: loginFields, metadata, owner_user_id: null };
}
const cleanGrid = { rowId: 'row-1', hasUnsavedChanges: false, busy: false, inputsLocked: false, fieldAuthoring: [] };
const noop = () => {};
const onSaved = async () => {};
const render = (metadata, managedGrid = cleanGrid, specialDraftDirty = null, selectedPattern = null) =>
  ssr.render({ row: row(metadata), onSaved, managedGrid, specialDraftDirty, selectedPattern, onTestingChange: noop });

let html = render(metaStandard);
assertIncludes(html, 'data-section="fill-test-grid"', 'SSR STANDARD: grid');
assertIncludes(html, 'data-section="managed-test-harness"', 'SSR STANDARD: harness');
assert(count(html, '<option') === 0 && count(html, '<select') === 0, 'SSR STANDARD: no context selector (D-121-43)');
assertIncludes(html, 'data-route="standard"', 'SSR STANDARD: STANDARD route');
assertIncludes(html, 'data-action="managed-test"', 'SSR STANDARD: run button');
assertIncludes(html, 'data-enabled="false"', 'SSR STANDARD: disabled until temps filled');
assertNotIncludes(html, SPECIAL_COMING_SOON, 'SSR STANDARD: no SPECIAL copy');
assertNotIncludes(html, DIRTY, 'SSR STANDARD clean: no dirty note');
assert(count(html, 'data-temp-test-field=') === 2, 'SSR STANDARD: temp input per login field');

html = render(metaStandard, { ...cleanGrid, hasUnsavedChanges: true });
assertIncludes(html, DIRTY, 'SSR STANDARD dirty: exact dirty note');

html = render(metaDraft);
assert(count(html, '<select') === 0, 'SSR draft: no context selector');
assertIncludes(html, 'data-route="special"', 'SSR saved draft: SPECIAL route');
assertNotIncludes(html, SPECIAL_COMING_SOON, 'SSR draft: no coming-soon copy');
html = render(metaDraft, cleanGrid, null, 'STANDARD');
assertIncludes(html, 'data-route="standard"', 'SSR draft + selected STANDARD: STANDARD route');

html = render(metaActive);
assert(count(html, '<select') === 0 && !html.includes('טיוט') && !html.includes('פעילה'), 'SSR active: no selector, no «טיוטה» / «פעילה» labels');
assertNotIncludes(html, SPECIAL_COMING_SOON, 'SSR active default SPECIAL: no coming-soon copy');
assertNotIncludes(html, PATTERN_LATER, 'SSR active FLOATING_SCREEN: runnable, no pattern-later note');
assertIncludes(html, 'data-route="special"', 'SSR active SPECIAL: SPECIAL route');
assertIncludes(html, 'data-enabled="false"', 'SSR active SPECIAL: disabled until mapped temps filled');
assert(count(html, 'data-temp-test-field=') === 2, 'SSR active SPECIAL: temp input per mapped field');

const draftOnly = { [PLAN]: serializeLoginFlowPlanBag({ draft: makeDraft(1), active: null }) };
html = render(draftOnly);
assertIncludes(html, 'data-route="special"', 'SSR draft-only: SPECIAL route');
assertIncludes(html, 'data-enabled="false"', 'SSR draft-only: run disabled until temps');
assertNotIncludes(html, DRAFT_DIRTY, 'SSR draft-only clean: no draft-dirty note');
html = render(draftOnly, cleanGrid, { rowId: 'row-1', dirty: true });
assertIncludes(html, 'data-notice="fill-test-special-draft-dirty"', 'SSR draft dirty: blocked note');
assertIncludes(html, DRAFT_DIRTY, 'SSR draft dirty: exact copy');
html = render(draftOnly, cleanGrid, { rowId: 'other-row', dirty: true });
assertNotIncludes(html, DRAFT_DIRTY, 'SSR draft dirty of another row is ignored');
html = render({}, cleanGrid, { rowId: 'row-1', dirty: true }, 'FLOATING_SCREEN');
assertIncludes(html, 'data-notice="fill-test-special-draft-dirty"', 'SSR SPECIAL selected, nothing saved yet: dirty note (save first)');
assertNotIncludes(html, 'data-action="managed-test"', 'SSR SPECIAL selected, nothing saved: no run');

const oneMapped = makeDraft(1);
oneMapped.steps[0].fieldMappings = [{ fieldId: 'username', locatorType: 'css', locator: '#user' }];
html = render({ [PLAN]: serializeLoginFlowPlanBag({ draft: oneMapped, active: null }) });
assert(count(html, 'data-temp-test-field=') === 1 && html.includes('data-temp-test-field="username"'), 'SSR SPECIAL: temps only for mapped fieldIds');

// 121.3: MULTI_STEP runs; FLOATING_SCREEN_MULTI_STEP is the pattern that stays «בשלב מאוחר יותר».
const later = { ...makeDraft(1), pattern: 'FLOATING_SCREEN_MULTI_STEP' };
html = render({ [PLAN]: serializeLoginFlowPlanBag({ draft: later, active: null }) });
assertIncludes(html, 'data-notice="fill-test-special-pattern-later"', 'SSR FLOATING_SCREEN_MULTI_STEP: pattern-later note');
assertIncludes(html, PATTERN_LATER, 'SSR FLOATING_SCREEN_MULTI_STEP: exact copy');
assertNotIncludes(html, 'data-action="managed-test"', 'SSR FLOATING_SCREEN_MULTI_STEP: not runnable (no run button)');
r = route({ [PLAN]: serializeLoginFlowPlanBag({ draft: later, active: null }) });
assert(r.specialRunnable === false, 'FLOATING_SCREEN_MULTI_STEP draft not runnable');
r = route({ [PLAN]: serializeLoginFlowPlanBag({ draft: { ...makeDraft(1), pattern: 'MULTI_STEP', preambleActions: [] }, active: null }) });
assert(r.specialRunnable === true, 'MULTI_STEP draft runnable (121.3)');
r = route(metaActive);
assert(r.specialRunnable === true, 'FLOATING_SCREEN runnable');
assert(same(r.specialMappedFieldIds, ['username', 'password']), 'mapped fieldIds of the saved draft (all steps)');

html = render(metaInvalid);
assertIncludes(html, 'data-notice="fill-test-special-invalid"', 'SSR SPECIAL_INVALID: fail-closed note');
assertNotIncludes(html, 'פעילה', 'SSR SPECIAL_INVALID: no «פעילה» label');

html = render({});
assertIncludes(html, 'data-section="managed-test-unavailable"', 'SSR nothing saved: unavailable hint');
assertNotIncludes(html, 'data-field="fill-test-context"', 'SSR nothing saved: no selector');

html = render(metaStandard, null);
assertIncludes(html, 'data-enabled="false"', 'SSR: managed grid not reported → run disabled');
console.log('  ✓ SSR per state: no selector; route per «אופי הכניסה»; pattern-later, shared dirty guard; STANDARD guards visible');

// --- 8. Binding: the extension knows nothing about the Admin grid ---
for (const rel of ['extension/background.js', 'extension/manifest.json']) {
  const src = read(rel);
  for (const needle of ['fill-test', 'AdminFillTestGrid', 'special_active', 'FILL_TEST']) {
    assertNotIncludes(src, needle, `${rel}: no ${needle}`);
  }
}
console.log('  ✓ no extension / manifest references to the grid');

// --- 9. D-121-40: SPECIAL result = message + short context line; technical details collapsed ---
const viewSrc = read('src/admin/SpecialTestResultView.tsx');
assertIncludes(gridSrc, '<SpecialTestResultView outcome={specialResult.outcome} at={specialResult.at} />', 'grid renders the SPECIAL result view');
assertNotIncludes(gridSrc, '<details', 'grid itself (STANDARD output) has no collapsed section');
assertNotIncludes(gridSrc, 'special-test-diagnostics', 'SPECIAL diagnostics rendered only by the result view');
assertNotIncludes(viewSrc, '<details open', 'technical section never forced open');
assertIncludes(ctxSrc, "specialTechnicalDetails: 'פרטים טכניים'", 'exact «פרטים טכניים» label');
const managedStructure = gridSrc.slice(gridSrc.indexOf('{testOutcome && !testOutcome.ok ? ('), gridSrc.indexOf(') : specialContext ? ('));
for (const needle of ['data-testid="managed-test-structure"', '[testOutcome.reason, testOutcome.fieldId, testOutcome.detail, testOutcome.locator]']) {
  assertIncludes(managedStructure, needle, `STANDARD result output unchanged: ${needle}`);
}

const { renderView } = await withTempDir('pv-121ft-view-', async (viewDir) => {
  const viewEntry = join(viewDir, 'entry.jsx');
  writeFileSync(
    viewEntry,
    `import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import View from ${JSON.stringify(join(root, 'src/admin/SpecialTestResultView.tsx').replace(/\\/g, '/'))};
export function renderView(props) { return renderToStaticMarkup(createElement(View, props)); }
`,
  );
  const viewOut = join(viewDir, 'view.mjs');
  await build({
    entryPoints: [viewEntry],
    outfile: viewOut,
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: true,
    jsx: 'automatic',
    logLevel: 'silent',
    packages: 'external',
    define: { 'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"' },
  });
  return import(pathToFileURL(viewOut).href);
});

const FILL_OK = 'המילוי הושלם. בדקו את השדות ולחצו על כניסה באתר.';
const diag = {
  runId: 'mfd_rt_1',
  path: 'admin_test',
  stamps: [{ stage: 'assess_resolve', fieldId: 'username', locator: '#user', exactOne: 'exact_one', matchCount: 1 }],
};
function splitHtml(markup) {
  const start = markup.indexOf('<details');
  const end = markup.indexOf('</details>');
  return {
    start,
    end,
    visible: start < 0 ? markup : markup.slice(0, start) + markup.slice(end + '</details>'.length),
    technical: start < 0 ? '' : markup.slice(start, end),
  };
}
const at = '2026-09-28T19:00:00.000Z';
const success = {
  ok: true,
  state: 'STOPPED_FOR_USER',
  stage: 'fill',
  stepId: 'step-credentials',
  actionId: 'opener-1',
  frameKey: 'iframe#login-frame|https://frame.example.test',
  filled: 2,
  userGestureDuringRun: false,
  tabOpened: true,
  extensionUsed: true,
  fillDiagnostics: diag,
  context: 'draft_snapshot',
  planVersion: 3,
  snapshotId: 'snap-7f3a',
};
html = renderView({ outcome: success, at });
let parts = splitHtml(html);
assert(parts.start > 0 && parts.end > parts.start, 'D-121-40 success: collapsed section present');
assertIncludes(parts.visible, FILL_OK, 'D-121-40 success: outcome message visible');
assertIncludes(parts.visible, 'data-result-kind="success"', 'D-121-40 success kind');
const contextLine = parts.visible.slice(parts.visible.indexOf('data-testid="special-test-context"'));
// D-121-43 supersedes the D-121-40 context label: no «טיוטה» / «פעילה»; version moves to the details.
assertNotIncludes(contextLine, 'טיוטה', 'D-121-43 context line: no «טיוטה»');
assertNotIncludes(contextLine, 'גרסה', 'D-121-43 context line: no plan version');
assertIncludes(parts.technical, 'גרסה 3', 'D-121-43: plan version inside «פרטים טכניים»');
assert(count(parts.visible, '<p') === 2, 'D-121-40 visible = message + one context line only');
for (const hidden of ['stamps', 'mfd_rt_1', 'assess_resolve', 'snap-7f3a', 'iframe#login-frame', 'special-test-diagnostics', 'special-test-structure']) {
  assertNotIncludes(parts.visible, hidden, `D-121-40 success: «${hidden}» not visible by default`);
}
assertIncludes(parts.technical, '<summary>פרטים טכניים</summary>', 'D-121-40 summary label');
assert(!/<details[^>]*\sopen/.test(html), 'D-121-40 collapsed section closed by default');
for (const shown of ['data-testid="special-test-diagnostics"', 'stamps', 'mfd_rt_1', 'snap-7f3a', 'fill · iframe#login-frame|https://frame.example.test']) {
  assertIncludes(parts.technical, shown, `D-121-40 technical section keeps: ${shown}`);
}

const failure = {
  ok: false,
  state: 'FAILED',
  stage: 'readiness',
  reason: 'readiness_timeout',
  locator: '#user',
  frameKey: 'top',
  userGestureDuringRun: false,
  tabOpened: true,
  extensionUsed: true,
  context: 'active',
  planVersion: 2,
};
html = renderView({ outcome: failure, at });
parts = splitHtml(html);
assertIncludes(parts.visible, 'data-result-kind="failure"', 'D-121-40 failure kind');
assertIncludes(parts.visible, 'המסך לא נפתח — שדה הכניסה המוגדר לא הופיע בזמן.', 'D-121-40 failure: plain-Hebrew message visible');
assertNotIncludes(parts.visible, 'פעילה', 'D-121-43 failure context line: no «פעילה»');
assertNotIncludes(parts.visible, 'readiness_timeout', 'D-121-40 failure: detail line not visible by default');
assertIncludes(parts.technical, 'readiness · readiness_timeout · #user · top', 'D-121-40 failure: detail line inside the collapsed section');
assertNotIncludes(parts.visible, FILL_OK, 'D-121-40 failure never shows success copy');

html = renderView({ outcome: { ...success, userGestureDuringRun: true }, at });
parts = splitHtml(html);
assertIncludes(parts.visible, 'לא הוכח — נראה שלחצת באתר בזמן הבדיקה.', 'D-121-40 A2 not-proven message visible');
assertNotIncludes(parts.visible, FILL_OK, 'D-121-40 A2 not-proven: no success copy');
console.log('  ✓ D-121-40 SPECIAL result: message + context line visible; details / snapshot / A2 JSON collapsed in «פרטים טכניים» (closed)');

console.log('\nPASS — Phase 121 D-121-38 «בדיקת מילוי» grid (Part A + 121.2 SPECIAL route)');
