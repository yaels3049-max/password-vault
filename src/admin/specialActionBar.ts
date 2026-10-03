/**
 * Phase 121.1 D-121-30 (§4.11) — SPECIAL editor action-bar copy, draft completeness
 * result, and the regular-grid activation payload (SPECIAL → STANDARD return path).
 * Pure helpers; contract / validator / planner logic is not changed here.
 */
import {
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  type AutofillFieldMapping,
  type AutofillProfile,
  type AutofillProfileAction,
} from '../autofill/validatedProfile';
import {
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  actionKindRelevantForPattern,
  approveActionForAuthoringContinuation,
  actionIdentity,
  approveActionForRuntime,
  createImmutableDraftSnapshot,
  isActionOnlyStep,
  isReservedActionKind,
  isValidFrameDescriptor,
  normalizeLegacyDraftReadiness,
  placeTransitionAsStepExit,
  rederiveRevealReadiness,
  rejectAuthoringContinuation,
  resolveActiveLoginContract,
  sameFrame,
  setStepExitTransition,
  upsertPreambleAction,
  upsertStepFieldMappings,
  validateSpecialPlanComplete,
  validateSpecialRunnable,
  type FlowAction,
  type FrameDescriptor,
  type LoginContractValidateCode,
  type LoginFlowPlanDocument,
  type SpecialFieldMapping,
  type SpecialLoginPattern,
} from '../loginContract';
import type { LoginField } from '../service/serviceModel';
import { withoutLoginContractKeys } from './contractSafeMetadata';
import { ADMIN_MAPPING_COPY_HE } from './mappingCopy';

/** Admin-visible action-bar labels and copy (exact, plain Hebrew; D-121-43 shared vocabulary). */
export const SPECIAL_ACTION_BAR_HE = {
  saveDraft: ADMIN_MAPPING_COPY_HE.save,
  explanation:
    'שמור מיפוי — שומר את העבודה לבדיקה ב«בדיקת מילוי», המשתמשים לא מושפעים. אשר מיפוי — המשתמשים יקבלו את המיפוי הזה במקום המיפוי הקודם.',
  draftComplete: ADMIN_MAPPING_COPY_HE.structuralOk,
  activateConfirmBody: (serviceDisplayName: string): string =>
    `לאחר האישור המשתמשים יקבלו את המיפוי הזה ל${serviceDisplayName}. מילוי אוטומטי לשירות זה יפעל רק אחרי השלמת שלב ההפעלה אצל המשתמשים.`,
  activateConfirmYes: ADMIN_MAPPING_COPY_HE.approve,
  cancel: ADMIN_MAPPING_COPY_HE.cancel,
  /** 121.3 G11 — saved mapping's pattern has no runtime yet (FLOATING_SCREEN_MULTI_STEP). */
  approvePatternLater: 'אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.',
  /** 121.3 G11 — runnable pattern, but the saved mapping fails the runtime gate. */
  approveNotRunnable: 'המיפוי אינו תקין להרצה. עדכנו את המיפוי ושמרו.',
} as const;

export const SPECIAL_ACTIVATE_LABEL_HE: Record<SpecialLoginPattern, string> = {
  FLOATING_SCREEN: ADMIN_MAPPING_COPY_HE.approve,
  MULTI_STEP: ADMIN_MAPPING_COPY_HE.approve,
  FLOATING_SCREEN_MULTI_STEP: ADMIN_MAPPING_COPY_HE.approve,
};

/** D-121-43 — «שלב נוכחי» is shown only for multi-step patterns; labels never show the stepId. */
export function stepSelectorVisible(pattern: string): boolean {
  return pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP';
}

export function stepLabelHe(index: number): string {
  return `שלב ${index + 1}`;
}

/** Regular grid: confirmation shown only when the live contract is not STANDARD. */
export const GRID_SPECIAL_TO_STANDARD_HE = {
  confirm: 'השירות פועל כרגע עם תהליך כניסה מיוחד. להחליף אותו במיפוי הרגיל לכל המשתמשים?',
  confirmYes: 'החלף',
  cancel: 'ביטול',
} as const;

/** D-121-31 (§4.12) — SPECIAL editor top bar: Analyze label and busy copy. */
export const SPECIAL_ANALYZE_HE = {
  label: 'זהה כפתור ושדות באתר',
  busyLabel: 'מזהה…',
  busyStatus: 'מזהה כפתורים ושדות באתר. זה יכול לקחת כמה שניות…',
} as const;

/** D-121-32 / D-121-34 (§4.13 / §4.15) — button panels: labels, titles and status. */
export const SPECIAL_BUTTON_PANEL_HE = {
  title: 'נמצא כפתור באתר',
  followUpTitle: 'נמצא כפתור נוסף',
  reject: 'זה לא הכפתור',
  testOpen: 'בדוק את הכפתור וזהה את השדות',
  testOpenHelper: 'הבדיקה לוחצת על הכפתור באתר, מוודאת שמסך הכניסה נפתח, ומזהה את השדות שבו.',
  statusSelected: 'מצב: נבחר',
  statusWaiting: 'מצב: ממתין לבחירה',
  statusTestedChosen: 'מצב: נבדק ונבחר — המסך נפתח',
  statusNotChosen: 'מצב: לא נבחר — המסך לא נפתח',
  statusNotChosenNotLogin: 'מצב: לא נבחר — המסך נפתח, אבל לא נמצא בו שדה סיסמה',
  statusNotChosenFieldMissing: 'מצב: לא נבחר — השדה הממופה לא הופיע אחרי הלחיצה',
  statusNotChosenFrameUnaddressable: 'מצב: לא נבחר — המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר',
  /** D-121-67 E — a button written by «מיפוי חזותי», not tested yet (never chosen by the pick). */
  statusNeedsTest: 'מצב: ממתין לבדיקה',
  /** D-121-67 C — a failed re-test of a chosen button keeps the choice. */
  statusKeptAfterFailure: 'מצב: נבחר — הבדיקה האחרונה לא הצליחה, הבחירה הקודמת נשמרה',
  keptAfterFailure: 'הבחירה הקודמת נשמרה. אם האתר כבר התקדם, זה צפוי — כדי לבדוק שוב חזרי לדף הכניסה.',
  remap: 'מיפוי חזותי',
} as const;

/** D-121-67 A — per-step button panel (multi-step patterns; follows «שלב נוכחי»). */
export const SPECIAL_STEP_BUTTON_HE = {
  title: (stepIndex: number): string => `כפתור המעבר של ${stepLabelHe(stepIndex)}`,
  lastStep: 'שלב אחרון — אין כפתור מעבר',
  noExit: 'אין כפתור מעבר',
  remapped: 'הכפתור עודכן במיפוי החזותי. כדי לבחור אותו לחצו «בדוק את הכפתור וזהה את השדות».',
} as const;

/**
 * D-121-59 — G8 (the revealed surface must have a password input) applies to FLOATING_SCREEN
 * only when the site's own login fields include a password field. Password-less login screens
 * (ID + card digits, OTP) accept any fresh eligible credential input.
 */
export function requirePasswordSurfaceFor(
  pattern: string,
  loginFields: ReadonlyArray<{ type?: string }>,
): boolean {
  return pattern === 'FLOATING_SCREEN' && loginFields.some((f) => f.type === 'password');
}

/** Both contract approvals. A legacy single-flag action is not selected. */
export function actionSelected(
  action: { approvedForAuthoringContinuation?: boolean; approvedForRuntime?: boolean } | null | undefined,
): boolean {
  return action?.approvedForAuthoringContinuation === true && action?.approvedForRuntime === true;
}

/**
 * D-121-56 — floating patterns: the step the opener reveals (steps[0]) takes manual Analyze
 * field proposals only once a floating opener is chosen (successful «בדוק»). Before that the
 * current surface is the main page, whose inputs are not the login screen's.
 * D-121-58 — multi-step patterns: step N+1 (revealed by step N's exitTransition) likewise
 * takes them only once step N's transition is chosen.
 */
export function manualAnalyzeMayWriteFields(
  draft: LoginFlowPlanDocument,
  pattern: string,
  stepId: string,
): boolean {
  const idx = draft.steps.findIndex((s) => s.stepId === stepId);
  if (idx > 0 && stepSelectorVisible(pattern)) {
    return actionSelected(draft.steps[idx - 1].exitTransition);
  }
  if (pattern !== 'FLOATING_SCREEN' && pattern !== 'FLOATING_SCREEN_MULTI_STEP') return true;
  if (draft.steps[0]?.stepId !== stepId) return true;
  return (draft.preambleActions ?? []).some(
    (action) => action.kind === 'floating_opener' && actionSelected(action),
  );
}

/** Result of the last «בדוק…» press for an action in this editor session. */
export type ActionTestOutcome =
  | 'opened'
  | 'not_opened'
  | 'not_login'
  | 'field_missing'
  | 'frame_unaddressable'
  | 'kept_after_failure';

/** D-121-59 A1 — failed-test status follows the click failure reason. */
export function testFailureOutcome(reason: string | undefined): ActionTestOutcome {
  if (reason === 'surface_not_login') return 'not_login';
  if (reason === 'readiness_timeout') return 'field_missing';
  if (reason === 'surface_frame_not_addressable') return 'frame_unaddressable';
  return 'not_opened';
}

/** The test press is the Admin's consent to click this one element (continuation flag only). */
export function actionForTestPress(action: FlowAction): FlowAction {
  return approveActionForAuthoringContinuation(action);
}

/** R3 success: the tested action is chosen (a runtime-approved action has always passed a live test). */
export function actionAfterTestSuccess(action: FlowAction): FlowAction {
  return approveActionForRuntime(approveActionForAuthoringContinuation(action));
}

/** R3 failure (any reason): not chosen — both flags cleared. */
export function actionAfterTestFailure(action: FlowAction): FlowAction {
  return { ...rejectAuthoringContinuation(action), approvedForRuntime: false };
}

/**
 * `inDraft` — the action is stored in the draft (a step exit / opener). Stored with neither
 * flag (a «מיפוי חזותי» re-map, or a not-proven test) → «ממתין לבדיקה»; a proposal → «ממתין לבחירה».
 */
export function actionStatusHe(
  action: { approvedForAuthoringContinuation?: boolean; approvedForRuntime?: boolean },
  outcome: ActionTestOutcome | undefined,
  inDraft = false,
): string {
  if (outcome === 'not_opened') return SPECIAL_BUTTON_PANEL_HE.statusNotChosen;
  if (outcome === 'not_login') return SPECIAL_BUTTON_PANEL_HE.statusNotChosenNotLogin;
  if (outcome === 'field_missing') return SPECIAL_BUTTON_PANEL_HE.statusNotChosenFieldMissing;
  if (outcome === 'frame_unaddressable') return SPECIAL_BUTTON_PANEL_HE.statusNotChosenFrameUnaddressable;
  if (!actionSelected(action)) {
    return inDraft && !action.approvedForAuthoringContinuation
      ? SPECIAL_BUTTON_PANEL_HE.statusNeedsTest
      : SPECIAL_BUTTON_PANEL_HE.statusWaiting;
  }
  if (outcome === 'kept_after_failure') return SPECIAL_BUTTON_PANEL_HE.statusKeptAfterFailure;
  return outcome === 'opened'
    ? SPECIAL_BUTTON_PANEL_HE.statusTestedChosen
    : SPECIAL_BUTTON_PANEL_HE.statusSelected;
}

function unchosen(action: FlowAction): FlowAction {
  return { ...action, approvedForAuthoringContinuation: false, approvedForRuntime: false };
}

/**
 * D-121-67 E — «מיפוי חזותי» on a step's button: the pick becomes that step's exit, not
 * chosen (R3: only a passed live test chooses). Later steps and all fields are kept.
 */
export function remapStepExit(
  draft: LoginFlowPlanDocument,
  stepId: string,
  candidate: FlowAction,
): LoginFlowPlanDocument {
  return rederiveRevealReadiness(placeTransitionAsStepExit(draft, stepId, unchosen(candidate)));
}

/** D-121-67 E — FLOATING «מיפוי חזותי» on the opener: replaces the opener, not chosen. */
export function remapFloatingOpener(draft: LoginFlowPlanDocument, candidate: FlowAction): LoginFlowPlanDocument {
  return rederiveRevealReadiness(upsertPreambleAction(draft, unchosen(candidate)));
}

/** D-121-67 A — «זה לא הכפתור» in a step's panel removes that step's exit only. */
export function clearStepExit(draft: LoginFlowPlanDocument, stepId: string): LoginFlowPlanDocument {
  return rederiveRevealReadiness(setStepExitTransition(draft, stepId, undefined));
}

export const SPECIAL_FIELD_ROW_HE = {
  remove: 'הסר מיפוי',
} as const;

/**
 * D-121-69 — «הסר מיפוי» drops one field's row from one step (draft only). Other steps,
 * exits and the opener are kept; readiness is re-derived. login_fields are not touched.
 */
export function removeStepFieldMapping(
  draft: LoginFlowPlanDocument,
  stepId: string,
  fieldId: string,
): LoginFlowPlanDocument {
  const step = draft.steps.find((s) => s.stepId === stepId);
  const rows = (step?.fieldMappings ?? []) as SpecialFieldMapping[];
  const kept = rows.filter((m) => m.fieldId !== fieldId);
  if (!step || kept.length === rows.length) return draft;
  return rederiveRevealReadiness(upsertStepFieldMappings(draft, stepId, kept));
}

export type StepButtonView =
  | { kind: 'exit'; stepIndex: number; exit: FlowAction }
  | { kind: 'last'; stepIndex: number }
  | { kind: 'none'; stepIndex: number };

/** D-121-67 A — what the per-step button panel shows for the selected step (saved draft only). */
export function stepButtonView(draft: LoginFlowPlanDocument, stepId: string): StepButtonView | null {
  const stepIndex = draft.steps.findIndex((s) => s.stepId === stepId);
  if (stepIndex < 0) return null;
  const exit = draft.steps[stepIndex]!.exitTransition;
  if (exit) return { kind: 'exit', stepIndex, exit };
  return stepIndex === draft.steps.length - 1 ? { kind: 'last', stepIndex } : { kind: 'none', stepIndex };
}

/**
 * D-121-67 B — a transition proposal belongs to the step whose exit it would become: the
 * step that owns it in the draft, else the step it was proposed for. It is shown only while
 * that step is selected, and never twice (a stored exit shows in the step's own panel).
 * Openers are not step exits and stay shown.
 */
export function proposalShownOnStep(input: {
  draft: LoginFlowPlanDocument;
  action: FlowAction;
  proposedForStepId: string | undefined;
  currentStepId: string;
}): boolean {
  const { draft, action, currentStepId } = input;
  if (!stepSelectorVisible(draft.pattern) || action.kind !== 'intermediate_transition') return true;
  if (draft.steps.some((s) => s.exitTransition?.actionId === action.actionId)) return false;
  const current = draft.steps.find((s) => s.stepId === currentStepId)?.exitTransition;
  if (current && actionIdentity(current) === actionIdentity(action)) return false;
  return (input.proposedForStepId ?? currentStepId) === currentStepId;
}

export type ManualPickKind = 'floating_opener' | 'intermediate_transition';

/** Manual opener pick serves floating screens; manual transition pick serves multi-step flows. */
export function manualPickRelevant(kind: ManualPickKind, pattern: string): boolean {
  return actionKindRelevantForPattern(kind, pattern);
}

/** Pattern-only enablement of the three top-bar buttons (busy / surface gates apply on top). */
export function specialTopBarEnablement(pattern: string): {
  analyze: boolean;
  opener: boolean;
  transition: boolean;
} {
  const special =
    pattern === 'FLOATING_SCREEN' || pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP';
  return {
    analyze: special,
    opener: manualPickRelevant('floating_opener', pattern),
    transition: manualPickRelevant('intermediate_transition', pattern),
  };
}

export function draftIncompleteMessageHe(missing: string): string {
  return `המיפוי לא מלא: ${missing.trim().replace(/[.。]+$/, '')}.`;
}

/**
 * D-121-67 D — where a completeness failure is. The validator returns only a code, so the
 * place is found here by walking the plan in the validator's own order: every earlier step /
 * action passed all checks, so the first one matching the returned code's condition is the
 * failing one. Rules and codes stay in validateSpecialPlanComplete.
 */
export type DraftGapPlace =
  | { kind: 'exit'; stepIndex: number }
  | { kind: 'opener' }
  | { kind: 'step'; stepIndex: number };

function frameOk(frame: FrameDescriptor | undefined): boolean {
  return frame === undefined || isValidFrameDescriptor(frame);
}

function cssRow(m: unknown): SpecialFieldMapping | null {
  const row = m as SpecialFieldMapping;
  return typeof row?.fieldId === 'string' && row.locatorType === 'css' && typeof row.locator === 'string'
    ? row
    : null;
}

function actionMatchesCode(
  code: LoginContractValidateCode,
  action: FlowAction,
  revealedMappings: SpecialFieldMapping[] | null,
  revealedExit: FlowAction | null,
): boolean {
  const r = action.readiness;
  switch (code) {
    case 'reservedActionKind':
      return isReservedActionKind(action.kind);
    case 'invalidFrame':
      return !frameOk(action.frame) || !frameOk(r?.frame);
    case 'actionNotApprovedForRuntime':
      return !action.approvedForRuntime;
    case 'invalidReadiness':
      return !r || r.kind !== 'exact_one_eligible_css' || r.locatorType !== 'css' || !r.locator.trim() || !(r.timeoutMs > 0);
    case 'readinessIsSelf':
      return r.locator === action.locator && sameFrame(r.frame, action.frame);
    case 'readinessNotDeclaredField':
      return revealedMappings !== null && revealedMappings.length === 0 && revealedExit
        ? !(r.locator === revealedExit.locator && sameFrame(r.frame, revealedExit.frame))
        : !(revealedMappings ?? []).some((m) => m.locator === r.locator && sameFrame(m.frame, r.frame));
    default:
      return false;
  }
}

export function locateDraftGap(plan: LoginFlowPlanDocument, code: LoginContractValidateCode): DraftGapPlace | null {
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const mappingsOf = (s: number): SpecialFieldMapping[] =>
    isActionOnlyStep(plan, s) ? [] : ((steps[s]?.fieldMappings ?? []).map(cssRow).filter(Boolean) as SpecialFieldMapping[]);
  if (code === 'emptyFieldMappings' || code === 'mixedFrameInStep' || code === 'invalidFrame') {
    for (let s = 0; s < steps.length; s += 1) {
      if (isActionOnlyStep(plan, s)) continue;
      const raw = steps[s]!.fieldMappings ?? [];
      if (code === 'emptyFieldMappings') {
        const bad = raw.some((m) => {
          const row = cssRow(m);
          return !row || !row.fieldId.trim() || !row.locator.trim();
        });
        if (raw.length === 0 || bad) return { kind: 'step', stepIndex: s };
      } else if (code === 'mixedFrameInStep') {
        const rows = mappingsOf(s);
        if (rows.some((m) => !sameFrame(m.frame, rows[0]!.frame))) return { kind: 'step', stepIndex: s };
      } else if (mappingsOf(s).some((m) => !frameOk(m.frame))) {
        return { kind: 'step', stepIndex: s };
      }
    }
    if (code !== 'invalidFrame') return null;
  }
  for (let i = 0; i < steps.length; i += 1) {
    const exit = steps[i]!.exitTransition;
    const revealed = i + 1 < steps.length ? mappingsOf(i + 1) : null;
    if (exit && actionMatchesCode(code, exit, revealed, steps[i + 1]?.exitTransition ?? null)) {
      return { kind: 'exit', stepIndex: i };
    }
  }
  for (const action of plan.preambleActions ?? []) {
    if (actionMatchesCode(code, action, steps.length ? mappingsOf(0) : null, null)) {
      return action.kind === 'floating_opener' ? { kind: 'opener' } : null;
    }
  }
  return null;
}

/**
 * D-121-67 D — completeness copy that names the step / button (Hub copy layer). A single
 * field is never named: parse rejects an empty or badly framed mapping row, so such a draft
 * never reaches the validator (it is corruptPlan).
 */
export const SPECIAL_GAP_PLACE_HE = {
  exitNotChosen: (stepIndex: number): string =>
    `כפתור המעבר של ${stepLabelHe(stepIndex)} עדיין לא נבחר — בחרו «${stepLabelHe(stepIndex)}» ובדקו אותו`,
  openerNotChosen: 'כפתור הפתיחה של המסך הצף עדיין לא נבחר — בדקו אותו',
  exit: (stepIndex: number): string => `כפתור המעבר של ${stepLabelHe(stepIndex)}`,
  opener: 'כפתור הפתיחה של המסך הצף',
} as const;

export function draftGapDetailHe(plan: LoginFlowPlanDocument, code: LoginContractValidateCode, message: string): string {
  const place = locateDraftGap(plan, code);
  if (!place) return message;
  const detail = message.trim().replace(/[.。]+$/, '');
  if (place.kind === 'exit') {
    return code === 'actionNotApprovedForRuntime'
      ? SPECIAL_GAP_PLACE_HE.exitNotChosen(place.stepIndex)
      : `${SPECIAL_GAP_PLACE_HE.exit(place.stepIndex)}: ${detail}`;
  }
  if (place.kind === 'opener') {
    return code === 'actionNotApprovedForRuntime'
      ? SPECIAL_GAP_PLACE_HE.openerNotChosen
      : `${SPECIAL_GAP_PLACE_HE.opener}: ${detail}`;
  }
  return stepSelectorVisible(plan.pattern) ? `${stepLabelHe(place.stepIndex)}: ${detail}` : message;
}

export type SpecialDraftCheck =
  | { complete: true; normalized: LoginFlowPlanDocument; message: string }
  | { complete: false; normalized: LoginFlowPlanDocument | null; message: string };

/**
 * Same check for the automatic completeness line, «בדיקת מילוי» and the «אשר מיפוי» gate:
 * A1 normalization, then the immutable snapshot (shared completeness validator).
 */
export function checkSpecialDraft(draft: LoginFlowPlanDocument | null): SpecialDraftCheck {
  if (!draft) {
    return { complete: false, normalized: null, message: draftIncompleteMessageHe('אין מיפוי') };
  }
  const normalized = normalizeLegacyDraftReadiness(draft);
  const snap = createImmutableDraftSnapshot(normalized, { snapshotId: 'preview' });
  if (!snap.ok) {
    return { complete: false, normalized, message: draftIncompleteMessageHe(snap.message) };
  }
  if (snap.snapshot.isComplete) {
    return { complete: true, normalized, message: SPECIAL_ACTION_BAR_HE.draftComplete };
  }
  const result = validateSpecialPlanComplete(snap.snapshot.plan);
  const detail = result.ok ? '' : draftGapDetailHe(snap.snapshot.plan, result.code, result.message);
  return { complete: false, normalized, message: draftIncompleteMessageHe(detail) };
}

export type SpecialApproveGate = { allowed: true } | { allowed: false; message: string | null };

/**
 * 121.3 G11 — «אשר מיפוי» only for a saved draft that is complete AND passes the same
 * runtime gate as the run (users never get a plan they cannot run). message null = the
 * completeness line already explains the block.
 */
export function specialApproveGate(savedDraft: LoginFlowPlanDocument | null): SpecialApproveGate {
  const check = checkSpecialDraft(savedDraft);
  if (!check.complete) return { allowed: false, message: null };
  const runnable = validateSpecialRunnable(check.normalized);
  if (runnable.ok) return { allowed: true };
  return {
    allowed: false,
    message:
      runnable.reason === 'pattern_not_supported_yet'
        ? SPECIAL_ACTION_BAR_HE.approvePatternLater
        : SPECIAL_ACTION_BAR_HE.approveNotRunnable,
  };
}

/**
 * SPECIAL or SPECIAL_INVALID. resolveActiveLoginContract fails closed on SPECIAL_INVALID,
 * so the grid (the only STANDARD return path) must offer SPECIAL_TO_STANDARD for both.
 */
export function liveContractIsNotStandard(metadata: Record<string, unknown> | null | undefined): boolean {
  return resolveActiveLoginContract(metadata ?? {}).mode !== 'STANDARD';
}

export interface GridProfilePayload {
  fieldMappings: AutofillFieldMapping[];
  loginEntryUrl: string;
  allowedOrigin: string;
  fieldAuthoring?: unknown;
}

/**
 * Metadata patch written by the regular grid. Live STANDARD (or any non-activate
 * action) → exactly the Phase 120 keys, without the login-contract keys (D-121-33). Live not STANDARD + activate_validated → the same
 * keys plus the SPECIAL_TO_STANDARD activate intent (payload shape of the removed
 * SPECIAL-editor STANDARD activation).
 */
export function buildGridProfileMetadataPatch(input: {
  metadata: Record<string, unknown> | null | undefined;
  action: AutofillProfileAction;
  profilePayload: GridProfilePayload;
  liveValidationApproved: boolean;
  managedReadinessProbePassed: boolean;
  specialToStandard?: {
    previous: AutofillProfile | null;
    loginFields: LoginField[];
    loginUrl: string;
  } | null;
}): Record<string, unknown> {
  const intentWrite = input.action === 'activate_validated' && Boolean(input.specialToStandard);
  const patch: Record<string, unknown> = {
    ...(intentWrite ? (input.metadata ?? {}) : withoutLoginContractKeys(input.metadata)),
    autofillProfile: input.profilePayload,
    [AUTOFILL_PROFILE_ACTION_KEY]: input.action,
    [AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: input.liveValidationApproved,
    [AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY]: input.managedReadinessProbePassed,
  };
  if (input.action === 'activate_validated' && input.specialToStandard) {
    patch[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY] = {
      transition: 'SPECIAL_TO_STANDARD',
      autofill: {
        previous: input.specialToStandard.previous,
        proposed: {
          fieldMappings: input.profilePayload.fieldMappings,
          loginEntryUrl: input.profilePayload.loginEntryUrl,
          allowedOrigin: input.profilePayload.allowedOrigin,
        },
        loginFields: input.specialToStandard.loginFields,
        loginUrl: input.specialToStandard.loginUrl,
        action: 'activate_validated',
        liveValidationApproved: input.liveValidationApproved,
        managedReadinessProbePassed: input.managedReadinessProbePassed,
      },
    };
  }
  return patch;
}
