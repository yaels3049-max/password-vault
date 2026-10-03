export {
  ADMIN_LOGIN_PAGE_INSPECT_MESSAGE,
  ADMIN_VISUAL_MAPPING_START_MESSAGE,
  ADMIN_CURRENT_TAB_INSPECT_MESSAGE,
  ADMIN_CURRENT_TAB_VISUAL_MAPPING_START_MESSAGE,
  ADMIN_AUTHORING_CLICK_APPROVED_MESSAGE,
  ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL_MESSAGE,
  ADMIN_VISUAL_MAPPING_CANCEL_MESSAGE,
  ADMIN_VISUAL_PICK_TIMEOUT_MS,
  ADMIN_VISUAL_PICK_HUB_GRACE_MS,
  AGENT_TASK_PROPOSE_FIELD_MAPPINGS,
  ANALYZE_FAILED_LABEL_HE,
  ANALYZE_LOGIN_PAGE_LABEL_HE,
  ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE,
  ANALYZE_NEED_SCHEMA_LABEL_HE,
  ANALYZING_LOGIN_PAGE_LABEL_HE,
  INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
  NOT_CONFIDENTLY_MAPPED_LABEL_HE,
  VISUAL_MAPPING_FAILED_LABEL_HE,
  VISUAL_MAPPING_IN_PROGRESS_LABEL_HE,
  VISUAL_MAPPING_LABEL_HE,
  VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE,
  VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE,
  VISUAL_MAPPING_SUCCESS_LABEL_HE,
  VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
  VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE,
  IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE,
  LOCATOR_NOT_DETERMINISTIC_LABEL_HE,
  FRAME_APPROVAL_PROMPT_HE,
  FRAME_APPROVE_LABEL_HE,
  FRAME_REJECT_LABEL_HE,
  SURFACE_NOT_OPENED_HE,
  SURFACE_NOT_LOGIN_HE,
  MAPPED_FIELD_NOT_APPEARED_HE,
  SURFACE_FRAME_NOT_ADDRESSABLE_HE,
  AUTHORING_TEST_NOT_PROVEN_REASON,
  AUTHORING_TEST_NOT_PROVEN_HE,
  VISUAL_ACTION_UNSUPPORTED_TARGET_HE,
  UNSUPPORTED_NESTED_FRAME_HE,
  UNSUPPORTED_SHADOW_DOM_HE,
  UNSUPPORTED_NON_HTTPS_FRAME_HE,
  FRAME_NOT_ADDRESSABLE_HE,
  FRAME_ORIGIN_CHANGED_HE,
  FRAME_NOT_LOADED_HE,
  FRAME_CORRELATION_UNAVAILABLE_HE,
  VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE,
} from './types';
export type {
  FramedSurface,
  FrameUnsupportedSummary,
  CredentialSchemaField,
  InspectionCapability,
  MappingLlmProvider,
  SafePageStructure,
  StructuredMappingProposal,
  ManagedTargetIdentificationState,
  IdentifiedManagedIneligibleRow,
} from './types';
export {
  ADMIN_INSPECT_READINESS_CAPABILITY_ID,
  ADMIN_INSPECT_READINESS_ENABLED,
  LOGIN_EXPERIENCE_CAPABILITY_CATALOG,
  SUPPORTED_INSPECTION_CAPABILITIES,
  defaultInspectionCapability,
  isKnownLoginExperienceCapability,
  isSupportedInspectionCapability,
  resolveInspectionCapability,
  unsupportedCapabilityProposal,
} from './capabilities';
export type {
  LoginExperienceCapabilityId,
  SupportedInspectionCapability,
} from './capabilities';
export { applyConfidentPrefill, applyHighConfidencePrefill, applySafetyAndConfidence } from './safetyValidation';
export {
  assertLocatorDeterministic,
  locatorCandidateIsDeterministic,
} from './locatorDeterminism';
export {
  parseFieldAuthoringBag,
  serializeFieldAuthoringBag,
  visualTargetsEquivalent,
  applyVisualMappingAuthoring,
  markManualEdit,
  stampAdminTestPassed,
  adminTestSuccessVisible,
  upsertFieldAuthoring,
  CONFIDENCE_HIGH_LABEL_HE,
  CONFIDENCE_MEDIUM_LABEL_HE,
  CONFIDENCE_MEDIUM_REVIEW_HINT_HE,
  VISUAL_VERIFIED_LABEL_HE,
  MANUAL_EDITED_LABEL_HE,
  ADMIN_TEST_PASSED_LABEL_HE,
  type FieldAuthoringEntry,
} from './fieldAuthoring';
export {
  MockMappingLlmProvider,
  schemaFromLoginFields,
  type MockMappingScenario,
} from './mockProvider';
export {
  assistedMappingAuditSummary,
  getMappingLlmProvider,
  proposeFieldMappings,
  resetMappingLlmProviderToDefault,
  resetMappingLlmProviderToMock,
  setMappingLlmProviderForTests,
} from './agentService';
export {
  EDGE_FUNCTION_NAME,
  RemoteOpenAiMappingLlmProvider,
  assistedMappingProviderMode,
} from './openaiRemoteProvider';
export { analyzeLoginPageForMapping } from './analyzeLoginPage';
export { startVisualMappingForField, cancelVisualMappingForField } from './visualMapping';
export {
  analyzeCurrentTabForMapping,
  analyzeSpecialCurrentSurface,
  startCurrentTabVisualMapping,
  cancelCurrentTabVisualMapping,
  performApprovedAuthoringClick,
  mergeSurfaceFieldProposals,
  unsupportedMessagesHe,
  authoringClickFailureMessageHe,
  interpretCurrentTabVisualResponse,
} from './currentTabAuthoring';
export { proposeSpecialActionCandidates } from './specialAnalyzeRouting';
export {
  followUpKindsForPattern,
  revealedSurfaceKeys,
  selectFollowUpAfterContinue,
} from './followUpSelection';
export type {
  SpecialActionCandidateObservation,
  SpecialActionProposal,
} from './specialAnalyzeRouting';
export type {
  SpecialCurrentSurfaceAnalyzeResult,
  FramedFieldProposal,
  SpecialVisualMappingResult,
} from './currentTabAuthoring';
export type { VisualMappingResult } from './visualMapping';
