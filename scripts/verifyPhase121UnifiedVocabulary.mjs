/**
 * Phase 121 D-121-43 — one Admin vocabulary for every login pattern (UI only).
 * Server-renders the REAL SPECIAL editor, STANDARD «מיפוי אתר רגיל» grid, «אופי הכניסה» grid
 * (status line, D-121-45), «בדיקת מילוי» grid and SPECIAL result view (I/O modules stubbed), and derives the shared status line
 * from rows written through the REAL contract / profile merges. Synthetic fixtures only.
 * Mutations must be caught.
 * Usage: node scripts/verifyPhase121UnifiedVocabulary.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const count = (hay, needle) => hay.split(needle).length - 1;
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
let passCount = 0;
function pass(id, what) {
  passCount += 1;
  console.log(`  ✓ ${id} — ${what}`);
}

const SAVE = 'שמור מיפוי';
const APPROVE = 'אשר מיפוי';
const STRUCTURAL_OK = 'הבדיקה המבנית תקינה.';
const STATUS = {
  saved_not_approved: 'נשמר — עדיין לא אושר למשתמשים',
  approved: 'מאושר למשתמשים',
  changes_not_approved: 'יש שינויים שנשמרו ועדיין לא אושרו',
};
const DIRTY = 'יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.';

// ─── Bundle (real sources; I/O modules replaced by throwing stubs) ─────────────
const STUBBED = ['src/admin/adminRegistryApi.ts'];
function stubFor(rel) {
  const src = read(rel);
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names]
    .map((n) => `export function ${n}() { throw new Error('stubbed in verify: ${n}'); }`)
    .join('\n');
}
const loadBundle = (overrides = {}) => withTempDir('pv-12143-', (outdir) => loadBundleIn(outdir, overrides));

async function loadBundleIn(outdir, overrides) {
  const outfile = join(outdir, 'bundle.mjs');
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const stubbed = new Map(STUBBED.map((rel) => [abs(rel), rel]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const plugin = {
    name: 'verify-overrides',
    setup(b) {
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (stubbed.has(key)) return { contents: stubFor(stubbed.get(key)), loader: 'js' };
        if (overridden.has(key)) {
          return { contents: overridden.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
  await build({
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import SpecialEditor from './src/admin/SpecialLoginDraftEditor.tsx';
        import ManagedEditor from './src/admin/AutofillProfileEditor.tsx';
        import FillTestGrid from './src/admin/AdminFillTestGrid.tsx';
        import ResultView from './src/admin/SpecialTestResultView.tsx';
        import PatternGrid from './src/admin/LoginPatternGrid.tsx';
        export const renderPattern = (p) => renderToStaticMarkup(createElement(PatternGrid, { onPatternChange: () => {}, ...p }));
        export const renderSpecial = (p) => renderToStaticMarkup(createElement(SpecialEditor, p));
        export const renderManaged = (p) => renderToStaticMarkup(createElement(ManagedEditor, p));
        export const renderGrid = (p) => renderToStaticMarkup(createElement(FillTestGrid, p));
        export const renderResult = (p) => renderToStaticMarkup(createElement(ResultView, p));
        export * as status from './src/admin/mappingStatus.ts';
        export * as copy from './src/admin/mappingCopy.ts';
        export * as bar from './src/admin/specialActionBar.ts';
        export * as ctx from './src/admin/fillTestContext.ts';
        export * as lc from './src/loginContract/index.ts';
        export * as vp from './src/autofill/validatedProfile.ts';
      `,
      resolveDir: root,
      loader: 'tsx',
    },
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    plugins: [plugin],
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  });
  return import(pathToFileURL(outfile).href);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://svc.example.test';
const LOGIN_URL = `${ORIGIN}/login`;
const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
function floatingDraft(locator = '#user') {
  return {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [
      {
        actionId: 'opener-1',
        kind: 'floating_opener',
        label: 'Open',
        locatorType: 'css',
        locator: '#open-login',
        approvedForAuthoringContinuation: true,
        approvedForRuntime: true,
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator, timeoutMs: 5000 },
      },
    ],
    steps: [
      {
        stepId: 'step-zz-internal',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
function multiDraft() {
  return {
    planVersion: 1,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      { stepId: 'step-aa-internal', fieldMappings: [] },
      { stepId: 'step-bb-internal', fieldMappings: [] },
    ],
  };
}
function row(metadata, extra = {}) {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: LOGIN_URL,
    updated_at: 't1',
    owner_user_id: null,
    login_fields: loginFields,
    metadata,
    ...extra,
  };
}
const profileMappings = [
  { fieldId: 'username', locatorType: 'css', locator: '#user' },
  { fieldId: 'password', locatorType: 'css', locator: '#pass' },
];
const noop = () => {};
const onSaved = async () => {};

function buttonText(html, action) {
  const at = html.indexOf(`data-action="${action}"`);
  if (at < 0) return null;
  const open = html.lastIndexOf('<button', at);
  const tagEnd = html.indexOf('>', at);
  return { tag: html.slice(open, tagEnd + 1), text: html.slice(tagEnd + 1, html.indexOf('</button>', at)) };
}
function visibleOutsideDetails(html) {
  return html.replace(/<details[\s\S]*?<\/details>/g, '');
}

// ─── Scenarios (each throws on failure; mutations must make one throw) ─────────
function scenarios(m) {
  const { lc, vp, bar, ctx, status, copy } = m;
  const PLAN = lc.LOGIN_FLOW_PLAN_META_KEY;
  const INTENT = lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY;
  const results = [];

  // P1 — copy parity: both editors render the same save / approve / structural / status words.
  {
    const draftMeta = { [PLAN]: lc.serializeLoginFlowPlanBag({ draft: floatingDraft(), active: null }) };
    const special = m.renderSpecial({ row: row(draftMeta), onSaved });
    const profileMeta = vp.mergeAutofillProfileMetadata({
      existingMetadata: {},
      patchMetadata: bar.buildGridProfileMetadataPatch({
        metadata: {},
        action: 'save',
        profilePayload: { fieldMappings: profileMappings, loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldAuthoring: [] },
        liveValidationApproved: false,
        managedReadinessProbePassed: false,
      }),
      loginFields,
      loginUrl: LOGIN_URL,
    });
    assert(profileMeta.ok, 'fixture: STANDARD save merges');
    const managed = m.renderManaged({ row: row(profileMeta.metadata), onSaved });
    const sSave = buttonText(special, 'save-special-draft');
    const mSave = buttonText(managed, 'save');
    const sApprove = buttonText(special, 'activate-special');
    const mApprove = buttonText(managed, 'approve');
    assert(sSave && mSave && sSave.text === SAVE && mSave.text === SAVE, `save label parity (${sSave?.text} / ${mSave?.text})`);
    assert(sApprove && mApprove && sApprove.text === APPROVE && mApprove.text === APPROVE, `approve label parity (${sApprove?.text} / ${mApprove?.text})`);
    assert(copy.ADMIN_MAPPING_COPY_HE.save === SAVE && copy.ADMIN_MAPPING_COPY_HE.approve === APPROVE, 'shared copy module holds the labels');
    for (const p of ['FLOATING_SCREEN', 'MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP']) {
      assert(bar.SPECIAL_ACTIVATE_LABEL_HE[p] === APPROVE, `SPECIAL approve label for ${p}`);
    }
    assert(special.includes(STRUCTURAL_OK) && managed.includes(STRUCTURAL_OK), 'same completeness wording in both editors');
    // D-121-45: the status line + «פרטים טכניים» moved to the «אופי הכניסה» grid (superseded: per-editor line).
    const sLine = m.renderPattern({ row: row(draftMeta), pattern: 'FLOATING_SCREEN' });
    const mLine = m.renderPattern({ row: row(profileMeta.metadata), pattern: 'STANDARD' });
    for (const [html, name] of [[sLine, 'SPECIAL'], [mLine, 'STANDARD']]) {
      assert(count(html, 'data-status="mapping-status"') === 1, `${name}: one shared status line`);
      assert(html.includes(STATUS.saved_not_approved) && html.includes('data-mapping-status="saved_not_approved"'), `${name}: saved → «${STATUS.saved_not_approved}»`);
      assert(html.includes('data-section="mapping-technical"') && !/<details[^>]*\sopen/.test(html), `${name}: «פרטים טכניים» collapsed`);
    }
    for (const [html, name] of [[special, 'SPECIAL'], [managed, 'STANDARD']]) {
      assert(!html.includes('data-status="mapping-status"') && !html.includes('data-section="mapping-technical"'), `${name} grid: no second status line`);
    }
    const sVisible = visibleOutsideDetails(sLine);
    assert(!sVisible.includes(LOGIN_URL) && !sVisible.includes('משטח כניסה') && !sVisible.includes('פעיל כעת'), 'SPECIAL: entry surface / URL / active version only inside «פרטים טכניים»');
    assert(!visibleOutsideDetails(mLine).includes('מצב תמיכה') && mLine.includes('מצב תמיכה'), 'STANDARD: support state only inside «פרטים טכניים»');
    for (const old of ['טיוט', 'הופעל', '(DRAFT)', 'בדוק שהטיוטה מלאה', 'הפעל כניסה']) {
      assert(!special.includes(old), `SPECIAL editor render has no «${old}»`);
    }
    assert(special.includes('>מיפוי מסך צף</h3>') && special.includes('<h4>מיפוי שדות</h4>'), 'SPECIAL title / section renamed');
    assert(!special.includes('data-action="validate-draft-snapshot"'), '«בדוק שהטיוטה מלאה» button removed');
    results.push(['P1', 'copy parity: «שמור מיפוי» / «אשר מיפוי» / structural line identical in both editors; one status line per pattern in «אופי הכניסה»; technical fields collapsed; no «טיוטה» / «הופעל» / «(DRAFT)»']);
  }

  // P2 — completeness line automatic; «אשר מיפוי» disabled while incomplete.
  {
    const incomplete = floatingDraft();
    incomplete.steps[0].fieldMappings = [];
    const html = m.renderSpecial({ row: row({ [PLAN]: lc.serializeLoginFlowPlanBag({ draft: incomplete, active: null }) }), onSaved });
    const line = html.slice(html.indexOf('data-status="mapping-completeness"') - 40);
    assert(line.startsWith('<p class="admin-error" role="status"', line.indexOf('<p')), 'incomplete → red status line (STANDARD structural style)');
    assert(html.includes('המיפוי לא מלא:'), 'incomplete wording «המיפוי לא מלא: …»');
    assert(/disabled=""/.test(buttonText(html, 'activate-special').tag), '«אשר מיפוי» disabled while incomplete');
    const ok = m.renderSpecial({ row: row({ [PLAN]: lc.serializeLoginFlowPlanBag({ draft: floatingDraft(), active: null }) }), onSaved });
    assert(ok.includes(`<p class="admin-muted" data-status="mapping-completeness">${STRUCTURAL_OK}</p>`), 'complete → gray «הבדיקה המבנית תקינה.»');
    assert(!/disabled=""/.test(buttonText(ok, 'activate-special').tag), '«אשר מיפוי» enabled when complete');
    results.push(['P2', 'automatic completeness line (gray OK / red incomplete); «אשר מיפוי» disabled while incomplete']);
  }

  // P3 — «שלב נוכחי» only for multi-step patterns; labels «שלב N», never the stepId.
  {
    for (const [p, want] of [['STANDARD', false], ['FLOATING_SCREEN', false], ['MULTI_STEP', true], ['FLOATING_SCREEN_MULTI_STEP', true]]) {
      assert(bar.stepSelectorVisible(p) === want, `stepSelectorVisible(${p}) = ${want}`);
    }
    const single = m.renderSpecial({ row: row({ [PLAN]: lc.serializeLoginFlowPlanBag({ draft: floatingDraft(), active: null }) }), onSaved });
    assert(!single.includes('שלב נוכחי') && !single.includes('שלבי התהליך') && !single.includes('data-panel="steps-sidebar"'), 'FLOATING_SCREEN: no step selection');
    assert(!single.includes('step-zz-internal'), 'FLOATING_SCREEN: stepId never shown');
    assert(single.includes('<code dir="ltr">#user</code>'), 'FLOATING_SCREEN: steps[0] mappings shown silently');
    const multi = m.renderSpecial({ row: row({ [PLAN]: lc.serializeLoginFlowPlanBag({ draft: multiDraft(), active: null }) }), onSaved });
    assert(multi.includes('שלבי התהליך') && multi.includes('data-panel="steps-sidebar"') && !multi.includes('<select'), 'MULTI_STEP: «שלבי התהליך» step selection shown (no «שלב נוכחי» select)');
    assert(multi.includes('>שלב 1</span>') && multi.includes('>שלב 2</span>'), 'MULTI_STEP: labels «שלב 1» / «שלב 2»');
    assert(!multi.includes('>step-aa-internal<') && !multi.includes('>step-bb-internal<'), 'MULTI_STEP: step label never the stepId');
    results.push(['P3', '«שלבי התהליך» only for multi-step patterns; «שלב 1 / שלב 2»; stepId never shown; single-step uses steps[0]']);
  }

  // P4 — «בדיקת מילוי»: no selector; saved mapping of the selected «אופי הכניסה»; dirty guard; no labels.
  {
    const cleanGrid = { rowId: 'row-1', hasUnsavedChanges: false, busy: false, inputsLocked: false, fieldAuthoring: [] };
    const profile = { configVersion: 1, supportState: 'not_configured', loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldMappings: profileMappings };
    const both = {
      autofillProfile: profile,
      [lc.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
      [PLAN]: lc.serializeLoginFlowPlanBag({ draft: floatingDraft(), active: floatingDraft() }),
    };
    const grid = (props) => m.renderGrid({ row: row(both), onSaved, managedGrid: cleanGrid, onTestingChange: noop, ...props });
    for (const [selectedPattern, routeWant] of [[null, 'special'], ['FLOATING_SCREEN', 'special'], ['STANDARD', 'standard']]) {
      const html = grid({ selectedPattern });
      assert(count(html, '<select') === 0 && count(html, '<option') === 0, `grid (${selectedPattern}): no context selector`);
      assert(html.includes(`data-route="${routeWant}"`), `grid (${selectedPattern}): ${routeWant} route`);
      assert(!html.includes('טיוט') && !html.includes('פעילה'), `grid (${selectedPattern}): no «טיוטה» / «פעילה»`);
    }
    assert(ctx.fillTestRoute(both, 'STANDARD').route === 'standard' && ctx.fillTestRoute(both, 'FLOATING_SCREEN').route === 'special', 'route follows the selected «אופי הכניסה»');
    const dirty = grid({ selectedPattern: 'FLOATING_SCREEN', specialDraftDirty: { rowId: 'row-1', dirty: true } });
    assert(dirty.includes(DIRTY) && dirty.includes('data-notice="fill-test-special-draft-dirty"'), 'SPECIAL dirty guard = shared wording');
    const stdDirty = grid({ selectedPattern: 'STANDARD', managedGrid: { ...cleanGrid, hasUnsavedChanges: true } });
    assert(stdDirty.includes(DIRTY), 'STANDARD dirty guard wording unchanged');
    const laterDraft = { ...multiDraft(), pattern: 'FLOATING_SCREEN_MULTI_STEP' };
    const later = ctx.fillTestRoute({ [PLAN]: lc.serializeLoginFlowPlanBag({ draft: laterDraft, active: null }) }, 'FLOATING_SCREEN_MULTI_STEP');
    assert(later.specialRunnable === false && later.specialPatternLater === true, 'runnable-pattern gating (121.3: FLOATING_SCREEN + MULTI_STEP; FSMS later)');
    const result = m.renderResult({
      outcome: { ok: true, userGestureDuringRun: false, tabOpened: true, extensionUsed: true, stage: 'fill', context: 'draft_snapshot', planVersion: 4 },
      at: '2026-09-28T19:00:00.000Z',
    });
    const visible = visibleOutsideDetails(result);
    assert(!visible.includes('טיוטה') && !visible.includes('פעילה') && !visible.includes('גרסה'), 'result: no «טיוטה» / «פעילה» label; version collapsed');
    assert(result.includes('גרסה 4'), 'result: version kept inside «פרטים טכניים»');
    results.push(['P4', '«בדיקת מילוי»: no selector; route = selected «אופי הכניסה» (saved mapping); shared dirty guard; gating unchanged; result without «טיוטה» / «פעילה»']);
  }

  // P5 — status-line truth table on rows written through the REAL merges.
  {
    const S = status.specialMappingStatus;
    const T = status.standardMappingStatus;
    const saveSpecial = (meta, draft) => {
      const r = lc.mergeLoginContractMetadata({ existingMetadata: meta, patchMetadata: { [PLAN]: { draft } } });
      assert(r.ok, `fixture: SPECIAL save merges (${r.message})`);
      return r.metadata;
    };
    const approveSpecial = (meta, draft) => {
      const live = lc.resolveActiveLoginContract(meta).mode;
      const r = lc.mergeLoginContractMetadata({
        existingMetadata: meta,
        patchMetadata: { [PLAN]: { draft }, [INTENT]: { transition: live === 'SPECIAL' ? 'SPECIAL_TO_SPECIAL' : 'STANDARD_TO_SPECIAL', draft } },
      });
      assert(r.ok, `fixture: SPECIAL approve merges (${r.message})`);
      return r.metadata;
    };
    assert(S({}) === null, 'SPECIAL nothing saved → no status');
    let meta = saveSpecial({}, floatingDraft());
    assert(S(meta) === 'saved_not_approved', 'SPECIAL saved, never approved → «נשמר — עדיין לא אושר למשתמשים»');
    meta = approveSpecial(meta, floatingDraft());
    assert(S(meta) === 'approved', 'SPECIAL approved → «מאושר למשתמשים»');
    meta = saveSpecial(meta, floatingDraft('#user-2'));
    assert(S(meta) === 'changes_not_approved', 'SPECIAL changed after approval → «יש שינויים שנשמרו ועדיין לא אושרו»');
    assert(lc.resolveActiveLoginContract(meta).mode === 'SPECIAL', 'users keep the previously approved SPECIAL plan (unchanged behavior)');
    meta = approveSpecial(meta, floatingDraft('#user-2'));
    assert(lc.resolveActiveLoginContract(meta).activePlanVersion === 2, 'fixture: re-approval bumped the version');
    assert(S(meta) === 'approved', 'SPECIAL re-approved (version bumped) → «מאושר למשתמשים»');
    const invalid = { ...meta, [lc.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 99 } };
    assert(lc.resolveActiveLoginContract(invalid).mode === 'SPECIAL_INVALID' && S(invalid) === 'saved_not_approved', 'SPECIAL_INVALID → not approved for users');

    const write = (existing, action, extra = {}) => {
      const r = vp.mergeAutofillProfileMetadata({
        existingMetadata: existing,
        patchMetadata: bar.buildGridProfileMetadataPatch({
          metadata: existing,
          action,
          profilePayload: { fieldMappings: extra.mappings ?? profileMappings, loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldAuthoring: [] },
          liveValidationApproved: action === 'activate_validated',
          managedReadinessProbePassed: action === 'activate_validated',
        }),
        loginFields,
        loginUrl: LOGIN_URL,
      });
      assert(r.ok, `fixture: STANDARD ${action} merges (${r.message})`);
      return r.metadata;
    };
    assert(T({}) === null, 'STANDARD nothing saved → no status');
    let std = write({}, 'save');
    assert(T(std) === 'saved_not_approved', 'STANDARD saved → «נשמר — עדיין לא אושר למשתמשים»');
    std = write(std, 'activate_validated');
    assert(T(std) === 'approved', 'STANDARD approved → «מאושר למשתמשים»');
    const changed = write(std, 'save', { mappings: [profileMappings[0], { ...profileMappings[1], locator: '#pass-2' }] });
    assert(vp.readAutofillProfileFromMetadata(changed).supportState === 'unsupported', 'fixture: STANDARD change after approval stops users (Phase 120, unchanged)');
    assert(T(changed) === 'saved_not_approved', 'STANDARD changed after approval → «נשמר — עדיין לא אושר למשתמשים» (real state)');
    assert(T(write(std, 'disable_unsupported')) === 'saved_not_approved', '«הגדר כלא נתמך» → not approved');
    const liveSpecial = { ...std, [lc.LOGIN_CONTRACT_ACTIVATION_META_KEY]: meta[lc.LOGIN_CONTRACT_ACTIVATION_META_KEY], [PLAN]: meta[PLAN] };
    assert(lc.resolveActiveLoginContract(liveSpecial).mode === 'SPECIAL' && T(liveSpecial) === 'saved_not_approved', 'validated STANDARD while users get SPECIAL → not approved');
    const cleared = write(std, 'clear_managed_mappings', { mappings: [] });
    assert(T(cleared) === null, 'STANDARD cleared → no status');
    assert(copy.ADMIN_MAPPING_STATUS_HE.saved_not_approved === STATUS.saved_not_approved && copy.ADMIN_MAPPING_STATUS_HE.approved === STATUS.approved && copy.ADMIN_MAPPING_STATUS_HE.changes_not_approved === STATUS.changes_not_approved, 'status words exact');
    // Rendered: the line shows exactly the derived state.
    const approvedHtml = m.renderPattern({ row: row(meta), pattern: 'FLOATING_SCREEN' });
    assert(approvedHtml.includes(STATUS.approved) && !approvedHtml.includes(STATUS.saved_not_approved), '«אופי הכניסה» grid renders the derived SPECIAL status');
    const changedHtml = m.renderPattern({ row: row(changed), pattern: 'STANDARD' });
    assert(changedHtml.includes(STATUS.saved_not_approved) && !changedHtml.includes(STATUS.approved), '«אופי הכניסה» grid renders the derived STANDARD status');
    results.push(['P5', 'status truth table via the real merges: SPECIAL none / saved / approved / changed / re-approved / invalid; STANDARD none / saved / approved / changed→saved / unsupported / live SPECIAL / cleared']);
  }
  return results;
}

// ─── Static: scope ────────────────────────────────────────────────────────────
function staticChecks() {
  const special = read('src/admin/SpecialLoginDraftEditor.tsx');
  const managed = read('src/admin/AutofillProfileEditor.tsx');
  assert(read('src/admin/LoginPatternGrid.tsx').includes('<MappingStatusLine'), '«אופי הכניסה» grid renders the shared status line');
  for (const [src, name] of [[special, 'SPECIAL'], [managed, 'STANDARD']]) {
    assert(src.includes("from './mappingCopy'") && !src.includes('<MappingStatusLine'), `${name} uses the shared copy module; status line lives in «אופי הכניסה»`);
    assert(!src.includes(`'${SAVE}'`) && !src.includes(`>\n          ${SAVE}\n`) && !src.includes(`'${APPROVE}'`), `${name}: no local save / approve literal`);
  }
  assert(managed.includes("data-action=\"clear\"") && managed.includes("data-action=\"unsupported\""), 'STANDARD «נקה מיפוי» / «הגדר כלא נתמך» kept');
  for (const a of ['special-visual-opener', 'special-visual-transition', 'authoring-continue-click', 'approve-frame']) {
    assert(special.includes(`data-action="${a}"`), `SPECIAL-only control kept: ${a}`);
  }
  const touched = ['src/admin/mappingCopy.ts', 'src/admin/mappingStatus.ts', 'src/admin/MappingStatusLine.tsx', 'src/admin/fillTestContext.ts', 'src/admin/AdminFillTestGrid.tsx', 'src/admin/SpecialLoginDraftEditor.tsx', 'src/admin/specialActionBar.ts', 'src/admin/LoginPatternGrid.tsx'];
  for (const rel of touched) {
    const src = read(rel).toLowerCase();
    for (const needle of ['hostname', 'serviceid ===', 'super-pharm', 'superpharm', 'pagi', 'mizrahi', '.co.il']) {
      assert(!src.includes(needle), `${rel}: no site branch (${needle})`);
    }
  }
  const status = read('src/admin/mappingStatus.ts');
  assert(!status.includes('updateGlobalRegistryRow') && !status.includes('useState'), 'status derivation is read-only');
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(['tabs', 'scripting']), 'manifest permissions unchanged');
  for (const rel of ['extension/background.js', 'extension/generic/validated-autofill.js']) {
    const src = read(rel);
    for (const needle of ['שמור מיפוי', 'mappingStatus', 'MappingStatusLine']) {
      assert(!src.includes(needle), `${rel}: untouched by D-121-43 (${needle})`);
    }
  }
}

console.log('Phase 121 D-121-43 — one Admin vocabulary for every login pattern\n');
const base = await loadBundle();
for (const [id, what] of scenarios(base)) pass(id, what);
staticChecks();
pass('S1', 'static: both editors import the shared copy + status line; retained controls; no site branches; extension / manifest untouched');

// ─── Mutations ────────────────────────────────────────────────────────────────
console.log('\nMutations');
const MUT = [
  ['M1 status ignores the version assigned on approval', 'src/admin/mappingStatus.ts', 'return JSON.stringify({ ...serialized, planVersion: 0 });', 'return JSON.stringify(serialized);'],
  ['M2 STANDARD status ignores the live contract', 'src/admin/mappingStatus.ts', " && resolveActiveLoginContract(metadata ?? {}).mode === 'STANDARD'", ''],
  ['M3 STANDARD changed-after-approval reads as approved', 'src/admin/mappingStatus.ts', 'isVersionMatchedValidated(profile) &&', "profile.supportState !== 'not_configured' &&"],
  ['M4 step selector for every pattern', 'src/admin/specialActionBar.ts', "export function stepSelectorVisible(pattern: string): boolean {\n  return pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP';", "export function stepSelectorVisible(pattern: string): boolean {\n  return pattern !== 'STANDARD';"],
  ['M5 step label shows the stepId', 'src/admin/specialStepsSidebar.ts', '      label: stepLabelHe(index),', '      label: step.stepId,'],
  ['M6 fill-test route ignores the selected pattern', 'src/admin/fillTestContext.ts', "isSpecialLoginPattern(selectedPattern) ? 'special'", "isSpecialLoginPattern(savedAuthoringPattern(metadata)) ? 'special'"],
  ['M7 SPECIAL save label drifts from the shared copy', 'src/admin/specialActionBar.ts', 'saveDraft: ADMIN_MAPPING_COPY_HE.save,', "saveDraft: 'שמור טיוטה',"],
  ['M8 «אשר מיפוי» enabled while incomplete', 'src/admin/SpecialLoginDraftEditor.tsx', 'disabled={busy || draftDirty || !draftCheck.complete || !approveGate.allowed}', 'disabled={busy || draftDirty}'],
  ['M9 SPECIAL dirty guard dropped', 'src/admin/AdminFillTestGrid.tsx', '    specialDraftDirty.dirty;', '    false;'],
  ['M10 result shows «טיוטה» again', 'src/admin/SpecialTestResultView.tsx', "{new Date(at).toLocaleString('he-IL')}", "{['טיוטה', new Date(at).toLocaleString('he-IL')].join(' · ')}"],
];
for (const [label, rel, from, to] of MUT) {
  const mutated = replaceOnce(readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n'), from, to, label);
  const m = await loadBundle({ [rel]: mutated });
  let caught = null;
  try {
    scenarios(m);
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}

console.log(`\nPASS — D-121-43 verify: ${passCount} checks, ${MUT.length} mutations caught`);
process.exit(0);
