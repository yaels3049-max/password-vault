/**
 * Phase 121.0 — DRAFT/ACTIVE login contract types (persist representation).
 * STANDARD path remains Phase 120 autofillProfile; SPECIAL plan lives only in loginFlowPlan.
 */

import type { AutofillFieldMapping } from '../autofill/validatedProfile';

export type LoginContractMode = 'STANDARD' | 'SPECIAL';

export type SpecialLoginPattern =
  | 'FLOATING_SCREEN'
  | 'MULTI_STEP'
  | 'FLOATING_SCREEN_MULTI_STEP';

export type FlowActionKind = 'floating_opener' | 'intermediate_transition';

/** Names reserved for future kinds; parse / validate / click MUST reject them (§4.10). */
export const RESERVED_FLOW_ACTION_KINDS = ['final_submit'] as const;

/**
 * 121.1-IF — depth-1 only: `<iframe>` element located in the TOP document.
 * Absent on an element = top document. No frameId / documentId / src / tab id stored.
 */
export interface FrameDescriptor {
  /** Exact-one CSS for the `<iframe>` element in the top document. */
  frameLocator: string;
  /** HTTPS exact origin of that frame's document (Admin-approved). */
  frameOrigin: string;
}

/** Q3 minimal readiness vocabulary — structure only in 121.0 (no execution). */
export interface ReadinessCondition {
  kind: 'exact_one_eligible_css';
  locatorType: 'css';
  locator: string;
  timeoutMs: number;
  frame?: FrameDescriptor;
}

export interface FlowAction {
  actionId: string;
  kind: FlowActionKind;
  label: string;
  locatorType: 'css';
  locator: string;
  approvedForAuthoringContinuation?: boolean;
  approvedForRuntime: boolean;
  readiness: ReadinessCondition;
  frame?: FrameDescriptor;
}

/** SPECIAL-only extension of the STANDARD mapping type (which stays unchanged). */
export interface SpecialFieldMapping extends AutofillFieldMapping {
  frame?: FrameDescriptor;
}

/**
 * SplitFieldMapping reserved for 121.6 — unused in 121.0.
 * Kept as a branded placeholder so ACTIVE validation can reject unknown shapes.
 */
export type SplitFieldMapping = {
  readonly __splitFieldMappingUnusedUntil1216: true;
};

export type StepFieldMapping = SpecialFieldMapping | SplitFieldMapping;

export interface FlowStep {
  stepId: string;
  fieldMappings: StepFieldMapping[];
  exitTransition?: FlowAction;
}

export interface LoginFlowPlanDocument {
  planVersion: number;
  pattern: SpecialLoginPattern;
  preambleActions?: FlowAction[];
  steps: FlowStep[];
}

export interface LoginFlowPlanBag {
  draft: LoginFlowPlanDocument | null;
  active: LoginFlowPlanDocument | null;
}

export type LoginContractActivation =
  | { mode: 'STANDARD' }
  | { mode: 'SPECIAL'; activePlanVersion: number };

export type ResolvedActiveLoginContract =
  | { mode: 'STANDARD' }
  | {
      mode: 'SPECIAL';
      plan: LoginFlowPlanDocument;
      activePlanVersion: number;
    }
  | { mode: 'SPECIAL_INVALID'; reason: string };

export interface ImmutableDraftSnapshot {
  snapshotId: string;
  createdAt: string;
  /** Deep-frozen copy of draft at snapshot time. */
  plan: LoginFlowPlanDocument;
  /** Shared completeness check with ACTIVE ACTIVATE gate. */
  isComplete: boolean;
}

export type LoginContractActivateTransition =
  | 'STANDARD_TO_STANDARD'
  | 'STANDARD_TO_SPECIAL'
  | 'SPECIAL_TO_SPECIAL'
  | 'SPECIAL_TO_STANDARD';
