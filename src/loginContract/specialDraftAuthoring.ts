/**
 * Phase 121.1 — SPECIAL DRAFT authoring helpers (pure).
 * Progressive approval gates; draft-only mapping persist; no SPECIAL runtime.
 */

import { AUTOFILL_PROFILE_META_KEY, type AutofillFieldMapping } from '../autofill/validatedProfile';
import {
  cloneFrameDescriptor,
  frameKey,
  isFrameOriginApproved,
  isHttpsExactOrigin,
  sameFrame,
} from './frameDescriptor';
import { deepClonePlanDocument } from './parse';
import type {
  FlowAction,
  FlowStep,
  FrameDescriptor,
  LoginFlowPlanDocument,
  ReadinessCondition,
  SpecialFieldMapping,
  SpecialLoginPattern,
} from './types';
import { isActionOnlyStep, isReservedActionKind, validateSpecialPlanComplete } from './validateSpecialPlan';

export type AuthoringLoginPattern = 'STANDARD' | SpecialLoginPattern;

export const SPECIAL_PATTERN_LABEL_HE: Record<SpecialLoginPattern, string> = {
  FLOATING_SCREEN: 'מסך צף',
  MULTI_STEP: 'רב־שלבים',
  FLOATING_SCREEN_MULTI_STEP: 'מסך צף + רב־שלבים',
};

export const LOGIN_PATTERN_LABEL_HE: Record<AuthoringLoginPattern, string> = {
  STANDARD: 'רגיל',
  ...SPECIAL_PATTERN_LABEL_HE,
};

export function isSpecialLoginPattern(value: unknown): value is SpecialLoginPattern {
  return (
    value === 'FLOATING_SCREEN' ||
    value === 'MULTI_STEP' ||
    value === 'FLOATING_SCREEN_MULTI_STEP'
  );
}

/**
 * Openers serve floating screens; transitions serve multi-step flows. One rule for the
 * manual pick buttons and the D-121-46 A1 draft pruning.
 */
export function actionKindRelevantForPattern(kind: FlowAction['kind'], pattern: string): boolean {
  if (kind === 'floating_opener') {
    return pattern === 'FLOATING_SCREEN' || pattern === 'FLOATING_SCREEN_MULTI_STEP';
  }
  return pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP';
}

/** Initialize a minimal SPECIAL draft for the selected pattern (incomplete OK). */
export function ensureSpecialDraft(
  pattern: SpecialLoginPattern,
  previous?: LoginFlowPlanDocument | null,
): LoginFlowPlanDocument {
  if (previous && previous.pattern === pattern) {
    return deepClonePlanDocument(previous);
  }
  return {
    planVersion: previous?.planVersion && previous.planVersion >= 1 ? previous.planVersion : 1,
    pattern,
    preambleActions: previous?.preambleActions ? [...previous.preambleActions] : [],
    steps:
      previous?.steps && previous.steps.length > 0
        ? previous.steps.map((s) => ({ ...s, fieldMappings: [...s.fieldMappings] }))
        : [{ stepId: 'step-1', fieldMappings: [] }],
  };
}

/**
 * AC-121.1-2: unapproved actions must never be clicked.
 * Ext/Hub click helpers MUST call this before any system click.
 * 121.1-IF: a framed action also needs its frame origin approved (R2 / A2);
 * reserved kinds are never clickable.
 */
export function canPerformAuthoringClick(
  action: FlowAction | null | undefined,
  approvedFrameOrigins: ReadonlySet<string> = new Set(),
  entryAllowedOrigin?: string | null,
): boolean {
  if (!action || action.approvedForAuthoringContinuation !== true) return false;
  if (isReservedActionKind(action.kind)) return false;
  if (!action.frame) return true;
  return isFrameOriginApproved(action.frame.frameOrigin, approvedFrameOrigins, entryAllowedOrigin);
}

/** R2: origins recorded by descriptors already in the draft (presence = approval record). */
export function listApprovedFrameOrigins(draft: LoginFlowPlanDocument | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!draft) return out;
  const add = (frame: FrameDescriptor | undefined) => {
    if (frame && isHttpsExactOrigin(frame.frameOrigin)) out.add(frame.frameOrigin);
  };
  for (const action of listDraftActions(draft)) {
    add(action.frame);
    add(action.readiness.frame);
  }
  for (const step of draft.steps) {
    for (const m of step.fieldMappings) add((m as SpecialFieldMapping).frame);
  }
  return out;
}

export function approveActionForAuthoringContinuation(
  action: FlowAction,
): FlowAction {
  return { ...action, approvedForAuthoringContinuation: true };
}

export function approveActionForRuntime(action: FlowAction): FlowAction {
  return { ...action, approvedForRuntime: true };
}

export function rejectAuthoringContinuation(action: FlowAction): FlowAction {
  return { ...action, approvedForAuthoringContinuation: false };
}

/** Chosen = approved for runtime (only a live test success sets it). */
function isChosenAction(action: FlowAction): boolean {
  return action.approvedForRuntime === true;
}

/**
 * Upsert preamble opener/transition candidate into draft.
 * D-121-46: one opener slot — a floating_opener replaces any other opener (in place).
 * A chosen action removes the other unchosen actions of its kind, which would otherwise
 * block completeness with no panel to remove them.
 * D-121-46 A1: a kind irrelevant to the draft pattern is never written, and irrelevant
 * actions already in the draft are dropped.
 */
export function upsertPreambleAction(
  draft: LoginFlowPlanDocument,
  action: FlowAction,
): LoginFlowPlanDocument {
  const next = dropPatternIrrelevantActions(deepClonePlanDocument(draft));
  if (!actionKindRelevantForPattern(action.kind, next.pattern)) return next;
  const occupiesSlot = (a: FlowAction) =>
    a.actionId === action.actionId ||
    (action.kind === 'floating_opener' && a.kind === 'floating_opener');
  const supersededByChosen = (a: FlowAction) =>
    isChosenAction(action) && a.kind === action.kind && !isChosenAction(a);
  const list = next.preambleActions ? [...next.preambleActions] : [];
  const idx = list.findIndex(occupiesSlot);
  const out: FlowAction[] = [];
  list.forEach((a, i) => {
    if (i === idx) out.push(action);
    else if (!occupiesSlot(a) && !supersededByChosen(a)) out.push(a);
  });
  if (idx < 0) out.push(action);
  next.preambleActions = out;
  return next;
}

/**
 * D-121-46 A1 (SPECIAL draft only, never ACTIVE): drop preamble actions and exit
 * transitions whose kind the pattern does not use (chosen or not). Never approves anything.
 */
export function dropPatternIrrelevantActions(draft: LoginFlowPlanDocument): LoginFlowPlanDocument {
  const relevant = (a: FlowAction) => actionKindRelevantForPattern(a.kind, draft.pattern);
  const preambleClean = (draft.preambleActions ?? []).every(relevant);
  const stepsClean = draft.steps.every((s) => !s.exitTransition || relevant(s.exitTransition));
  if (preambleClean && stepsClean) return draft;
  const next = deepClonePlanDocument(draft);
  if (next.preambleActions) next.preambleActions = next.preambleActions.filter(relevant);
  next.steps = next.steps.map((step) => {
    if (!step.exitTransition || relevant(step.exitTransition)) return step;
    const { exitTransition: _dropped, ...rest } = step;
    return rest;
  });
  return next;
}

/**
 * D-121-46 legacy drafts (SPECIAL draft only, never ACTIVE): when a chosen opener exists,
 * drop the unchosen openers. Only unchosen openers → unchanged (still incomplete).
 */
export function dropStaleOpenerCandidates(draft: LoginFlowPlanDocument): LoginFlowPlanDocument {
  const preamble = draft.preambleActions ?? [];
  const openers = preamble.filter((a) => a.kind === 'floating_opener');
  const stale = openers.filter((a) => !isChosenAction(a));
  if (stale.length === 0 || stale.length === openers.length) return draft;
  const next = deepClonePlanDocument(draft);
  next.preambleActions = (next.preambleActions ?? []).filter(
    (a) => a.kind !== 'floating_opener' || isChosenAction(a),
  );
  return next;
}

export function upsertStepFieldMappings(
  draft: LoginFlowPlanDocument,
  stepId: string,
  fieldMappings: SpecialFieldMapping[],
): LoginFlowPlanDocument {
  const next = deepClonePlanDocument(draft);
  const step = next.steps.find((s) => s.stepId === stepId);
  if (!step) {
    next.steps.push({ stepId, fieldMappings: [...fieldMappings] });
  } else {
    step.fieldMappings = [...fieldMappings];
  }
  return next;
}

export function setStepExitTransition(
  draft: LoginFlowPlanDocument,
  stepId: string,
  action: FlowAction | undefined,
): LoginFlowPlanDocument {
  const next = deepClonePlanDocument(draft);
  const step = next.steps.find((s) => s.stepId === stepId);
  if (!step) {
    const created: FlowStep = { stepId, fieldMappings: [] };
    if (action) created.exitTransition = action;
    next.steps.push(created);
  } else if (action) {
    step.exitTransition = action;
  } else {
    delete step.exitTransition;
  }
  return next;
}

function transitionStepsPattern(pattern: LoginFlowPlanDocument['pattern']): boolean {
  return pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP';
}

function nextFreeStepId(draft: LoginFlowPlanDocument): string {
  const ids = new Set(draft.steps.map((s) => s.stepId));
  let n = draft.steps.length + 1;
  while (ids.has(`step-${n}`)) n += 1;
  return `step-${n}`;
}

function ensureStepAfter(next: LoginFlowPlanDocument, idx: number): void {
  if (!next.steps[idx + 1]) next.steps.push({ stepId: nextFreeStepId(next), fieldMappings: [] });
}

/**
 * D-121-58 (MULTI_STEP / FSMS draft only): a transition tested while step N is selected
 * becomes step N's exitTransition (single slot) and reveals step N+1, created empty when
 * missing. The same action never stays in the preamble. Unknown stepId → steps[0].
 */
export function placeTransitionAsStepExit(
  draft: LoginFlowPlanDocument,
  stepId: string,
  action: FlowAction,
): LoginFlowPlanDocument {
  const next = deepClonePlanDocument(draft);
  if (next.preambleActions) {
    next.preambleActions = next.preambleActions.filter(
      (a) => a.actionId !== action.actionId && actionIdentity(a) !== actionIdentity(action),
    );
  }
  if (next.steps.length === 0) next.steps.push({ stepId: 'step-1', fieldMappings: [] });
  let idx = next.steps.findIndex((s) => s.stepId === stepId);
  if (idx < 0) idx = 0;
  next.steps[idx] = { ...next.steps[idx], exitTransition: action };
  ensureStepAfter(next, idx);
  return next;
}

/**
 * D-121-58 legacy drafts (MULTI_STEP / FSMS draft only, never ACTIVE): an
 * intermediate_transition in preambleActions moves to steps[0].exitTransition
 * (chosen first; an occupied slot keeps its action unless only the legacy one is chosen).
 * Other legacy preamble transitions are dropped; steps[1] is created empty when missing.
 */
export function migrateLegacyPreambleTransitions(draft: LoginFlowPlanDocument): LoginFlowPlanDocument {
  if (!transitionStepsPattern(draft.pattern)) return draft;
  if (!(draft.preambleActions ?? []).some((a) => a.kind === 'intermediate_transition')) return draft;
  const next = deepClonePlanDocument(draft);
  const preamble = next.preambleActions ?? [];
  const legacy = preamble.filter((a) => a.kind === 'intermediate_transition');
  next.preambleActions = preamble.filter((a) => a.kind !== 'intermediate_transition');
  if (next.steps.length === 0) next.steps.push({ stepId: 'step-1', fieldMappings: [] });
  const moved = legacy.find(isChosenAction) ?? legacy[0];
  const slot = next.steps[0].exitTransition;
  if (!slot || (!isChosenAction(slot) && isChosenAction(moved))) {
    next.steps[0] = { ...next.steps[0], exitTransition: moved };
  }
  ensureStepAfter(next, 0);
  return next;
}

export const SPECIAL_AUTOFILL_WRITE_FORBIDDEN_HE =
  'אסור לכתוב מיפויי SPECIAL לתוך autofillProfile.fieldMappings.';

export type AutofillWriteGuardResult =
  | { ok: true }
  | { ok: false; code: 'dualWriteForbidden'; message: string };

const AUTOFILL_WRITE_FORBIDDEN: AutofillWriteGuardResult = {
  ok: false,
  code: 'dualWriteForbidden',
  message: SPECIAL_AUTOFILL_WRITE_FORBIDDEN_HE,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural JSON equality (object key order ignored). */
function sameJsonValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameJsonValue(item, b[i]))
    );
  }
  if (!isPlainRecord(a) || !isPlainRecord(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameJsonValue(a[k], b[k]));
}

/** 121.1-IF: frame descriptors are SPECIAL-only and must never reach autofillProfile. */
export function assertNoFrameInAutofillMappings(
  autofillFieldMappings: readonly AutofillFieldMapping[] | readonly unknown[] | null | undefined,
): AutofillWriteGuardResult {
  const rows = autofillFieldMappings ?? [];
  if (rows.some((m) => isPlainRecord(m) && Object.prototype.hasOwnProperty.call(m, 'frame'))) {
    return AUTOFILL_WRITE_FORBIDDEN;
  }
  return { ok: true };
}

/**
 * AC-121.1-6/7 + D-121-64: SPECIAL mappings live only under loginFlowPlan; a SPECIAL-editor
 * write leaves the row's autofillProfile exactly as stored. Absent from the patch = kept (the
 * registry write lays the patch over the stored row). Present → must equal the row's value
 * (not added / changed / removed) and carry no frame key. Equal STANDARD / SPECIAL locators
 * are allowed.
 */
export function assertSpecialWriteKeepsAutofillProfile(input: {
  rowMetadata: Record<string, unknown> | null | undefined;
  patchMetadata: Record<string, unknown>;
}): AutofillWriteGuardResult {
  const row = input.rowMetadata ?? {};
  const patch = input.patchMetadata;
  if (!Object.prototype.hasOwnProperty.call(patch, AUTOFILL_PROFILE_META_KEY)) {
    return { ok: true };
  }
  const next = patch[AUTOFILL_PROFILE_META_KEY];
  if (
    !Object.prototype.hasOwnProperty.call(row, AUTOFILL_PROFILE_META_KEY) ||
    !sameJsonValue(row[AUTOFILL_PROFILE_META_KEY], next)
  ) {
    return AUTOFILL_WRITE_FORBIDDEN;
  }
  return assertNoFrameInAutofillMappings(
    isPlainRecord(next) && Array.isArray(next.fieldMappings) ? next.fieldMappings : [],
  );
}

/** Collect all FlowActions in a draft (preamble + exit transitions). */
export function listDraftActions(draft: LoginFlowPlanDocument): FlowAction[] {
  const out: FlowAction[] = [];
  for (const a of draft.preambleActions ?? []) {
    out.push(a);
  }
  for (const step of draft.steps) {
    if (step.exitTransition) out.push(step.exitTransition);
  }
  return out;
}

/**
 * First proposed action whose locator is not already in the draft.
 * Re-ids on actionId collision (inspect ids restart per surface) so an existing
 * approved action is never overwritten. Result is always unapproved.
 */
export function pickNewActionCandidate(
  draft: LoginFlowPlanDocument,
  candidates: FlowAction[],
): FlowAction | null {
  const existing = listDraftActions(draft);
  const identities = new Set(existing.map(actionIdentity));
  const ids = new Set(existing.map((a) => a.actionId));
  for (const candidate of candidates) {
    if (identities.has(actionIdentity(candidate))) continue;
    let actionId = candidate.actionId;
    let n = 2;
    while (ids.has(actionId)) {
      actionId = `${candidate.actionId}-${n}`;
      n += 1;
    }
    return {
      ...candidate,
      actionId,
      approvedForAuthoringContinuation: false,
      approvedForRuntime: false,
    };
  }
  return null;
}

/**
 * Map one proposal onto the draft: same locator → the existing draft action
 * (keeps its approval state); otherwise the proposal, unapproved, with an
 * actionId that cannot overwrite a different draft action on later approval.
 */
function resolveProposalAgainstDraft(
  draft: LoginFlowPlanDocument,
  candidate: FlowAction,
): FlowAction {
  const existing = listDraftActions(draft);
  const known = existing.find((a) => actionIdentity(a) === actionIdentity(candidate));
  if (known) return known;
  const ids = new Set(existing.map((a) => a.actionId));
  let actionId = candidate.actionId;
  let n = 2;
  while (ids.has(actionId)) {
    actionId = `${candidate.actionId}-${n}`;
    n += 1;
  }
  return {
    ...candidate,
    actionId,
    approvedForAuthoringContinuation: false,
    approvedForRuntime: false,
  };
}

/**
 * Manual Analyze / Visual pick (§5.2): pending = top-ranked proposal for the
 * current surface, even when it is already in the draft. Does not modify the draft.
 */
export function selectPendingForManualAnalyze(
  draft: LoginFlowPlanDocument,
  candidates: FlowAction[],
): FlowAction | null {
  const top = candidates[0];
  return top ? resolveProposalAgainstDraft(draft, top) : null;
}

/**
 * Analyze after an approved continuation click (§5.2 / D-121-22): skip the action
 * just clicked and draft actions already approved for continuation, so the next
 * step is proposed. Does not modify the draft.
 */
export function selectPendingAfterContinue(
  draft: LoginFlowPlanDocument,
  candidates: FlowAction[],
  clicked: FlowAction | null,
): FlowAction | null {
  const approvedIdentities = new Set(
    listDraftActions(draft)
      .filter((a) => a.approvedForAuthoringContinuation)
      .map(actionIdentity),
  );
  for (const candidate of candidates) {
    if (clicked && actionIdentity(candidate) === actionIdentity(clicked)) continue;
    if (approvedIdentities.has(actionIdentity(candidate))) continue;
    return resolveProposalAgainstDraft(draft, candidate);
  }
  return null;
}

/** D-121-26 identity (121.1-IF): same locator in the same frame. */
export function actionIdentity(action: Pick<FlowAction, 'locator' | 'frame'>): string {
  return `${action.locator}@@${frameKey(action.frame)}`;
}

/** «דחה» (§5.2): remove the action (by id or same locator) from preamble and exit transitions. */
export function removeDraftAction(
  draft: LoginFlowPlanDocument,
  action: FlowAction,
): LoginFlowPlanDocument {
  const matches = (a: FlowAction) =>
    a.actionId === action.actionId || actionIdentity(a) === actionIdentity(action);
  const next = deepClonePlanDocument(draft);
  next.preambleActions = (next.preambleActions ?? []).filter((a) => !matches(a));
  next.steps = next.steps.map((step) => {
    if (!step.exitTransition || !matches(step.exitTransition)) return step;
    const { exitTransition: _removed, ...rest } = step;
    return rest;
  });
  return next;
}

export function draftCompletenessPreview(draft: LoginFlowPlanDocument): {
  isComplete: boolean;
  message?: string;
} {
  const result = validateSpecialPlanComplete(draft);
  if (result.ok) {
    return { isComplete: true };
  }
  return { isComplete: false, message: result.message };
}

export const DEFAULT_READINESS_TIMEOUT_MS = 8000;

/**
 * Legacy (pre-121.1-IF) opener-self readiness. No longer used for action creation;
 * kept for callers/tests that build legacy drafts. Fails `readinessIsSelf` (R3).
 */
export function createDefaultReadiness(locator: string): FlowAction['readiness'] {
  return {
    kind: 'exact_one_eligible_css',
    locatorType: 'css',
    locator: locator.trim() || 'body',
    timeoutMs: DEFAULT_READINESS_TIMEOUT_MS,
  };
}

/**
 * R3 authoring-only marker: revealed step not mapped yet → click uses reveal mode.
 * Matches no element and is never a declared field, so it can never ACTIVATE
 * (`readinessNotDeclaredField`).
 */
export const PENDING_REVEAL_READINESS_LOCATOR = '[data-pv-pending-reveal]';

export function createPendingRevealReadiness(): ReadinessCondition {
  return {
    kind: 'exact_one_eligible_css',
    locatorType: 'css',
    locator: PENDING_REVEAL_READINESS_LOCATOR,
    timeoutMs: DEFAULT_READINESS_TIMEOUT_MS,
  };
}

export function isPendingRevealReadiness(r: ReadinessCondition | null | undefined): boolean {
  return Boolean(r && r.locator === PENDING_REVEAL_READINESS_LOCATOR && !r.frame);
}

/** Opener-self readiness: same locator and frame as the action itself (R3 rejects). */
export function isSelfReadiness(action: FlowAction): boolean {
  return (
    action.readiness.locator === action.locator && sameFrame(action.readiness.frame, action.frame)
  );
}

/** Step revealed by an action: preamble → steps[0]; steps[i].exitTransition → steps[i+1]. */
function revealedStepFor(draft: LoginFlowPlanDocument, action: FlowAction): FlowStep | null {
  const exitIdx = draft.steps.findIndex(
    (s) => s.exitTransition && s.exitTransition.actionId === action.actionId,
  );
  if (exitIdx >= 0) return draft.steps[exitIdx + 1] ?? null;
  return draft.steps[0] ?? null;
}

/** D-121-58: step revealed by `action` (see revealedStepFor), by id. */
export function revealedStepIdFor(draft: LoginFlowPlanDocument, action: FlowAction): string | null {
  return revealedStepFor(draft, action)?.stepId ?? null;
}

function ownerStepFor(draft: LoginFlowPlanDocument, action: FlowAction): FlowStep | null {
  return draft.steps.find((s) => s.exitTransition?.actionId === action.actionId) ?? null;
}

function firstCredentialMapping(
  step: FlowStep | null,
  excluded: FlowStep | null = null,
): SpecialFieldMapping | null {
  const excludedKeys = new Set(
    (excluded?.fieldMappings ?? []).map((m) => {
      const row = m as SpecialFieldMapping;
      return `${row.locator}@@${frameKey(row.frame)}`;
    }),
  );
  for (const m of step?.fieldMappings ?? []) {
    const row = m as SpecialFieldMapping;
    if (typeof row.fieldId === 'string' && typeof row.locator === 'string' && row.locator.trim()) {
      if (excludedKeys.has(`${row.locator}@@${frameKey(row.frame)}`)) continue;
      return row;
    }
  }
  return null;
}

/**
 * D-121-63 B: the chosen exit of the action-only step that `action` reveals (never the
 * action itself). Not chosen yet → null (the transition keeps the pending marker).
 */
function revealedActionOnlyExit(draft: LoginFlowPlanDocument, action: FlowAction): FlowAction | null {
  if (action.kind !== 'intermediate_transition') return null;
  const exitIdx = draft.steps.findIndex((s) => s.exitTransition?.actionId === action.actionId);
  if (exitIdx < 0 || !isActionOnlyStep(draft, exitIdx + 1)) return null;
  const exit = draft.steps[exitIdx + 1]!.exitTransition!;
  if (!(exit.approvedForAuthoringContinuation && exit.approvedForRuntime)) return null;
  if (exit.locator === action.locator && sameFrame(exit.frame, action.frame)) return null;
  return exit;
}

/** D-121-63 B: readiness of `action` points at an element to click ('action') or a field. */
export function readinessTargetFor(draft: LoginFlowPlanDocument, action: FlowAction): 'action' | 'field' {
  const exit = revealedActionOnlyExit(draft, action);
  return exit &&
    action.readiness.locator === exit.locator &&
    sameFrame(action.readiness.frame, exit.frame)
    ? 'action'
    : 'field';
}

function readinessAt(action: FlowAction, locator: string, frame: FrameDescriptor | undefined): ReadinessCondition {
  const readiness: ReadinessCondition = {
    kind: 'exact_one_eligible_css',
    locatorType: 'css',
    locator,
    timeoutMs: action.readiness.timeoutMs > 0 ? action.readiness.timeoutMs : DEFAULT_READINESS_TIMEOUT_MS,
  };
  if (frame) readiness.frame = cloneFrameDescriptor(frame);
  return readiness;
}

/**
 * R3 (IF-2.5): readiness = first credential mapping of the revealed step (locator + frame).
 * No mapping yet → action unchanged.
 * D-121-58: a transition never takes a field of its own step; with no such mapping in the
 * revealed step it gets the pending marker (reveal mode: only a fresh field satisfies it).
 * D-121-63 B: into an action-only step whose exit is chosen → that exit (locator + frame).
 */
export function deriveRevealReadiness(
  draft: LoginFlowPlanDocument,
  action: FlowAction,
): FlowAction {
  const actionOnlyExit = revealedActionOnlyExit(draft, action);
  if (actionOnlyExit) {
    return { ...action, readiness: readinessAt(action, actionOnlyExit.locator, actionOnlyExit.frame) };
  }
  const isTransition = action.kind === 'intermediate_transition';
  const first = firstCredentialMapping(
    revealedStepFor(draft, action),
    isTransition ? ownerStepFor(draft, action) : null,
  );
  if (!first) {
    return isTransition ? { ...action, readiness: createPendingRevealReadiness() } : action;
  }
  return { ...action, readiness: readinessAt(action, first.locator, first.frame) };
}

function isDeclaredInRevealedStep(draft: LoginFlowPlanDocument, action: FlowAction): boolean {
  const actionOnlyExit = revealedActionOnlyExit(draft, action);
  if (actionOnlyExit) {
    return (
      action.readiness.locator === actionOnlyExit.locator &&
      sameFrame(action.readiness.frame, actionOnlyExit.frame)
    );
  }
  const matchesReadiness = (m: unknown) => {
    const row = m as SpecialFieldMapping;
    return row.locator === action.readiness.locator && sameFrame(row.frame, action.readiness.frame);
  };
  if (!(revealedStepFor(draft, action)?.fieldMappings ?? []).some(matchesReadiness)) return false;
  if (action.kind !== 'intermediate_transition') return true;
  return !(ownerStepFor(draft, action)?.fieldMappings ?? []).some(matchesReadiness);
}

function mapDraftActions(
  draft: LoginFlowPlanDocument,
  fn: (action: FlowAction) => FlowAction,
): LoginFlowPlanDocument {
  const next = deepClonePlanDocument(draft);
  if (next.preambleActions) next.preambleActions = next.preambleActions.map(fn);
  next.steps = next.steps.map((step) =>
    step.exitTransition ? { ...step, exitTransition: fn(step.exitTransition) } : step,
  );
  return next;
}

/**
 * Architect A1 — legacy draft readiness normalization (DRAFT only, never ACTIVE).
 * Opener-self or pending-marker readiness whose revealed step already has a first
 * credential mapping → deriveRevealReadiness. Anything else is left as-is.
 * D-121-46: pattern-irrelevant actions and stale unchosen openers are dropped first.
 * D-121-58: legacy preamble transitions move to steps[0].exitTransition; a transition whose
 * readiness is not a declared field of its revealed step is re-derived.
 */
export function normalizeLegacyDraftReadiness(draft: LoginFlowPlanDocument): LoginFlowPlanDocument {
  const base = dropStaleOpenerCandidates(dropPatternIrrelevantActions(draft));
  const migrated = migrateLegacyPreambleTransitions(base);
  return mapDraftActions(migrated, (action) =>
    isSelfReadiness(action) ||
    isPendingRevealReadiness(action.readiness) ||
    (action.kind === 'intermediate_transition' && !isDeclaredInRevealedStep(migrated, action))
      ? deriveRevealReadiness(migrated, action)
      : action,
  );
}

/**
 * IF-2.5 — re-derive after the revealed step's mappings change: any action whose
 * readiness is not (or no longer) a declared field of its revealed step.
 */
export function rederiveRevealReadiness(draft: LoginFlowPlanDocument): LoginFlowPlanDocument {
  return mapDraftActions(draft, (action) =>
    isDeclaredInRevealedStep(draft, action) ? action : deriveRevealReadiness(draft, action),
  );
}

export function createActionCandidate(input: {
  actionId: string;
  kind: FlowAction['kind'];
  label: string;
  locator: string;
  frame?: FrameDescriptor | null;
}): FlowAction {
  const action: FlowAction = {
    actionId: input.actionId,
    kind: input.kind,
    label: input.label,
    locatorType: 'css',
    locator: input.locator.trim(),
    approvedForAuthoringContinuation: false,
    approvedForRuntime: false,
    readiness: createPendingRevealReadiness(),
  };
  if (input.frame) action.frame = cloneFrameDescriptor(input.frame);
  return action;
}

/** Reveal (no declared field yet) vs declared readiness for the authoring click (IF-5.1). */
export function readinessModeFor(action: FlowAction): 'reveal' | 'declared' {
  return isPendingRevealReadiness(action.readiness) || isSelfReadiness(action)
    ? 'reveal'
    : 'declared';
}
