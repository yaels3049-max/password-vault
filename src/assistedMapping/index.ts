export {
  ADMIN_LOGIN_PAGE_INSPECT_MESSAGE,
  ADMIN_VISUAL_MAPPING_START_MESSAGE,
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
} from './types';
export type {
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
export { startVisualMappingForField } from './visualMapping';
export type { VisualMappingResult } from './visualMapping';
