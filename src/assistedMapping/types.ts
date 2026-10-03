/**
 * Phase 118 — Assisted Mapping Agent contracts.
 * Authoring-only; never used by Managed Autofill runtime.
 */

import type { FrameDescriptor } from '../loginContract/types';
import type { SpecialActionCandidateObservation } from './specialAnalyzeRouting';

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
  /**
   * querySelectorAll(locator).length at inspect time (120.9).
   * Exact-one Managed prefill requires matchCount === 1.
   */
  matchCount?: number;
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
  /** Observation / identification presence — NOT Managed eligibility (120.4 §1A). */
  visible: boolean;
  /**
   * Managed Autofill eligibility = shared isSafeFillTarget.
   * Approvable mappings require true. Distinct from `visible`.
   */
  managedEligible: boolean;
  editable: boolean;
  disabled: boolean;
  readOnly: boolean;
  locatorCandidates: LocatorCandidate[];
}

/** Normative 120.4 three-state model (I3). */
export type ManagedTargetIdentificationState =
  | 'NOT_IDENTIFIED'
  | 'IDENTIFIED_AND_MANAGED_ELIGIBLE'
  | 'IDENTIFIED_BUT_MANAGED_INELIGIBLE';

/** Parallel Analyze channel for state #3 — never collapsed to NOT_IDENTIFIED. */
export interface IdentifiedManagedIneligibleRow {
  fieldId: string;
  observedInputId: string;
  locator: string;
  state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE';
  reason: 'managed_ineligible';
  detail?: string;
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
  /** Optional semantic disambiguation — Agent meaning, not identity (120.8). */
  description?: string;
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
  /**
   * 120.9 — exact-one + same observed target. Semantic HIGH/MEDIUM may remain
   * when false; locator must not be Managed-prefilled/persisted as approvable.
   */
  locatorDeterministic?: boolean;
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
  /** State #3 channel — identified but not Managed-approvable (120.4). */
  identifiedButManagedIneligible?: IdentifiedManagedIneligibleRow[];
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

/** Phase 121.1 — existing-tab inspect (MUST NOT open Login Entry). */
export const ADMIN_CURRENT_TAB_INSPECT_MESSAGE = 'ADMIN_CURRENT_TAB_INSPECT';
/** Phase 121.1 — existing-tab Visual Mapping (MUST NOT open Login Entry). */
export const ADMIN_CURRENT_TAB_VISUAL_MAPPING_START_MESSAGE =
  'ADMIN_CURRENT_TAB_VISUAL_MAPPING_START';
/** Phase 121.1 — authoring click of already-approved action (not orchestrator). */
export const ADMIN_AUTHORING_CLICK_APPROVED_MESSAGE = 'ADMIN_AUTHORING_CLICK_APPROVED';
/** D-121-25 — disarm an armed SPECIAL Visual pick in the authoring tab (no mapping). */
export const ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL_MESSAGE =
  'ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL';
/** D-121-42 — STANDARD Visual pick cancel (disarms the fresh Login Entry tab; no mapping). */
export const ADMIN_VISUAL_MAPPING_CANCEL_MESSAGE = 'ADMIN_VISUAL_MAPPING_CANCEL';
/** D-121-25 / D-121-42 — page-side bound for an armed Admin Visual pick (SPECIAL and STANDARD). */
export const ADMIN_VISUAL_PICK_TIMEOUT_MS = 60_000;
/** Hub releases the editor this long after the page bound if the Ext never answers. */
export const ADMIN_VISUAL_PICK_HUB_GRACE_MS = 5_000;

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
export const VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE =
  'השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל.';
export const VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE =
  'המקור בדף הכניסה אינו תואם. המיפוי בוטל.';

/** 121.1-IF — one inspected SPECIAL authoring surface (top document or depth-1 frame). */
export interface FramedSurface {
  frameKey: string;
  frame: FrameDescriptor | null;
  status: 'top' | 'depth1_https' | 'not_addressable';
  page: SafePageStructure;
  actionCandidates: SpecialActionCandidateObservation[];
  /** Origin of a depth-1 frame with no deterministic locator (display only). */
  unaddressableOrigin?: string;
}

/** 121.1-IF — counts only; drives plain-Hebrew UNSUPPORTED messages. */
export interface FrameUnsupportedSummary {
  nested: number;
  nonHttps: number;
  notInjectable: number;
  shadowCredential: number;
  notAddressable: number;
  correlationUnavailable: number;
}

const LTR_MARK = '\u200E';

export const FRAME_APPROVAL_PROMPT_HE = (origin: string): string =>
  `שדות הכניסה או הכפתור נמצאים בתוך מסגרת של האתר ${LTR_MARK}${origin}${LTR_MARK}. לאשר שימוש במסגרת זו בתהליך הכניסה?`;
export const FRAME_APPROVE_LABEL_HE = 'אשר מסגרת';
export const FRAME_REJECT_LABEL_HE = 'דחה';
export const SURFACE_NOT_OPENED_HE = 'המסך לא נפתח';
/** D-121-59 A1 — reveal mode: a new surface appeared, but without a password input (G8). */
export const SURFACE_NOT_LOGIN_HE = 'המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.';
/** D-121-59 A1 — declared mode: the mapped field never appeared (the opening itself is unknown). */
export const MAPPED_FIELD_NOT_APPEARED_HE =
  'השדה הממופה לא הופיע אחרי הלחיצה — ייתכן שהמסך לא נפתח, או שהשדה הממופה שגוי.';
/** D-121-61 — reveal mode: only a new visible frame with no exact-one locator appeared. */
export const SURFACE_FRAME_NOT_ADDRESSABLE_HE = 'המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.';
/** D-121-35 (G4) — Ext reason: a trusted user gesture occurred before readiness. */
export const AUTHORING_TEST_NOT_PROVEN_REASON = 'user_gesture_during_test';
export const AUTHORING_TEST_NOT_PROVEN_HE =
  'נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.';
/** D-121-35 (G2) — action (opener / transition) Visual pick could not identify a button. */
export const VISUAL_ACTION_UNSUPPORTED_TARGET_HE =
  'לא ניתן לזהות את הכפתור שנבחר. לחצו על הכפתור עצמו באתר.';
export const UNSUPPORTED_NESTED_FRAME_HE =
  'השדה נמצא במסגרת בתוך מסגרת. מצב זה אינו נתמך כרגע.';
export const UNSUPPORTED_SHADOW_DOM_HE =
  'השדה נמצא ברכיב מוסתר מסוג Shadow DOM. מצב זה אינו נתמך כרגע.';
export const UNSUPPORTED_NON_HTTPS_FRAME_HE =
  'חלק מהדף נמצא במסגרת שאינה מאובטחת (HTTPS) ולא ניתן לבדוק אותה. מצב זה אינו נתמך.';
export const FRAME_NOT_ADDRESSABLE_HE =
  'לא ניתן לזהות את המסגרת באופן חד-משמעי. מצב זה אינו נתמך כרגע.';
/** D-121-36 — live frame origin empty / "null": the frame has not loaded yet or was closed. */
export const FRAME_NOT_LOADED_HE = 'המסגרת עדיין לא נטענה או נסגרה — נסו שוב.';
export const FRAME_ORIGIN_CHANGED_HE = (origin: string): string => {
  const live = String(origin ?? '').trim();
  if (!live || live === 'null') return FRAME_NOT_LOADED_HE;
  return `המסגרת שייכת כעת לאתר אחר (${LTR_MARK}${origin}${LTR_MARK}) — הפעולה נחסמה.`;
};
export const FRAME_CORRELATION_UNAVAILABLE_HE =
  'לא ניתן לזהות את המסגרת בדף. נסו לרענן את הדף ולנתח שוב.';
export const VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE =
  'ייתכן שהשדה נמצא במסגרת שאינה נתמכת.';

export const IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE =
  'זוהה אך אינו כשיר למילוי אוטומטי מנוהל';
export const LOCATOR_NOT_DETERMINISTIC_LABEL_HE =
  'זוהה, אך הבורר אינו חד-משמעי למילוי מנוהל';
