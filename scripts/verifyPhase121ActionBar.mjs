/**
 * Phase 121.1 D-121-30 (arch-phase121.md §4.11) — SPECIAL editor action bar.
 * Evidence: exact plain-Hebrew labels per pattern, draft-check copy, ACTIVATE disabled
 * on an incomplete draft (A1 first), in-app confirm (cancel writes nothing, confirm
 * writes the unchanged intent), ACTIVATE STANDARD removed, regular-grid return path
 * (live SPECIAL / SPECIAL_INVALID → SPECIAL_TO_STANDARD intent + dialog (A3); live
 * STANDARD → payload unchanged, no dialog), old-string sweep.
 * Usage: node scripts/verifyPhase121ActionBar.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const assertIncludes = (hay, needle, message) => assert(hay.includes(needle), message);
const assertNotIncludes = (hay, needle, message) => assert(!hay.includes(needle), message);

const loadModule = (entry, name) => withTempDir(`pv-121ab-${name}-`, (outdir) => loadModuleIn(outdir, entry, name));
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

console.log('Phase 121.1 D-121-30 — SPECIAL editor action bar verification\n');

const bar = await loadModule('src/admin/specialActionBar.ts', 'bar');
const C = await loadModule('src/loginContract/index.ts', 'contract');
const uiSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const gridSrc = read('src/admin/AutofillProfileEditor.tsx');
const barSrc = read('src/admin/specialActionBar.ts');

// ─── 1. Exact labels / copy (D-121-43 supersedes the D-121-30 wording) ─────
{
  const exact = {
    saveDraft: 'שמור מיפוי',
    explanation:
      'שמור מיפוי — שומר את העבודה לבדיקה ב«בדיקת מילוי», המשתמשים לא מושפעים. אשר מיפוי — המשתמשים יקבלו את המיפוי הזה במקום המיפוי הקודם.',
    draftComplete: 'הבדיקה המבנית תקינה.',
    activateConfirmYes: 'אשר מיפוי',
    cancel: 'ביטול',
  };
  for (const [k, v] of Object.entries(exact)) assert(bar.SPECIAL_ACTION_BAR_HE[k] === v, `SPECIAL_ACTION_BAR_HE.${k} exact`);
  assert(!('checkDraft' in bar.SPECIAL_ACTION_BAR_HE), 'D-121-43: «בדוק שהטיוטה מלאה» label removed');
  assert(
    bar.SPECIAL_ACTION_BAR_HE.activateConfirmBody('האתר') ===
      'לאחר האישור המשתמשים יקבלו את המיפוי הזה להאתר. מילוי אוטומטי לשירות זה יפעל רק אחרי השלמת שלב ההפעלה אצל המשתמשים.',
    'confirm body exact (service name)',
  );
  const labels = {
    FLOATING_SCREEN: 'אשר מיפוי',
    MULTI_STEP: 'אשר מיפוי',
    FLOATING_SCREEN_MULTI_STEP: 'אשר מיפוי',
  };
  assert(JSON.stringify(bar.SPECIAL_ACTIVATE_LABEL_HE) === JSON.stringify(labels), 'activate label = «אשר מיפוי» for every pattern');
  assert(bar.GRID_SPECIAL_TO_STANDARD_HE.confirm === 'השירות פועל כרגע עם תהליך כניסה מיוחד. להחליף אותו במיפוי הרגיל לכל המשתמשים?', 'grid switch confirm exact');
  assert(bar.GRID_SPECIAL_TO_STANDARD_HE.confirmYes === 'החלף' && bar.GRID_SPECIAL_TO_STANDARD_HE.cancel === 'ביטול', 'grid switch buttons exact');
  for (const v of [bar.SPECIAL_ACTION_BAR_HE.saveDraft, ...Object.values(labels), bar.SPECIAL_ACTION_BAR_HE.activateConfirmYes, bar.SPECIAL_ACTION_BAR_HE.cancel, bar.SPECIAL_ACTION_BAR_HE.explanation]) {
    assert(!/[A-Za-z]/.test(v), `no English in action-bar label: ${v}`);
  }
  assert(bar.draftIncompleteMessageHe('חסר שלב.') === 'המיפוי לא מלא: חסר שלב.', 'incomplete copy: «המיפוי לא מלא: <חסר>.» (single final period)');
}
console.log('  ✓ 1. exact labels (D-121-43 vocabulary), explanation, completeness and dialog copy; no English');

// ─── 2. Draft check = A1 normalization + snapshot validator; gate ──────────
function completeDraft() {
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
        approvedForRuntime: true,
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
      },
    ],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
{
  const ok = bar.checkSpecialDraft(completeDraft());
  assert(ok.complete === true && ok.message === 'הבדיקה המבנית תקינה.', 'complete → «הבדיקה המבנית תקינה.»');
  const empty = C.ensureSpecialDraft('MULTI_STEP', null);
  const bad = bar.checkSpecialDraft(empty);
  // D-121-67 D: the validator Hebrew is prefixed with the place (here «שלב 1»).
  const expectedDetail = `שלב 1: ${C.draftCompletenessPreview(empty).message}`;
  assert(bad.complete === false && bad.message === bar.draftIncompleteMessageHe(expectedDetail), 'incomplete → «המיפוי לא מלא: <place>: <validator Hebrew>.»');
  assert(bar.checkSpecialDraft(null).complete === false, 'no draft → incomplete');
  // A1: legacy opener-self readiness + mapped step → complete after normalization (raw validator rejects).
  const legacy = completeDraft();
  legacy.preambleActions[0].readiness.locator = '#open-login';
  assert(C.validateSpecialPlanComplete(legacy).ok === false, 'raw legacy draft fails validator (readinessIsSelf)');
  const a1 = bar.checkSpecialDraft(legacy);
  assert(a1.complete === true && a1.normalized.preambleActions[0].readiness.locator !== '#open-login', 'gate applies A1 normalization before the validator');
  // Editor wiring: one shared check for the automatic completeness line and the approve gate.
  assertIncludes(uiSrc, 'const draftCheck = useMemo(() => checkSpecialDraft(draft), [draft]);', 'editor computes draftCheck with the shared check');
  // D-121-43 supersedes the D-121-37 button feedback: button removed; automatic line
  // in the STANDARD structural-line style (gray when complete, red role=status otherwise).
  {
    assertNotIncludes(uiSrc, 'function validateSnapshot', 'D-121-43: manual draft-check handler removed');
    assertNotIncludes(uiSrc, 'data-action="validate-draft-snapshot"', 'D-121-43: «בדוק שהטיוטה מלאה» button removed');
    assertNotIncludes(uiSrc, 'snapshotTokenRef', 'no draft-check token left');
    assertIncludes(uiSrc, '{draftCheck.complete ? (\n            <p className="admin-muted" data-status="mapping-completeness">\n              {draftCheck.message}', 'complete → gray line (as «הבדיקה המבנית תקינה.»)');
    assertIncludes(uiSrc, '<p className="admin-error" role="status" data-status="mapping-completeness">\n              {draftCheck.message}', 'incomplete → red status line');
    assertNotIncludes(uiSrc, 'snapshotNote', 'gray snapshotNote line removed');
    assertIncludes(uiSrc, '<p className="admin-error" role="alert">\n          {error}', 'error renders as red alert');
    assertIncludes(uiSrc, '<p className="admin-success" role="status">\n          {success}', 'success renders as green status');
    assertIncludes(barSrc, 'draftComplete: ADMIN_MAPPING_COPY_HE.structuralOk,', 'complete copy = shared structural line');
  }
}
console.log('  ✓ 2. completeness: complete / incomplete copy, A1 before validator, shared by the automatic line + gate (D-121-43: button removed)');

// ─── 3. Editor action bar + ACTIVATE confirmation ──────────────────────────
function buttonFor(src, action) {
  const at = src.indexOf(`data-action="${action}"`);
  if (at < 0) return null;
  return src.slice(src.lastIndexOf('<button', at), src.indexOf('</button>', at));
}
{
  assert(buttonFor(uiSrc, 'validate-draft-snapshot') === null, 'D-121-43: no check button');
  const save = buttonFor(uiSrc, 'save-special-draft');
  assert(save && save.includes('{SPECIAL_ACTION_BAR_HE.saveDraft}'), 'save button label = «שמור מיפוי»');
  const act = buttonFor(uiSrc, 'activate-special');
  assert(act && act.includes('{SPECIAL_ACTIVATE_LABEL_HE[pattern as SpecialLoginPattern]}'), 'activate label follows selected pattern');
  // 121.3 G11 adds the saved-draft runtime gate to the same expression.
  assert(
    act.includes('disabled={busy || draftDirty || !draftCheck.complete || !approveGate.allowed}'),
    'activate disabled while draft incomplete, unsaved, or not runnable (D-121-43 C1 + 121.3 G11)',
  );
  assert(act.includes('onClick={requestActivateSpecial}'), 'activate button only requests confirmation');
  assertIncludes(uiSrc, '{SPECIAL_ACTION_BAR_HE.explanation}', 'explanation line rendered');
  const explAt = uiSrc.indexOf('data-panel="action-bar-explanation"');
  assert(explAt > uiSrc.indexOf('data-action="activate-special"'), 'explanation line under the bar');
  assert(!/title=|data-tooltip|tooltip/i.test(uiSrc.slice(explAt - 200, explAt + 200)), 'explanation always visible (no tooltip)');
  // Confirmation flow.
  const request = fnBody(uiSrc, 'function requestActivateSpecial');
  assert(request.includes('setActivateConfirmOpen(true)') && !request.includes('activateSpecial()') && !request.includes('updateGlobalRegistryRow'), 'request opens dialog only');
  assert(request.includes('!draftCheck.complete') && request.includes('draftDirty'), 'request re-checks completeness + unsaved changes');
  const cancel = fnBody(uiSrc, 'function cancelActivateSpecial');
  assert(cancel.includes('setActivateConfirmOpen(false)') && !cancel.includes('activateSpecial') && !cancel.includes('updateGlobalRegistryRow'), '«ביטול» closes dialog, writes nothing');
  const confirm = fnBody(uiSrc, 'function confirmActivateSpecial');
  assert(confirm.includes('void activateSpecial()'), '«הפעל» runs the unchanged activate write');
  assert((uiSrc.match(/(?<!function )\bactivateSpecial\(\)/g) || []).length === 1, 'activateSpecial() called from the confirm handler only');
  const dialogAt = uiSrc.indexOf('data-panel="special-activate-confirm"');
  const dialog = uiSrc.slice(dialogAt, uiSrc.indexOf('</div>\n        </div>', dialogAt));
  assert(dialogAt > 0 && dialog.includes('{approveConfirmTitleHe(serviceDisplayName)}') && dialog.includes('{SPECIAL_ACTION_BAR_HE.activateConfirmBody(serviceDisplayName)}'), 'in-app dialog: STANDARD approve pattern (title with service name + body)');
  assert(dialog.includes('data-action="cancel-activate-special"') && dialog.includes('onClick={cancelActivateSpecial}') && dialog.includes('{SPECIAL_ACTION_BAR_HE.cancel}'), 'dialog «ביטול»');
  assert(dialog.includes('data-action="confirm-activate-special"') && dialog.includes('onClick={confirmActivateSpecial}') && dialog.includes('{SPECIAL_ACTION_BAR_HE.activateConfirmYes}'), 'dialog «אשר מיפוי»');
  assertNotIncludes(uiSrc, 'window.confirm', 'no window.confirm in SPECIAL editor');
  // The activate intent itself is unchanged.
  const activate = fnBody(uiSrc, 'async function activateSpecial');
  assertIncludes(activate, 'const normalized = normalizeLegacyDraftReadiness(saved);', 'activate: A1 normalization unchanged, applied to the saved draft (D-121-43 C1)');
  assertIncludes(activate, "activeResolved.mode === 'SPECIAL' ? 'SPECIAL_TO_SPECIAL' : 'STANDARD_TO_SPECIAL'", 'activate: transition unchanged');
  assertIncludes(activate, '[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: {\n            transition,\n            draft: normalized,', 'activate: intent payload unchanged');
  // ACTIVATE STANDARD removed.
  for (const gone of ['activate-standard', 'activateStandard', 'SPECIAL_TO_STANDARD', 'STANDARD_TO_STANDARD', 'autofillProfileAction']) {
    assertNotIncludes(uiSrc, gone, `SPECIAL editor no longer contains ${gone}`);
  }
}
console.log('  ✓ 3. editor: labels, explanation, activate gated + in-app confirm (cancel writes nothing), intent unchanged, STANDARD activation removed');

// ─── 4. Regular grid: return path SPECIAL → STANDARD ──────────────────────
{
  const loginFields = [
    { id: 'username', label: 'User', type: 'text', required: true },
    { id: 'password', label: 'Pass', type: 'password', required: true },
  ];
  const profilePayload = {
    fieldMappings: [
      { fieldId: 'username', locatorType: 'css', locator: '#user' },
      { fieldId: 'password', locatorType: 'css', locator: '#pass' },
    ],
    loginEntryUrl: 'https://example.test/login',
    allowedOrigin: 'https://example.test',
    fieldAuthoring: [],
  };
  const standardMeta = { other: 1 };
  // Live STANDARD: exactly the Phase 120 object (same keys, same order, no intent).
  const legacy = (metadata, action, live, probe) => ({
    ...metadata,
    autofillProfile: profilePayload,
    autofillProfileAction: action,
    autofillLiveValidationApproved: live,
    autofillManagedReadinessProbePassed: probe,
  });
  for (const action of ['activate_validated', 'save', 'clear_managed_mappings', 'disable_unsupported']) {
    const live = action === 'activate_validated';
    const p = bar.buildGridProfileMetadataPatch({ metadata: standardMeta, action, profilePayload, liveValidationApproved: live, managedReadinessProbePassed: live, specialToStandard: null });
    assert(JSON.stringify(p) === JSON.stringify(legacy(standardMeta, action, live, live)), `live STANDARD ${action}: payload byte-identical to Phase 120`);
    assert(!(C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY in p), `live STANDARD ${action}: no intent key`);
  }
  // Live SPECIAL metadata.
  const draft = completeDraft();
  const specialMeta = {
    [C.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
    [C.LOGIN_FLOW_PLAN_META_KEY]: C.serializeLoginFlowPlanBag({ draft, active: draft }),
  };
  assert(C.resolveActiveLoginContract(specialMeta).mode === 'SPECIAL', 'fixture: live SPECIAL');
  assert(bar.liveContractIsNotStandard(specialMeta) === true && bar.liveContractIsNotStandard(standardMeta) === false && bar.liveContractIsNotStandard(null) === false, 'liveContractIsNotStandard: SPECIAL yes, STANDARD / missing no');
  assert(bar.liveContractIsNotStandard({ [C.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'STANDARD' }, [C.LOGIN_FLOW_PLAN_META_KEY]: specialMeta[C.LOGIN_FLOW_PLAN_META_KEY] }) === false, 'explicit STANDARD activation (plan bag present) → STANDARD path unchanged');
  const spec = { previous: null, loginFields, loginUrl: 'https://example.test/login' };
  const p = bar.buildGridProfileMetadataPatch({ metadata: specialMeta, action: 'activate_validated', profilePayload, liveValidationApproved: true, managedReadinessProbePassed: true, specialToStandard: spec });
  const intent = p[C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY];
  assert(intent && intent.transition === 'SPECIAL_TO_STANDARD', 'live SPECIAL activate → SPECIAL_TO_STANDARD intent');
  assert(JSON.stringify(Object.keys(intent.autofill)) === JSON.stringify(['previous', 'proposed', 'loginFields', 'loginUrl', 'action', 'liveValidationApproved', 'managedReadinessProbePassed']), 'intent.autofill shape = removed activateStandard() payload');
  assert(JSON.stringify(Object.keys(intent.autofill.proposed)) === JSON.stringify(['fieldMappings', 'loginEntryUrl', 'allowedOrigin']), 'intent.autofill.proposed shape unchanged');
  const { [C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: _i, ...rest } = p;
  assert(JSON.stringify(rest) === JSON.stringify(legacy(specialMeta, 'activate_validated', true, true)), 'other keys identical to the normal grid activation');
  const saveOnly = bar.buildGridProfileMetadataPatch({ metadata: specialMeta, action: 'save', profilePayload, liveValidationApproved: false, managedReadinessProbePassed: false, specialToStandard: spec });
  assert(!(C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY in saveOnly), 'intent only on activate_validated');
  // Unchanged contract merge: with the intent the live contract becomes STANDARD; without it, it stays SPECIAL.
  const merged = C.mergeLoginContractMetadata({ existingMetadata: specialMeta, patchMetadata: p });
  assert(merged.ok === true && C.resolveActiveLoginContract(merged.metadata).mode === 'STANDARD', 'unchanged merge/planner: live contract switches to STANDARD');
  const without = C.mergeLoginContractMetadata({ existingMetadata: specialMeta, patchMetadata: legacy(specialMeta, 'activate_validated', true, true) });
  assert(!without.ok || C.resolveActiveLoginContract(without.metadata).mode === 'SPECIAL', 'old grid payload (no intent) left SPECIAL live — the defect fixed');
  // A3: live SPECIAL_INVALID (fail closed, no STANDARD fallback) → same return path; planner accepts it as recovery.
  const invalidCases = [
    {
      reason: 'corrupt_special_activation',
      meta: { [C.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 0 }, [C.LOGIN_FLOW_PLAN_META_KEY]: C.serializeLoginFlowPlanBag({ draft, active: draft }) },
    },
    {
      reason: 'missing_active_plan',
      meta: { [C.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 }, [C.LOGIN_FLOW_PLAN_META_KEY]: C.serializeLoginFlowPlanBag({ draft, active: null }) },
    },
    {
      reason: 'active_plan_version_mismatch',
      meta: { [C.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 99 }, [C.LOGIN_FLOW_PLAN_META_KEY]: C.serializeLoginFlowPlanBag({ draft, active: draft }) },
    },
  ];
  for (const { reason, meta } of invalidCases) {
    const resolved = C.resolveActiveLoginContract(meta);
    assert(resolved.mode === 'SPECIAL_INVALID' && resolved.reason === reason, `fixture: live SPECIAL_INVALID (${reason})`);
    assert(bar.liveContractIsNotStandard(meta) === true, `${reason}: grid treats live as not STANDARD → «החלף» dialog + relaxed canApprove`);
    const pi = bar.buildGridProfileMetadataPatch({ metadata: meta, action: 'activate_validated', profilePayload, liveValidationApproved: true, managedReadinessProbePassed: true, specialToStandard: spec });
    const ii = pi[C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY];
    assert(ii && ii.transition === 'SPECIAL_TO_STANDARD' && JSON.stringify(ii) === JSON.stringify(intent), `${reason}: SPECIAL_TO_STANDARD intent sent (same shape as live SPECIAL)`);
    const mi = C.mergeLoginContractMetadata({ existingMetadata: meta, patchMetadata: pi });
    assert(mi.ok === true && C.resolveActiveLoginContract(mi.metadata).mode === 'STANDARD', `${reason}: unchanged planner accepts SPECIAL_TO_STANDARD → live STANDARD`);
    const wi = C.mergeLoginContractMetadata({ existingMetadata: meta, patchMetadata: legacy(meta, 'activate_validated', true, true) });
    assert(!wi.ok || C.resolveActiveLoginContract(wi.metadata).mode !== 'STANDARD', `${reason}: without the intent the service stays non-STANDARD (why A3 is needed)`);
  }
  // Grid wiring.
  assertIncludes(gridSrc, 'const liveNotStandard = liveContractIsNotStandard(row.metadata);', 'grid reads live contract');
  assertNotIncludes(gridSrc, 'liveContractIsSpecial', 'grid no longer gates on SPECIAL only');
  assertNotIncludes(barSrc, "mode === 'SPECIAL'", 'helper does not narrow to SPECIAL');
  assertIncludes(fnBody(barSrc, 'export function liveContractIsNotStandard'), ".mode !== 'STANDARD'", 'helper: SPECIAL or SPECIAL_INVALID');
  const request = fnBody(gridSrc, 'function requestApproveMapping');
  const iSwitch = request.indexOf('if (liveNotStandard) {');
  assert(iSwitch > 0 && request.indexOf('setSwitchConfirmOpen(true)') > iSwitch && request.indexOf('return;', iSwitch) < request.lastIndexOf('setApproveConfirmOpen(true)'), 'live SPECIAL: switch dialog first; live STANDARD: existing approve dialog directly');
  const cancelSwitch = fnBody(gridSrc, 'function cancelSwitchToStandard');
  assert(!cancelSwitch.includes('persist(') && !cancelSwitch.includes('setApproveConfirmOpen(true)') && cancelSwitch.includes('setSwitchConfirmed(false)'), '«ביטול» on switch dialog writes nothing');
  const confirmSwitch = fnBody(gridSrc, 'function confirmSwitchToStandard');
  assert(confirmSwitch.includes('setSwitchConfirmed(true)') && confirmSwitch.includes('setApproveConfirmOpen(true)') && !confirmSwitch.includes('persist('), '«החלף» continues to the existing approve step (no write yet)');
  const confirmApprove = fnBody(gridSrc, 'function confirmApproveMapping');
  const guard = confirmApprove.indexOf('if (liveNotStandard && !switchConfirmed) {');
  assert(guard > 0 && guard < confirmApprove.indexOf('persist('), 'no write while live not STANDARD without «החלף»');
  assertIncludes(confirmApprove, 'const specialToStandard = liveNotStandard && switchConfirmed;', 'intent only when live not STANDARD and confirmed');
  const persist = fnBody(gridSrc, 'async function persist');
  assertIncludes(persist, "action === 'activate_validated' && options?.specialToStandard === true", 'persist adds intent only for confirmed activate');
  assertIncludes(persist, 'metadata: buildGridProfileMetadataPatch({', 'persist uses the payload builder');
  const dialogAt = gridSrc.indexOf('data-panel="special-to-standard-confirm"');
  const dialog = gridSrc.slice(dialogAt, gridSrc.indexOf('</div>\n        </div>', dialogAt));
  assert(dialogAt > 0 && dialog.includes('{GRID_SPECIAL_TO_STANDARD_HE.confirm}') && dialog.includes('{GRID_SPECIAL_TO_STANDARD_HE.confirmYes}') && dialog.includes('{GRID_SPECIAL_TO_STANDARD_HE.cancel}'), 'grid in-app switch dialog, exact text + buttons');
  assertIncludes(gridSrc, "(existing!.supportState !== 'validated' || liveNotStandard)", 'live not STANDARD: validated regular mapping still activatable; live STANDARD gate unchanged');
}
console.log('  ✓ 4. grid: live STANDARD byte-identical / no dialog; live SPECIAL and SPECIAL_INVALID (3 reasons) → «החלף» dialog + SPECIAL_TO_STANDARD intent; planner → STANDARD');

// ─── 5. Old-string sweep + exact-label rule ────────────────────────────────
{
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
    for (const old of ['בדוק Snapshot', 'ACTIVATE SPECIAL', 'ACTIVATE STANDARD', 'Snapshot מלא', 'Snapshot חלקי', 'לא ACTIVATE', '(ACTIVATE)', 'חוזה STANDARD הופעל']) {
      assertNotIncludes(src, old, `${rel}: old string removed: ${old}`);
    }
  }
  // Every «…» in SPECIAL editor copy that names an action-bar button uses its current label.
  const barLabels = new Set([bar.SPECIAL_ACTION_BAR_HE.saveDraft, ...Object.values(bar.SPECIAL_ACTIVATE_LABEL_HE)]);
  const quoted = [...uiSrc.matchAll(/«([^«»]+)»/g)].map((m) => m[1]);
  for (const q of quoted) {
    if (/Snapshot|ACTIVATE|שמור|הפעל כניסה|אשר מיפוי|בדוק (Snapshot|שהטיוטה)/.test(q)) assert(barLabels.has(q), `quoted «${q}» is a current action-bar label`);
  }
  assert(quoted.includes('שמור מיפוי') && !quoted.includes('שמור טיוטה'), 'copy references «שמור מיפוי» (D-121-43)');
}
console.log('  ✓ 5. old-string sweep (src/**/*.ts{,x}); quoted action-bar names = current labels');

// ─── 6. Scope ──────────────────────────────────────────────────────────────
{
  assertNotIncludes(barSrc, 'planLoginContractActivate', 'no local planner bypass');
  for (const needle of ['hostname', 'serviceId ===', 'mizrahi', 'pagi', '.co.il']) {
    assertNotIncludes(barSrc.toLowerCase(), needle, `no site branch: ${needle}`);
  }
  assertNotIncludes(barSrc, 'final_submit', 'final_submit untouched');
}
console.log('  ✓ 6. scope: no planner bypass, no site branches');

// ─── 7. D-121-31 (§4.12): top buttons — labels, Analyze busy, pattern enablement ──
{
  const buttonOf = (src, action) => {
    const at = src.indexOf(`data-action="${action}"`);
    assert(at > 0, `${action} button rendered`);
    return src.slice(src.lastIndexOf('<button', at), src.indexOf('</button>', at));
  };
  const visualConst = (key) => {
    const block = uiSrc.slice(uiSrc.indexOf('export const SPECIAL_VISUAL_BUTTON_HE'));
    const m = block.match(new RegExp(`\\n  ${key}: '([^']+)'`));
    return m ? m[1] : null;
  };
  // Exact labels (Owner wording).
  assert(bar.SPECIAL_ANALYZE_HE.label === 'זהה כפתור ושדות באתר', 'Analyze label exact');
  assert(bar.SPECIAL_ANALYZE_HE.busyLabel === 'מזהה…', 'Analyze busy label exact');
  assert(bar.SPECIAL_ANALYZE_HE.busyStatus === 'מזהה כפתורים ושדות באתר. זה יכול לקחת כמה שניות…', 'Analyze busy status exact');
  assert(visualConst('opener') === 'סמנו בעצמכם את כפתור פתיחת המסך הצף', 'opener pick label exact');
  assert(visualConst('transition') === 'סמנו בעצמכם את כפתור המעבר בין השלבים', 'transition pick label exact');
  const analyzeBtn = buttonOf(uiSrc, 'special-analyze-current-tab');
  const openerBtn = buttonOf(uiSrc, 'special-visual-opener');
  const transitionBtn = buttonOf(uiSrc, 'special-visual-transition');
  assertIncludes(analyzeBtn, '{analyzing ? SPECIAL_ANALYZE_HE.busyLabel : SPECIAL_ANALYZE_HE.label}', 'Analyze renders busy / idle label');
  assertIncludes(analyzeBtn, 'aria-busy={analyzing}', 'Analyze aria-busy while running');
  assertIncludes(openerBtn, 'SPECIAL_VISUAL_BUTTON_HE.opener', 'opener renders new label');
  assertIncludes(transitionBtn, 'SPECIAL_VISUAL_BUTTON_HE.transition', 'transition renders new label');
  for (const label of [...Object.values(bar.SPECIAL_ANALYZE_HE), visualConst('opener'), visualConst('transition'), visualConst('waitingAction')]) {
    assert(!/[A-Za-z]/.test(label), `no English in top-bar text: ${label}`);
  }

  // Busy indicator: manual and auto-Analyze; status line; cleared after.
  const manual = fnBody(uiSrc, 'async function analyzeCurrentSurface');
  assert(manual.indexOf('setAnalyzing(true)') >= 0 && manual.indexOf('setAnalyzing(true)') < manual.indexOf("runSpecialAnalyze('manual')"), 'manual Analyze: busy set before run');
  assert(manual.indexOf('finally') < manual.indexOf('setAnalyzing(false)'), 'manual Analyze: busy cleared in finally');
  const cont = fnBody(uiSrc, 'async function testAndChooseAction');
  const iClick = cont.indexOf('performApprovedAuthoringClick(');
  const iOn = cont.indexOf('setAnalyzing(true)');
  assert(iOn > iClick && iOn < cont.indexOf("runSpecialAnalyze('after_continue'"), 'auto-Analyze: busy set after a successful click, before the run');
  assert(cont.indexOf('finally') < cont.indexOf('setAnalyzing(false)'), 'auto-Analyze: busy cleared in finally (also on failure)');
  assert(cont.slice(0, iClick).indexOf('setAnalyzing') < 0, 'click itself is not reported as identifying');
  assertIncludes(uiSrc, '{analyzing ? (\n            <p role="status" className="admin-muted" data-status="special-analyze-busy">\n              {SPECIAL_ANALYZE_HE.busyStatus}', 'status line (role=status) only while analyzing');
  assert((uiSrc.match(/setAnalyzing\(true\)/g) || []).length === 2, 'busy only for manual + auto-Analyze');
  // Result message replaces the status line: runSpecialAnalyze still sets the existing messages.
  const run = fnBody(uiSrc, 'async function runSpecialAnalyze');
  for (const k of ['fieldsIdentified', 'autoAnalyzeSuccess', 'autoAnalyzePartial', 'noSuggestions']) {
    assertIncludes(run, `SPECIAL_EDITOR_COPY_HE.${k}`, `existing result message kept: ${k}`);
  }
  // Other bar buttons stay disabled during the run (busy is held for the whole run).
  for (const [b, name] of [[analyzeBtn, 'analyze'], [openerBtn, 'opener'], [transitionBtn, 'transition']]) {
    assertIncludes(b, 'disabled={busy || !canUseCurrentSurface', `${name}: busy / surface gate still on top`);
  }
  assert(manual.indexOf('setBusy(true)') >= 0 && manual.indexOf('setBusy(false)') > manual.indexOf('finally'), 'manual Analyze holds busy');

  // Enablement matrix (pattern only).
  const matrix = {
    FLOATING_SCREEN: { analyze: true, opener: true, transition: false },
    MULTI_STEP: { analyze: true, opener: false, transition: true },
    FLOATING_SCREEN_MULTI_STEP: { analyze: true, opener: true, transition: true },
    STANDARD: { analyze: false, opener: false, transition: false },
  };
  for (const [p, want] of Object.entries(matrix)) {
    assert(JSON.stringify(bar.specialTopBarEnablement(p)) === JSON.stringify(want), `enablement matrix: ${p}`);
  }
  assertIncludes(analyzeBtn, '!topBar.analyze', 'Analyze gated by pattern');
  assertIncludes(openerBtn, '!topBar.opener', 'opener: today\'s disabled logic kept when rendered');
  assertIncludes(transitionBtn, '!topBar.transition', 'transition: today\'s disabled logic kept when rendered');
  // D-121-45 C1 (supersedes "all three always rendered"): Analyze always rendered; a manual
  // pick is rendered only when manualPickRelevant(kind, pattern) (render proof: verifyPhase121GridStructure).
  const row = uiSrc.slice(uiSrc.lastIndexOf('<div className="admin-actions-row">', uiSrc.indexOf('data-action="special-analyze-current-tab"')), uiSrc.indexOf('</div>', uiSrc.indexOf('data-action="special-visual-transition"')));
  const beforeAnalyze = row.slice(0, row.indexOf('data-action="special-analyze-current-tab"'));
  assert(!/\?\s*\(\s*<button\s*$/.test(beforeAnalyze) && !/topBar\.\w+ \?|topBar\.\w+ &&/.test(row), 'Analyze always rendered; no topBar-based wrapper');
  assertIncludes(row, "{manualPickRelevant('floating_opener', pattern) ? (", 'opener rendered only when relevant (manualPickRelevant)');
  assertIncludes(row, "{manualPickRelevant('intermediate_transition', pattern) ? (", 'transition rendered only when relevant (manualPickRelevant)');

  // Live recompute: derived from the selected pattern state on every render (no save / reload).
  assertIncludes(uiSrc, 'const topBar = specialTopBarEnablement(pattern);', 'enablement derived from live pattern state');
  assertNotIncludes(uiSrc, 'specialTopBarEnablement(draft', 'not derived from the saved draft');
  assertNotIncludes(uiSrc, 'specialTopBarEnablement(readAuthoringPattern', 'not derived from the stored row');

  // Armed pick disarmed on pattern change (same path as «ביטול»).
  const onChange = fnBody(uiSrc, 'function onPatternChange');
  const iDisarm = onChange.indexOf("if (armedPick?.target === 'action' && !manualPickRelevant(armedPick.kind, next)) {");
  assert(iDisarm > 0 && onChange.indexOf('cancelArmedVisualPick();', iDisarm) > iDisarm, 'irrelevant armed pick → cancelArmedVisualPick()');
  assert(onChange.lastIndexOf('setSuccess(null)') < iDisarm, 'disarm runs after the clears, so the «ביטול» message stays visible');
  const cancel = fnBody(uiSrc, 'function cancelArmedVisualPick');
  assertIncludes(cancel, 'cancelCurrentTabVisualMapping({', '«ביטול» path cancels in the Ext');
  assertIncludes(cancel, 'authoringTabId: sessionTabId()', '«ביטול» path targets the session tab');
  // D-121-45: the select moved to the «אופי הכניסה» grid; the SPECIAL grid reports the same lock rule.
  assertIncludes(uiSrc, "const selectorLocked = busy && armedPick?.target !== 'action';", 'pattern select usable while a manual button pick is armed');
  assertIncludes(read('src/admin/LoginPatternGrid.tsx'), 'disabled={disabled}', 'cross-cutting select honours the reported lock');
  for (const [kind, p, relevant] of [
    ['floating_opener', 'MULTI_STEP', false], ['floating_opener', 'STANDARD', false], ['floating_opener', 'FLOATING_SCREEN_MULTI_STEP', true],
    ['intermediate_transition', 'FLOATING_SCREEN', false], ['intermediate_transition', 'STANDARD', false], ['intermediate_transition', 'MULTI_STEP', true],
  ]) {
    assert(bar.manualPickRelevant(kind, p) === relevant, `manualPickRelevant(${kind}, ${p}) = ${relevant}`);
  }

  // Old-string sweep + exact-label rule for these buttons.
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
    for (const old of ['(משטח נוכחי)', 'מיפוי חזותי — פותח', 'מיפוי חזותי — מעבר']) {
      assertNotIncludes(src, old, `${rel}: old label removed: ${old}`);
    }
  }
  assertNotIncludes(uiSrc, 'ANALYZE_LOGIN_PAGE_LABEL_HE', 'SPECIAL editor no longer uses the STANDARD Analyze label');
  const topLabels = new Set([bar.SPECIAL_ANALYZE_HE.label, visualConst('field'), visualConst('opener'), visualConst('transition')]);
  const quoted = [...uiSrc.matchAll(/«([^«»]+)»/g)].map((m) => m[1]);
  for (const q of quoted) {
    if (/מיפוי חזותי|סמנו בעצמכם|זהה כפתור|נתח/.test(q)) assert(topLabels.has(q), `quoted «${q}» is a current top-bar label`);
  }
  assert(quoted.includes(visualConst('opener')) && quoted.includes(visualConst('transition')), '60 s timeout texts quote the new labels');

  // Scope.
  for (const needle of ['hostname', 'serviceId ===', 'mizrahi', '.co.il']) {
    assertNotIncludes(fnBody(barSrc, 'export function manualPickRelevant').toLowerCase(), needle, `enablement has no site branch: ${needle}`);
  }
}
console.log('  ✓ 7. D-121-31: top labels, Analyze busy (manual + auto), enablement matrix, live recompute, armed pick disarm, old-string sweep');

// ─── 8. D-121-32 (§4.13), as amended by D-121-34 (§4.15): panel labels, reject, helper,
// legacy flags, sweep. Approval button + «הכפתור נבחר» feedback are superseded by
// test-then-choose (verifyPhase121TestThenChoose.mjs).
{
  const P = bar.SPECIAL_BUTTON_PANEL_HE;
  const buttonOf = (action) => {
    const at = uiSrc.indexOf(`data-action="${action}"`);
    assert(at > 0, `${action} button rendered`);
    return uiSrc.slice(uiSrc.lastIndexOf('<button', at), uiSrc.indexOf('</button>', at));
  };
  const copyLine = (key) => {
    const block = uiSrc.slice(uiSrc.indexOf('export const SPECIAL_EDITOR_COPY_HE'));
    const m = block.match(new RegExp(`\\n  ${key}:\\s*'([^']+)'`));
    return m ? m[1] : null;
  };
  // Exact labels / copy.
  assert(P.reject === 'זה לא הכפתור' && P.testOpen === 'בדוק את הכפתור וזהה את השדות', 'panel labels exact (D-121-32a rename)');
  assert(!('approve' in P) && !('approved' in P), '«זה הכפתור הנכון» / «הכפתור נבחר» labels removed (D-121-34)');
  assert(P.testOpenHelper === 'הבדיקה לוחצת על הכפתור באתר, מוודאת שמסך הכניסה נפתח, ומזהה את השדות שבו.', 'helper line exact');
  assert(P.statusSelected === 'מצב: נבחר' && P.statusWaiting === 'מצב: ממתין לבחירה', 'status copy exact');
  assert(copyLine('buttonSelected') === null, 'approval success message removed with the approval button');

  // Legacy flags: both → «מצב: נבחר»; one flag → not chosen.
  const draft = completeDraft();
  const legacyAuthOnly = { ...draft.preambleActions[0], approvedForAuthoringContinuation: true, approvedForRuntime: false };
  const legacyRuntimeOnly = { ...draft.preambleActions[0], approvedForAuthoringContinuation: false, approvedForRuntime: true };
  const legacyBoth = { ...draft.preambleActions[0], approvedForAuthoringContinuation: true, approvedForRuntime: true };
  for (const a of [legacyAuthOnly, legacyRuntimeOnly]) {
    assert(bar.actionSelected(a) === false && bar.actionStatusHe(a, undefined) === P.statusWaiting, 'legacy single flag → not chosen');
  }
  assert(bar.actionStatusHe(legacyBoth, undefined) === P.statusSelected, `legacy both flags → «${P.statusSelected}»`);
  // The unchanged validator still requires runtime approval for the draft check / activation.
  assert(bar.checkSpecialDraft({ ...draft, preambleActions: [legacyAuthOnly] }).complete === false, 'continuation-only action → draft incomplete (validator unchanged)');
  assert(bar.checkSpecialDraft(draft).complete === true, 'both flags → draft complete');

  // Editor wiring.
  assertNotIncludes(uiSrc, 'approvePendingRuntime', 'separate runtime approval handler removed');
  assertNotIncludes(uiSrc, 'data-action="approve-runtime"', '«אשר לשימוש בהפעלה» button absent');
  assertNotIncludes(uiSrc, 'data-action="approve-authoring-continuation"', 'approval button absent (D-121-34)');
  assertIncludes(uiSrc, '<p className="admin-muted" data-status="action-selection">\n          {actionStatusHe(action, testOutcomes[action.actionId], pendingInDraft(action))}', 'status line from selection + test outcome');
  const rejectBtn = buttonOf('reject-action');
  assertIncludes(rejectBtn, '{SPECIAL_BUTTON_PANEL_HE.reject}', 'reject renamed');
  const rejectFn = fnBody(uiSrc, 'function rejectAction');
  assertIncludes(rejectFn, 'setDraft(removeDraftAction(draft, shown));', '«זה לא הכפתור» removes the action from the draft');
  assertIncludes(rejectFn, 'setPanelAction(slot, null);', '«זה לא הכפתור» clears the proposal');
  const removed = C.removeDraftAction(draft, draft.preambleActions[0]);
  assert(C.listDraftActions(removed).length === 0, 'removeDraftAction removes it (unchanged helper)');
  const testBtn = buttonOf('authoring-continue-click');
  assertIncludes(testBtn, '{SPECIAL_BUTTON_PANEL_HE.testOpen}', 'continue renamed');
  assertIncludes(testBtn, '!canPerformAuthoringClick(actionForTestPress(action), approvedFrameOrigins, allowedOrigin)', 'existing R2 / reserved-kind gate kept');
  const cont = fnBody(uiSrc, 'async function testAndChooseAction');
  for (const needle of ['performApprovedAuthoringClick({', "runSpecialAnalyze('after_continue', { base: chosenDraft, tested: chosen, slot", 'setAnalyzing(true)']) {
    assertIncludes(cont, needle, `continuation behavior unchanged: ${needle}`);
  }
  assertIncludes(uiSrc, '<p className="admin-muted" data-status="test-open-helper">\n          {SPECIAL_BUTTON_PANEL_HE.testOpenHelper}', 'helper line under the panel');
  assertIncludes(fnBody(uiSrc, 'async function runSpecialAnalyze'), 'const actionToTest = Boolean(selected && !actionSelected(selected));', 'Analyze copy uses selection state');
  assertIncludes(fnBody(uiSrc, 'async function visualPickAction'), 'actionSelected(selected)', 'Visual copy uses selection state');

  // Exact-label rule + old-string sweep.
  for (const key of ['actionFound', 'autoAnalyzeSuccessWithAction', 'visualActionFound', 'continueNeedsApproval', 'actionAlreadyApproved', 'fieldsIdentifiedWithAction']) {
    assertIncludes(copyLine(key), `«${P.testOpen}»`, `${key} names «${P.testOpen}»`);
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
    for (const old of ['פתח את מסך הכניסה', 'אשר לשימוש בהפעלה', 'אושר לפתיחת המסך', 'אושר לשימוש בהפעלה', 'הכפתור שנמצא כבר אושר', 'בדוק שהכפתור פותח את המסך', 'זה הכפתור הנכון', 'הכפתור נבחר ונשמר בטיוטה']) {
      assertNotIncludes(src, old, `${rel}: old string removed: ${old}`);
    }
  }
  const copyBlock = uiSrc.slice(uiSrc.indexOf('export const SPECIAL_EDITOR_COPY_HE'), uiSrc.indexOf('export const SPECIAL_FRAME_BUTTON_HE'));
  assertNotIncludes(copyBlock, '«דחה»', 'editor copy no longer names «דחה» for the button panel');
  const panelLabels = new Set(Object.values(P));
  for (const q of [...uiSrc.matchAll(/«([^«»]+)»/g)].map((m) => m[1])) {
    if (/הכפתור|בדוק ש(ה)?כפתור|בדוק את|דחה/.test(q)) assert(panelLabels.has(q), `quoted «${q}» is a current panel label`);
  }

  // Scope: contract helpers untouched in the editor path; no site branches.
  assertNotIncludes(barSrc, 'final_submit', 'final_submit untouched');
  for (const needle of ['hostname', 'serviceId ===', 'mizrahi', '.co.il']) {
    assertNotIncludes(fnBody(barSrc, 'export function actionSelected').toLowerCase(), needle, `selection has no site branch: ${needle}`);
  }
}
console.log('  ✓ 8. D-121-32 (as amended by D-121-34): labels, approval buttons removed, status, reject, test gate, legacy flags, sweep');

console.log('\nPASS — Phase 121.1 D-121-30 / D-121-31 / D-121-32 action bar + panel (§4.11–§4.13)');
