/**
 * Phase 118 — Assisted Mapping Agent contracts.
 * Authoring-only; never used by Managed Autofill runtime.
 */

export const INSPECTION_CAPABILITY_SINGLE_PAGE_TOP = 'single_page_top' as const;
export const AGENT_TASK_PROPOSE_FIELD_MAPPINGS = 'propose_field_mappings' as const;

export type InspectionCapability = typeof INSPECTION_CAPABILITY_SINGLE_PAGE_TOP;
export type AgentTask = typeof AGENT_TASK_PROPOSE_FIELD_MAPPINGS;

export const SAFE_PAGE_STRUCTURE_SCHEMA_VERSION = 1 as const;
export const MAPPING_PROPOSAL_SCHEMA_VERSION = 1 as const;

export const ASSISTED_MAPPING_MAX_INPUTS = 40;
export const ASSISTED_MAPPING_MAX_STRING_LEN = 120;
export const ASSISTED_MAPPING_MAX_LOCATOR_CANDIDATES = 8;
export const ASSISTED_MAPPING_INSPECT_TIMEOUT_MS = 60_000;
export const ASSISTED_MAPPING_AGENT_TIMEOUT_MS = 45_000;

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export type EvidenceCategory =
  | 'semantic_role_match'
  | 'label_affinity'
  | 'type_affinity'
  | 'autocomplete_affinity'
  | 'id_name_affinity'
  | 'form_grouping'
  | 'uniqueness_among_candidates'
  | 'other_structured';

export type LocatorStabilityHint = 'id' | 'name' | 'autocomplete' | 'aria' | 'other';

export interface LocatorCandidate {
  strategy: 'css';
  locator: string;
  stabilityHint: LocatorStabilityHint;
}

export interface SafePageInput {
  inputId: string;
  tagName: string;
  type?: string;
  idAttr?: string;
  nameAttr?: string;
  autocomplete?: string;
  placeholder?: string;
  ariaLabel?: string;
  associatedLabelText?: string;
  nearbySafeText?: string;
  visible: boolean;
  editable: boolean;
  disabled: boolean;
  readOnly: boolean;
  locatorCandidates: LocatorCandidate[];
}

export interface SafePageStructure {
  schemaVersion: typeof SAFE_PAGE_STRUCTURE_SCHEMA_VERSION;
  capturedAt: string;
  finalUrl: string;
  origin: string;
  title?: string;
  documentLanguage?: string;
  inputs: SafePageInput[];
  limits: {
    truncated: boolean;
    maxInputsApplied: number;
  };
}

export interface CredentialSchemaField {
  fieldId: string;
  label: string;
  type?: string;
}

export interface MappingEvidence {
  category: EvidenceCategory;
  noteCode?: string;
}

export interface MappingProposalRow {
  fieldId: string;
  locatorType: 'css';
  locator: string;
  observedInputId: string;
  confidence: ConfidenceLevel;
  modelConfidence?: ConfidenceLevel;
  evidence: MappingEvidence[];
}

export type MappingProposalStatus =
  | 'ok'
  | 'partial'
  | 'no_confident_mapping'
  | 'error';

export type MappingProposalErrorCode =
  | 'timeout'
  | 'provider_error'
  | 'invalid_page'
  | 'origin_mismatch'
  | 'unauthorized'
  | 'extension_unavailable'
  | 'missing_schema'
  | 'missing_login_entry'
  | 'inspect_failed'
  | 'tab_load_timeout'
  | 'unsupported_capability';

export interface StructuredMappingProposal {
  schemaVersion: typeof MAPPING_PROPOSAL_SCHEMA_VERSION;
  requestId: string;
  serviceId: string;
  status: MappingProposalStatus;
  errorCode?: MappingProposalErrorCode;
  proposals: MappingProposalRow[];
  unmappedFieldIds: string[];
  warnings?: string[];
}

/** Raw model output before deterministic safety validation. */
export interface MappingLlmRawProposal {
  fieldId: string;
  observedInputId: string;
  locator: string;
  modelConfidence: ConfidenceLevel;
  evidence: MappingEvidence[];
}

export interface MappingLlmRequest {
  systemContractVersion: string;
  inspectionCapability: InspectionCapability;
  agentTask: AgentTask;
  schema: CredentialSchemaField[];
  page: SafePageStructure;
  constraints: {
    locatorType: 'css';
    requireExactOneCandidatePreference: true;
  };
}

export interface MappingLlmRawResponse {
  proposals: MappingLlmRawProposal[];
}

export interface MappingLlmProvider {
  proposeMappings(input: MappingLlmRequest): Promise<MappingLlmRawResponse>;
}

export const ADMIN_LOGIN_PAGE_INSPECT_MESSAGE = 'ADMIN_LOGIN_PAGE_INSPECT';
export const ADMIN_VISUAL_MAPPING_START_MESSAGE = 'ADMIN_VISUAL_MAPPING_START';

export const ANALYZE_LOGIN_PAGE_LABEL_HE = 'נתח דף כניסה';
export const ANALYZING_LOGIN_PAGE_LABEL_HE = 'מנתח דף כניסה...';
export const NOT_CONFIDENTLY_MAPPED_LABEL_HE = 'לא מופה בביטחון';
export const ANALYZE_FAILED_LABEL_HE =
  'לא ניתן לנתח את דף הכניסה כרגע. נסו שוב.';
export const ANALYZE_NEED_SCHEMA_LABEL_HE =
  'יש להגדיר שדות הזדהות לפני ניתוח.';
export const ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE =
  'יש להגדיר כתובת כניסה לפני ניתוח.';

export const VISUAL_MAPPING_LABEL_HE = 'מיפוי חזותי';
export const VISUAL_MAPPING_IN_PROGRESS_LABEL_HE =
  'לחצו על השדה בדף הכניסה שנפתח...';
export const VISUAL_MAPPING_FAILED_LABEL_HE =
  'לא ניתן להשלים מיפוי חזותי כרגע. נסו שוב.';
export const VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE =
  'יש להגדיר כתובת כניסה לפני מיפוי חזותי.';
export const VISUAL_MAPPING_SUCCESS_LABEL_HE =
  'הבורר נגזר מהשדה שנבחר. בדקו ושמרו ידנית.';
export const VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE =
  'האלמנט שנבחר אינו נתמך למיפוי. בחרו שדה קלט גלוי.';
export const VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE =
  'המקור בדף הכניסה אינו תואם. המיפוי בוטל.';
