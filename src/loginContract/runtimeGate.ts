/**
 * Phase 121.2 RT-2.1 / 121.3 R-1 / D-121-63 — SPECIAL runtime gate (FLOATING_SCREEN + MULTI_STEP).
 * Runs after validateSpecialPlanComplete (unchanged). Structure only; the Ext re-checks
 * the same rules in the same order (specialValidateRunPlan).
 */

import { isValidFrameDescriptor, sameFrame } from './frameDescriptor';
import { PENDING_REVEAL_READINESS_LOCATOR } from './specialDraftAuthoring';
import type { FlowAction, FrameDescriptor, LoginFlowPlanDocument, SpecialFieldMapping } from './types';
import { isReservedActionKind } from './validateSpecialPlan';

export type SpecialRuntimeReason =
  | 'reserved_action_kind'
  | 'pattern_not_supported_yet'
  | 'plan_shape_unsupported'
  | 'readiness_invalid'
  | 'frame_invalid';

export type SpecialRuntimeGate = { ok: true } | { ok: false; reason: SpecialRuntimeReason };

export const MULTI_STEP_MIN_STEPS = 2;
export const MULTI_STEP_MAX_STEPS = 4;

function isCssMapping(m: unknown): m is SpecialFieldMapping {
  const row = m as SpecialFieldMapping;
  return (
    Boolean(row) &&
    typeof row.fieldId === 'string' &&
    row.fieldId.trim() !== '' &&
    row.locatorType === 'css' &&
    typeof row.locator === 'string' &&
    row.locator.trim() !== ''
  );
}

function isCssAction(action: FlowAction | undefined, kind: FlowAction['kind']): action is FlowAction {
  return (
    Boolean(action) &&
    action!.kind === kind &&
    action!.approvedForRuntime === true &&
    action!.locatorType === 'css' &&
    typeof action!.locator === 'string' &&
    action!.locator.trim() !== ''
  );
}

/**
 * One step's css mappings in one frame; null = plan_shape_unsupported, 'frame' = frame_invalid.
 * D-121-63 A: `allowEmpty` (an action-only MULTI_STEP step) → [].
 */
function stepRows(mappings: unknown[], allowEmpty = false): SpecialFieldMapping[] | null | 'frame' {
  if (mappings.length === 0 && allowEmpty) return [];
  if (mappings.length === 0 || !mappings.every(isCssMapping)) return null;
  const rows = mappings as SpecialFieldMapping[];
  if (rows.some((m) => m.frame !== undefined && !isValidFrameDescriptor(m.frame))) return 'frame';
  if (rows.some((m) => !sameFrame(m.frame, rows[0]!.frame))) return 'frame';
  return rows;
}

function framesValid(frames: Array<FrameDescriptor | undefined>): boolean {
  return frames.every((d) => d === undefined || isValidFrameDescriptor(d));
}

function hasField(rows: SpecialFieldMapping[], locator: string, frame: FrameDescriptor | undefined): boolean {
  return rows.some((m) => m.locator === locator && sameFrame(m.frame, frame));
}

/**
 * Readiness of an opener / transition: a declared field of the revealed step, never the
 * action itself, never a field of the step that is still on screen (`ownRows`).
 * D-121-63 B: into an action-only step (no rows) it is that step's exit (`revealedExit`).
 */
function readinessValid(
  action: FlowAction,
  revealedRows: SpecialFieldMapping[],
  ownRows: SpecialFieldMapping[] | null,
  revealedExit: FlowAction | null = null,
): boolean {
  const readiness = action.readiness;
  const revealedOk =
    revealedRows.length === 0
      ? revealedExit !== null &&
        readiness.locator === revealedExit.locator &&
        sameFrame(readiness.frame, revealedExit.frame)
      : hasField(revealedRows, readiness.locator, readiness.frame);
  return !(
    readiness.kind !== 'exact_one_eligible_css' ||
    readiness.locatorType !== 'css' ||
    !readiness.locator.trim() ||
    !(readiness.timeoutMs > 0) ||
    readiness.locator === PENDING_REVEAL_READINESS_LOCATOR ||
    (readiness.locator === action.locator && sameFrame(readiness.frame, action.frame)) ||
    !revealedOk ||
    (ownRows !== null && hasField(ownRows, readiness.locator, readiness.frame))
  );
}

function validateFloatingScreen(plan: LoginFlowPlanDocument, preamble: FlowAction[]): SpecialRuntimeGate {
  if (preamble.length !== 1 || !isCssAction(preamble[0], 'floating_opener')) {
    return { ok: false, reason: 'plan_shape_unsupported' };
  }
  if (plan.steps.length !== 1 || plan.steps[0]!.exitTransition) {
    return { ok: false, reason: 'plan_shape_unsupported' };
  }
  const opener = preamble[0]!;
  const rows = stepRows(plan.steps[0]!.fieldMappings);
  if (rows === null) return { ok: false, reason: 'plan_shape_unsupported' };
  if (rows === 'frame' || !framesValid([opener.frame, opener.readiness.frame])) {
    return { ok: false, reason: 'frame_invalid' };
  }
  if (!readinessValid(opener, rows, null)) return { ok: false, reason: 'readiness_invalid' };
  return { ok: true };
}

function validateMultiStep(plan: LoginFlowPlanDocument, preamble: FlowAction[]): SpecialRuntimeGate {
  const steps = plan.steps;
  if (preamble.length !== 0 || steps.length < MULTI_STEP_MIN_STEPS || steps.length > MULTI_STEP_MAX_STEPS) {
    return { ok: false, reason: 'plan_shape_unsupported' };
  }
  const last = steps.length - 1;
  for (let i = 0; i < steps.length; i += 1) {
    const exit = steps[i]!.exitTransition;
    if (i < last ? !isCssAction(exit, 'intermediate_transition') : exit) {
      return { ok: false, reason: 'plan_shape_unsupported' };
    }
  }
  // D-121-63 A: a middle step may be action-only; C: a fieldId may repeat across steps.
  const allRows: SpecialFieldMapping[][] = [];
  for (let s = 0; s < steps.length; s += 1) {
    const rows = stepRows(steps[s]!.fieldMappings, s > 0 && s < last);
    if (rows === null) return { ok: false, reason: 'plan_shape_unsupported' };
    if (rows === 'frame') return { ok: false, reason: 'frame_invalid' };
    allRows.push(rows);
  }
  for (let i = 0; i < last; i += 1) {
    const exit = steps[i]!.exitTransition!;
    if (!framesValid([exit.frame, exit.readiness.frame])) return { ok: false, reason: 'frame_invalid' };
    const revealedExit = steps[i + 1]!.exitTransition ?? null;
    if (!readinessValid(exit, allRows[i + 1]!, allRows[i]!, revealedExit)) {
      return { ok: false, reason: 'readiness_invalid' };
    }
  }
  return { ok: true };
}

export function validateSpecialRunnable(plan: LoginFlowPlanDocument): SpecialRuntimeGate {
  const preamble = plan.preambleActions ?? [];
  const exits = plan.steps.map((s) => s.exitTransition).filter(Boolean);
  if ([...preamble, ...exits].some((a) => isReservedActionKind(a!.kind))) {
    return { ok: false, reason: 'reserved_action_kind' };
  }
  if (plan.pattern === 'FLOATING_SCREEN') return validateFloatingScreen(plan, preamble);
  if (plan.pattern === 'MULTI_STEP') return validateMultiStep(plan, preamble);
  return { ok: false, reason: 'pattern_not_supported_yet' };
}
