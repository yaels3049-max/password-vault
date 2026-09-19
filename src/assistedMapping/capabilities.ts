/**
 * Phase 119 — Login Experience capability catalog + support gate.
 * Reserved ids are declared for future slices; only single_page_top is the
 * executable Analyze/propose inspection capability.
 *
 * Phase 119 readiness_wait_inputs: enabled as Admin inspect *timing* layer
 * (bounded observe/retry before SafePageStructure finalize). It is NOT a
 * second LLM inspect mode and must not replace single_page_top.
 */

import {
  INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
  MAPPING_PROPOSAL_SCHEMA_VERSION,
  type CredentialSchemaField,
  type InspectionCapability,
  type MappingProposalErrorCode,
  type SafePageStructure,
  type StructuredMappingProposal,
} from './types';

/** Catalog: shipped + reserved (not all executable as inspect/propose modes). */
export const LOGIN_EXPERIENCE_CAPABILITY_CATALOG = [
  'single_page_top',
  'visual_target_selection',
  'same_origin_frame_inspect',
  'open_shadow_pierce',
  'readiness_wait_inputs',
  'modal_activation',
  'multi_step_sequence',
  'dynamic_control_appear',
] as const;

export type LoginExperienceCapabilityId =
  (typeof LOGIN_EXPERIENCE_CAPABILITY_CATALOG)[number];

/**
 * Admin inspect timing capability (Phase 119 readiness slice).
 * Wired on ADMIN_LOGIN_PAGE_INSPECT only — not an LLM proposal mode.
 */
export const ADMIN_INSPECT_READINESS_CAPABILITY_ID =
  'readiness_wait_inputs' as const;

/** True when Admin inspect uses bounded readiness_wait_inputs observe/retry. */
export const ADMIN_INSPECT_READINESS_ENABLED = true;

/** Capabilities executable for Assisted Mapping inspect/propose in this slice. */
export const SUPPORTED_INSPECTION_CAPABILITIES = [
  INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
] as const;

export type SupportedInspectionCapability =
  (typeof SUPPORTED_INSPECTION_CAPABILITIES)[number];

export function isKnownLoginExperienceCapability(
  value: unknown,
): value is LoginExperienceCapabilityId {
  return (
    typeof value === 'string' &&
    (LOGIN_EXPERIENCE_CAPABILITY_CATALOG as readonly string[]).includes(value)
  );
}

export function isSupportedInspectionCapability(
  value: unknown,
): value is SupportedInspectionCapability {
  return (
    typeof value === 'string' &&
    (SUPPORTED_INSPECTION_CAPABILITIES as readonly string[]).includes(value)
  );
}

/**
 * Resolve capability for authoring. Unsupported / unknown → fail-closed marker.
 * Note: readiness_wait_inputs is inspect timing only — resolve fails closed if
 * passed as inspectionCapability (Analyze default remains single_page_top).
 */
export function resolveInspectionCapability(
  value: unknown,
):
  | { ok: true; capability: SupportedInspectionCapability }
  | { ok: false; reason: 'unsupported_capability' } {
  if (isSupportedInspectionCapability(value)) {
    return { ok: true, capability: value };
  }
  return { ok: false, reason: 'unsupported_capability' };
}

export function unsupportedCapabilityProposal(input: {
  requestId: string;
  serviceId: string;
  schema: CredentialSchemaField[];
  page: SafePageStructure;
}): StructuredMappingProposal {
  const errorCode: MappingProposalErrorCode = 'unsupported_capability';
  return {
    schemaVersion: MAPPING_PROPOSAL_SCHEMA_VERSION,
    requestId: input.requestId,
    serviceId: input.serviceId,
    status: 'error',
    errorCode,
    proposals: [],
    unmappedFieldIds: input.schema.map((f) => f.fieldId),
    warnings: ['unsupported_capability'],
  };
}

/** Default capability for Phase 118/119 Analyze path (structure/proposal). */
export function defaultInspectionCapability(): InspectionCapability {
  return INSPECTION_CAPABILITY_SINGLE_PAGE_TOP;
}
