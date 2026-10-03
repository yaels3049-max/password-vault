/**
 * Phase 121.0 — DRAFT/ACTIVE login contract model (persist + ACTIVATE planner).
 * No SPECIAL runtime / orchestrator / Admin Test SPECIAL execution.
 */

export {
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
} from './constants';

export type {
  LoginContractMode,
  SpecialLoginPattern,
  FlowActionKind,
  ReadinessCondition,
  FlowAction,
  FlowStep,
  StepFieldMapping,
  SplitFieldMapping,
  LoginFlowPlanDocument,
  LoginFlowPlanBag,
  LoginContractActivation,
  ResolvedActiveLoginContract,
  ImmutableDraftSnapshot,
  LoginContractActivateTransition,
} from './types';

export {
  parseLoginFlowPlanDocument,
  serializeLoginFlowPlanDocument,
  parseLoginFlowPlanBag,
  serializeLoginFlowPlanBag,
  parseLoginContractActivation,
  serializeLoginContractActivation,
  readLoginContractActivationFromMetadata,
  readLoginFlowPlanFromMetadata,
  deepClonePlanDocument,
} from './parse';

export {
  validateSpecialPlanComplete,
  LOGIN_CONTRACT_VALIDATE_ERROR,
} from './validateSpecialPlan';
export type { SpecialPlanValidation, LoginContractValidateCode } from './validateSpecialPlan';

export { createImmutableDraftSnapshot } from './draftSnapshot';
export type { DraftSnapshotResult } from './draftSnapshot';

export { resolveActiveLoginContract, peekLoginContractActivationMode } from './resolve';

export {
  planLoginContractActivate,
  assertLoginContractMetadataConsistent,
  LOGIN_CONTRACT_ACTIVATE_ERROR,
} from './planActivate';
export type {
  LoginContractActivateIntent,
  LoginContractActivatePlan,
  LoginContractActivateErrorCode,
} from './planActivate';

export {
  mergeLoginContractMetadata,
  stripLoginContractControlKeys,
  LOGIN_CONTRACT_MERGE_ERROR,
} from './merge';

export {
  ensureSpecialDraft,
  isSpecialLoginPattern,
  canPerformAuthoringClick,
  approveActionForAuthoringContinuation,
  approveActionForRuntime,
  rejectAuthoringContinuation,
  upsertPreambleAction,
  upsertStepFieldMappings,
  setStepExitTransition,
  placeTransitionAsStepExit,
  migrateLegacyPreambleTransitions,
  revealedStepIdFor,
  assertNoFrameInAutofillMappings,
  assertSpecialWriteKeepsAutofillProfile,
  SPECIAL_AUTOFILL_WRITE_FORBIDDEN_HE,
  listDraftActions,
  pickNewActionCandidate,
  selectPendingForManualAnalyze,
  selectPendingAfterContinue,
  removeDraftAction,
  draftCompletenessPreview,
  createActionCandidate,
  createDefaultReadiness,
  createPendingRevealReadiness,
  isPendingRevealReadiness,
  isSelfReadiness,
  deriveRevealReadiness,
  normalizeLegacyDraftReadiness,
  dropStaleOpenerCandidates,
  dropPatternIrrelevantActions,
  actionKindRelevantForPattern,
  rederiveRevealReadiness,
  readinessModeFor,
  readinessTargetFor,
  listApprovedFrameOrigins,
  actionIdentity,
  PENDING_REVEAL_READINESS_LOCATOR,
  DEFAULT_READINESS_TIMEOUT_MS,
  SPECIAL_PATTERN_LABEL_HE,
  LOGIN_PATTERN_LABEL_HE,
} from './specialDraftAuthoring';

export {
  FRAME_TOP_KEY,
  FRAME_TOP_LABEL_HE,
  FRAME_INSIDE_LABEL_HE,
  isHttpsExactOrigin,
  isValidFrameDescriptor,
  isFrameOriginApproved,
  frameKey,
  sameFrame,
  cloneFrameDescriptor,
  frameLocationLabelHe,
} from './frameDescriptor';
export { parseFrameDescriptor } from './parse';
export { isActionOnlyStep, isReservedActionKind } from './validateSpecialPlan';
export { RESERVED_FLOW_ACTION_KINDS } from './types';
export type { FrameDescriptor, SpecialFieldMapping } from './types';
export type { AuthoringLoginPattern } from './specialDraftAuthoring';

export {
  resolveSpecialAuthoringEntry,
} from './specialAuthoringEntry';

export { MULTI_STEP_MAX_STEPS, MULTI_STEP_MIN_STEPS, validateSpecialRunnable } from './runtimeGate';
export type { SpecialRuntimeGate, SpecialRuntimeReason } from './runtimeGate';
export type { SpecialAuthoringEntryResolution } from './specialAuthoringEntry';
