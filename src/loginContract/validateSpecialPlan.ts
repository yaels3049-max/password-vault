/**
 * Phase 121.0 — SPECIAL plan completeness (ACTIVATE gate + snapshot shared rules).
 * Structure/completeness only — does not execute readiness or openers.
 * 121.1-IF: frame descriptors, per-step same-frame, R3 readiness, reserved kinds.
 */

import { isValidFrameDescriptor, sameFrame } from './frameDescriptor';
import {
  RESERVED_FLOW_ACTION_KINDS,
  type FlowAction,
  type FrameDescriptor,
  type LoginFlowPlanDocument,
  type SpecialFieldMapping,
  type StepFieldMapping,
} from './types';

export const LOGIN_CONTRACT_VALIDATE_ERROR = {
  corruptPlan: 'תוכנית זרימת הכניסה פגומה או לא ניתנת לפירוש.',
  missingPattern: 'חסר דפוס התחברות מיוחד בתוכנית.',
  emptySteps: 'תוכנית מיוחדת חייבת לכלול לפחות שלב אחד עם מיפוי שדות.',
  emptyFieldMappings: 'כל שלב חייב לכלול מיפוי שדות שאינו ריק.',
  floatingNeedsOpener: 'דפוס מסך צף דורש פעולת פתיחה מאושרת לריצה.',
  actionNotApprovedForRuntime: 'פעולת זרימה חייבת להיות מאושרת לריצה לפני הפעלה.',
  invalidReadiness: 'תנאי מוכנות בפעולת זרימה אינו תקין.',
  invalidFrame: 'מסגרת בתוכנית אינה תקינה או אינה מאובטחת (HTTPS).',
  mixedFrameInStep: 'כל שדות השלב חייבים להיות באותה מסגרת.',
  readinessIsSelf: 'תנאי המוכנות של פעולת פתיחה/מעבר אינו יכול להיות הכפתור עצמו.',
  readinessNotDeclaredField: 'תנאי המוכנות חייב להיות שדה כניסה שמופה בשלב הבא.',
  reservedActionKind: 'סוג פעולה זה שמור ואינו מאושר לשימוש.',
} as const;

export type LoginContractValidateCode = keyof typeof LOGIN_CONTRACT_VALIDATE_ERROR;

export type SpecialPlanValidation =
  | { ok: true }
  | { ok: false; code: LoginContractValidateCode; message: string };

function fail(code: LoginContractValidateCode): SpecialPlanValidation {
  return { ok: false, code, message: LOGIN_CONTRACT_VALIDATE_ERROR[code] };
}

function isCssMapping(m: StepFieldMapping): m is SpecialFieldMapping {
  return (
    typeof (m as SpecialFieldMapping).fieldId === 'string' &&
    (m as SpecialFieldMapping).locatorType === 'css' &&
    typeof (m as SpecialFieldMapping).locator === 'string'
  );
}

function frameOk(frame: FrameDescriptor | undefined): boolean {
  return frame === undefined || isValidFrameDescriptor(frame);
}

export function isReservedActionKind(kind: unknown): boolean {
  return (RESERVED_FLOW_ACTION_KINDS as readonly unknown[]).includes(kind);
}

/**
 * R3: readiness of an opener / transition must be a credential field mapped in the
 * step it reveals (same locator + same frame), and never the action itself.
 */
/**
 * D-121-63 A: a MULTI_STEP step other than the first and the last may have no field
 * mappings when it has an intermediate_transition exit (a choice screen).
 */
export function isActionOnlyStep(plan: LoginFlowPlanDocument, index: number): boolean {
  const step = plan.steps[index];
  return (
    plan.pattern === 'MULTI_STEP' &&
    index > 0 &&
    index < plan.steps.length - 1 &&
    Array.isArray(step?.fieldMappings) &&
    step!.fieldMappings.length === 0 &&
    step!.exitTransition?.kind === 'intermediate_transition'
  );
}

function validateAction(
  action: FlowAction,
  revealedStepMappings: SpecialFieldMapping[] | null,
  revealedStepExit: FlowAction | null = null,
): SpecialPlanValidation {
  if (isReservedActionKind(action.kind)) return fail('reservedActionKind');
  if (!frameOk(action.frame) || !frameOk(action.readiness.frame)) return fail('invalidFrame');
  if (!action.approvedForRuntime) return fail('actionNotApprovedForRuntime');
  if (
    action.readiness.kind !== 'exact_one_eligible_css' ||
    action.readiness.locatorType !== 'css' ||
    !action.readiness.locator.trim() ||
    !(action.readiness.timeoutMs > 0)
  ) {
    return fail('invalidReadiness');
  }
  if (
    action.readiness.locator === action.locator &&
    sameFrame(action.readiness.frame, action.frame)
  ) {
    return fail('readinessIsSelf');
  }
  // D-121-63 B: into an action-only step, readiness = that step's exit (locator + frame).
  const declared =
    revealedStepMappings !== null && revealedStepMappings.length === 0 && revealedStepExit
      ? action.readiness.locator === revealedStepExit.locator &&
        sameFrame(action.readiness.frame, revealedStepExit.frame)
      : (revealedStepMappings ?? []).some(
          (m) => m.locator === action.readiness.locator && sameFrame(m.frame, action.readiness.frame),
        );
  if (!declared) return fail('readinessNotDeclaredField');
  return { ok: true };
}

/**
 * Completeness gate for SPECIAL ACTIVATE / future Admin Test FAIL CLOSED.
 * Rejects empty/corrupt ACTIVE candidates (121.0 minimum).
 */
export function validateSpecialPlanComplete(plan: LoginFlowPlanDocument): SpecialPlanValidation {
  if (!plan.pattern) return fail('missingPattern');
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) return fail('emptySteps');

  const stepMappings: SpecialFieldMapping[][] = [];
  let hasNonEmptyMappings = false;
  for (let s = 0; s < plan.steps.length; s += 1) {
    const step = plan.steps[s]!;
    if (isActionOnlyStep(plan, s)) {
      stepMappings.push([]);
      continue;
    }
    if (!step.fieldMappings || step.fieldMappings.length === 0) return fail('emptyFieldMappings');
    const rows: SpecialFieldMapping[] = [];
    for (const mapping of step.fieldMappings) {
      if (!isCssMapping(mapping) || !mapping.fieldId.trim() || !mapping.locator.trim()) {
        return fail('emptyFieldMappings');
      }
      if (!frameOk(mapping.frame)) return fail('invalidFrame');
      rows.push(mapping);
      hasNonEmptyMappings = true;
    }
    if (rows.some((m) => !sameFrame(m.frame, rows[0]!.frame))) return fail('mixedFrameInStep');
    stepMappings.push(rows);
  }
  if (!hasNonEmptyMappings) return fail('emptySteps');

  for (let i = 0; i < plan.steps.length; i += 1) {
    const exit = plan.steps[i]!.exitTransition;
    if (exit) {
      const exitOk = validateAction(exit, stepMappings[i + 1] ?? null, plan.steps[i + 1]?.exitTransition ?? null);
      if (!exitOk.ok) return exitOk;
    }
  }

  const preamble = plan.preambleActions ?? [];
  for (const action of preamble) {
    const actionOk = validateAction(action, stepMappings[0] ?? null);
    if (!actionOk.ok) return actionOk;
  }

  if (plan.pattern === 'FLOATING_SCREEN' || plan.pattern === 'FLOATING_SCREEN_MULTI_STEP') {
    const opener = preamble.find((a) => a.kind === 'floating_opener' && a.approvedForRuntime);
    if (!opener) return fail('floatingNeedsOpener');
  }

  return { ok: true };
}
