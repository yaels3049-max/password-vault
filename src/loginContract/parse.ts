/**
 * Phase 121.0 — parse / serialize loginContractActivation + loginFlowPlan.
 * Structure only; no SPECIAL runtime.
 */

import {
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
} from './constants';
import { isHttpsExactOrigin } from './frameDescriptor';
import type {
  FlowAction,
  FlowStep,
  FrameDescriptor,
  LoginContractActivation,
  LoginFlowPlanBag,
  LoginFlowPlanDocument,
  ReadinessCondition,
  SpecialFieldMapping,
  SpecialLoginPattern,
  StepFieldMapping,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSpecialPattern(value: unknown): value is SpecialLoginPattern {
  return (
    value === 'FLOATING_SCREEN' ||
    value === 'MULTI_STEP' ||
    value === 'FLOATING_SCREEN_MULTI_STEP'
  );
}

/**
 * 121.1-IF — frame descriptor: record with non-empty `frameLocator` and HTTPS exact-origin
 * `frameOrigin`. Invalid → null so the whole document is corrupt (never silently dropped).
 */
export function parseFrameDescriptor(raw: unknown): FrameDescriptor | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.frameLocator !== 'string' || !raw.frameLocator.trim()) return null;
  if (typeof raw.frameOrigin !== 'string') return null;
  const frameOrigin = raw.frameOrigin.trim();
  if (!isHttpsExactOrigin(frameOrigin)) return null;
  return { frameLocator: raw.frameLocator.trim(), frameOrigin };
}

/** `frame` absent → ok/undefined; present+valid → descriptor; present+invalid → corrupt. */
function parseOptionalFrame(
  raw: Record<string, unknown>,
): { ok: true; frame?: FrameDescriptor } | { ok: false } {
  if (raw.frame === undefined) return { ok: true };
  const frame = parseFrameDescriptor(raw.frame);
  return frame ? { ok: true, frame } : { ok: false };
}

function parseReadiness(raw: unknown): ReadinessCondition | null {
  if (!isRecord(raw)) return null;
  if (raw.kind !== 'exact_one_eligible_css') return null;
  if (raw.locatorType !== 'css') return null;
  if (typeof raw.locator !== 'string' || !raw.locator.trim()) return null;
  if (typeof raw.timeoutMs !== 'number' || !Number.isFinite(raw.timeoutMs) || raw.timeoutMs <= 0) {
    return null;
  }
  const frame = parseOptionalFrame(raw);
  if (!frame.ok) return null;
  const readiness: ReadinessCondition = {
    kind: 'exact_one_eligible_css',
    locatorType: 'css',
    locator: raw.locator.trim(),
    timeoutMs: raw.timeoutMs,
  };
  if (frame.frame) readiness.frame = frame.frame;
  return readiness;
}

function parseFlowAction(raw: unknown): FlowAction | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.actionId !== 'string' || !raw.actionId.trim()) return null;
  // Reserved kinds (e.g. final_submit) are not an allowed kind → corrupt.
  if (raw.kind !== 'floating_opener' && raw.kind !== 'intermediate_transition') return null;
  if (typeof raw.label !== 'string') return null;
  if (raw.locatorType !== 'css') return null;
  if (typeof raw.locator !== 'string' || !raw.locator.trim()) return null;
  if (typeof raw.approvedForRuntime !== 'boolean') return null;
  const readiness = parseReadiness(raw.readiness);
  if (!readiness) return null;
  const frame = parseOptionalFrame(raw);
  if (!frame.ok) return null;
  const action: FlowAction = {
    actionId: raw.actionId.trim(),
    kind: raw.kind,
    label: raw.label,
    locatorType: 'css',
    locator: raw.locator.trim(),
    approvedForRuntime: raw.approvedForRuntime,
    readiness,
  };
  if (typeof raw.approvedForAuthoringContinuation === 'boolean') {
    action.approvedForAuthoringContinuation = raw.approvedForAuthoringContinuation;
  }
  if (frame.frame) action.frame = frame.frame;
  return action;
}

function parseFieldMapping(raw: unknown): StepFieldMapping | null {
  if (!isRecord(raw)) return null;
  // Reject Split placeholder objects if ever present with the brand key alone.
  if (raw.__splitFieldMappingUnusedUntil1216 === true) {
    return null;
  }
  if (typeof raw.fieldId !== 'string' || !raw.fieldId.trim()) return null;
  if (raw.locatorType !== 'css') return null;
  if (typeof raw.locator !== 'string' || !raw.locator.trim()) return null;
  const frame = parseOptionalFrame(raw);
  if (!frame.ok) return null;
  const mapping: SpecialFieldMapping = {
    fieldId: raw.fieldId.trim(),
    locatorType: 'css',
    locator: raw.locator.trim(),
  };
  if (frame.frame) mapping.frame = frame.frame;
  return mapping;
}

function serializeFrame(frame: FrameDescriptor): Record<string, unknown> {
  return { frameLocator: frame.frameLocator, frameOrigin: frame.frameOrigin };
}

function serializeReadiness(r: ReadinessCondition): Record<string, unknown> {
  const out: Record<string, unknown> = {
    kind: r.kind,
    locatorType: r.locatorType,
    locator: r.locator,
    timeoutMs: r.timeoutMs,
  };
  if (r.frame) out.frame = serializeFrame(r.frame);
  return out;
}

function serializeAction(a: FlowAction): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a, readiness: serializeReadiness(a.readiness) };
  if (a.frame) out.frame = serializeFrame(a.frame);
  return out;
}

function parseFlowStep(raw: unknown): FlowStep | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.stepId !== 'string' || !raw.stepId.trim()) return null;
  if (!Array.isArray(raw.fieldMappings)) return null;
  const fieldMappings: StepFieldMapping[] = [];
  for (const entry of raw.fieldMappings) {
    const mapping = parseFieldMapping(entry);
    if (!mapping) return null;
    fieldMappings.push(mapping);
  }
  const step: FlowStep = {
    stepId: raw.stepId.trim(),
    fieldMappings,
  };
  if (raw.exitTransition !== undefined) {
    const exit = parseFlowAction(raw.exitTransition);
    if (!exit) return null;
    step.exitTransition = exit;
  }
  return step;
}

/**
 * Parse a LoginFlowPlanDocument. Returns null if corrupt / unparseable.
 * Incomplete (empty steps) may still parse — completeness is a separate gate.
 */
export function parseLoginFlowPlanDocument(raw: unknown): LoginFlowPlanDocument | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.planVersion !== 'number' || !Number.isInteger(raw.planVersion) || raw.planVersion < 1) {
    return null;
  }
  if (!isSpecialPattern(raw.pattern)) return null;
  if (!Array.isArray(raw.steps)) return null;
  const steps: FlowStep[] = [];
  for (const entry of raw.steps) {
    const step = parseFlowStep(entry);
    if (!step) return null;
    steps.push(step);
  }
  const doc: LoginFlowPlanDocument = {
    planVersion: raw.planVersion,
    pattern: raw.pattern,
    steps,
  };
  if (raw.preambleActions !== undefined) {
    if (!Array.isArray(raw.preambleActions)) return null;
    const preambleActions: FlowAction[] = [];
    for (const entry of raw.preambleActions) {
      const action = parseFlowAction(entry);
      if (!action) return null;
      preambleActions.push(action);
    }
    doc.preambleActions = preambleActions;
  }
  return doc;
}

export function serializeLoginFlowPlanDocument(
  doc: LoginFlowPlanDocument,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    planVersion: doc.planVersion,
    pattern: doc.pattern,
    steps: doc.steps.map((step) => {
      const row: Record<string, unknown> = {
        stepId: step.stepId,
        fieldMappings: step.fieldMappings.map((m) => {
          const mapping = m as SpecialFieldMapping;
          const outMapping: Record<string, unknown> = {
            fieldId: mapping.fieldId,
            locatorType: 'css',
            locator: mapping.locator,
          };
          if (mapping.frame) outMapping.frame = serializeFrame(mapping.frame);
          return outMapping;
        }),
      };
      if (step.exitTransition) {
        row.exitTransition = serializeAction(step.exitTransition);
      }
      return row;
    }),
  };
  if (doc.preambleActions && doc.preambleActions.length > 0) {
    out.preambleActions = doc.preambleActions.map(serializeAction);
  }
  return out;
}

export function parseLoginFlowPlanBag(raw: unknown): LoginFlowPlanBag | null {
  if (raw === null || raw === undefined) {
    return { draft: null, active: null };
  }
  if (!isRecord(raw)) return null;
  let draft: LoginFlowPlanDocument | null = null;
  let active: LoginFlowPlanDocument | null = null;
  if (raw.draft !== null && raw.draft !== undefined) {
    draft = parseLoginFlowPlanDocument(raw.draft);
    if (!draft) return null;
  }
  if (raw.active !== null && raw.active !== undefined) {
    active = parseLoginFlowPlanDocument(raw.active);
    if (!active) return null;
  }
  return { draft, active };
}

export function serializeLoginFlowPlanBag(bag: LoginFlowPlanBag): Record<string, unknown> {
  return {
    draft: bag.draft ? serializeLoginFlowPlanDocument(bag.draft) : null,
    active: bag.active ? serializeLoginFlowPlanDocument(bag.active) : null,
  };
}

/**
 * Parse discriminator. Missing / null / unrecognized → STANDARD (backward compat).
 * Explicit SPECIAL with invalid shape → null (corrupt — callers treat as fail-closed at resolve).
 */
export function parseLoginContractActivation(raw: unknown): LoginContractActivation | 'CORRUPT_SPECIAL' | null {
  if (raw === null || raw === undefined) {
    return null; // missing ≡ STANDARD at resolve
  }
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.mode === 'STANDARD') {
    return { mode: 'STANDARD' };
  }
  if (raw.mode === 'SPECIAL') {
    if (
      typeof raw.activePlanVersion !== 'number' ||
      !Number.isInteger(raw.activePlanVersion) ||
      raw.activePlanVersion < 1
    ) {
      return 'CORRUPT_SPECIAL';
    }
    return { mode: 'SPECIAL', activePlanVersion: raw.activePlanVersion };
  }
  // Unrecognized → treat as missing ≡ STANDARD
  return null;
}

export function serializeLoginContractActivation(
  activation: LoginContractActivation,
): Record<string, unknown> {
  if (activation.mode === 'STANDARD') {
    return { mode: 'STANDARD' };
  }
  return {
    mode: 'SPECIAL',
    activePlanVersion: activation.activePlanVersion,
  };
}

export function readLoginContractActivationFromMetadata(
  metadata: unknown,
): LoginContractActivation | 'CORRUPT_SPECIAL' | null {
  if (!isRecord(metadata)) return null;
  return parseLoginContractActivation(metadata[LOGIN_CONTRACT_ACTIVATION_META_KEY]);
}

export function readLoginFlowPlanFromMetadata(metadata: unknown): LoginFlowPlanBag | null {
  if (!isRecord(metadata)) return { draft: null, active: null };
  if (!Object.prototype.hasOwnProperty.call(metadata, LOGIN_FLOW_PLAN_META_KEY)) {
    return { draft: null, active: null };
  }
  return parseLoginFlowPlanBag(metadata[LOGIN_FLOW_PLAN_META_KEY]);
}

export function deepClonePlanDocument(doc: LoginFlowPlanDocument): LoginFlowPlanDocument {
  return parseLoginFlowPlanDocument(serializeLoginFlowPlanDocument(doc))!;
}
