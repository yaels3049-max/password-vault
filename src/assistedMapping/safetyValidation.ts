import type {
  ConfidenceLevel,
  CredentialSchemaField,
  MappingLlmRawProposal,
  MappingProposalErrorCode,
  MappingProposalRow,
  MappingProposalStatus,
  SafePageInput,
  SafePageStructure,
  StructuredMappingProposal,
} from './types';
import { MAPPING_PROPOSAL_SCHEMA_VERSION } from './types';

function isAllowedTarget(input: SafePageInput): boolean {
  return (
    input.visible &&
    input.editable &&
    !input.disabled &&
    !input.readOnly &&
    input.locatorCandidates.some((c) => c.strategy === 'css' && c.locator.trim())
  );
}

function locatorAllowed(input: SafePageInput, locator: string): boolean {
  const trimmed = locator.trim();
  if (!trimmed) return false;
  return input.locatorCandidates.some(
    (c) => c.strategy === 'css' && c.locator.trim() === trimmed,
  );
}

/**
 * Deterministic safety validation + final confidence (D-118-7…9).
 * Raw modelConfidence never becomes prefill HIGH alone without safety + non-conflict.
 */
export function applySafetyAndConfidence(input: {
  requestId: string;
  serviceId: string;
  schema: CredentialSchemaField[];
  page: SafePageStructure;
  rawProposals: MappingLlmRawProposal[];
  errorCode?: MappingProposalErrorCode;
}): StructuredMappingProposal {
  const schemaIds = new Set(input.schema.map((f) => f.fieldId));
  const inputsById = new Map(input.page.inputs.map((i) => [i.inputId, i]));

  if (input.errorCode) {
    return {
      schemaVersion: MAPPING_PROPOSAL_SCHEMA_VERSION,
      requestId: input.requestId,
      serviceId: input.serviceId,
      status: 'error',
      errorCode: input.errorCode,
      proposals: [],
      unmappedFieldIds: [...schemaIds],
    };
  }

  const accepted: MappingProposalRow[] = [];
  const warnings: string[] = [];

  for (const raw of input.rawProposals) {
    if (!schemaIds.has(raw.fieldId)) {
      warnings.push('dropped_unknown_fieldId');
      continue;
    }
    const observed = inputsById.get(raw.observedInputId);
    if (!observed) {
      warnings.push('rejected_invented_inputId');
      continue;
    }
    if (!isAllowedTarget(observed)) {
      warnings.push('rejected_unsafe_target');
      continue;
    }
    if (!locatorAllowed(observed, raw.locator)) {
      warnings.push('rejected_invented_locator');
      continue;
    }

    const finalConfidence = toFinalConfidence(raw.modelConfidence, raw.evidence?.length ?? 0);
    accepted.push({
      fieldId: raw.fieldId,
      locatorType: 'css',
      locator: raw.locator.trim(),
      observedInputId: raw.observedInputId,
      confidence: finalConfidence,
      modelConfidence: raw.modelConfidence,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    });
  }

  // Conflicts: same field twice, or same observed input / locator claimed by multiple fields.
  const byField = new Map<string, MappingProposalRow[]>();
  for (const row of accepted) {
    const list = byField.get(row.fieldId) ?? [];
    list.push(row);
    byField.set(row.fieldId, list);
  }

  const demoted = new Map<string, MappingProposalRow>();
  for (const [fieldId, rows] of byField) {
    if (rows.length > 1) {
      warnings.push('ambiguous_field_demoted');
      demoted.set(fieldId, {
        ...rows[0]!,
        confidence: 'unknown',
      });
      continue;
    }
    demoted.set(fieldId, rows[0]!);
  }

  const inputOwners = new Map<string, string[]>();
  const locatorOwners = new Map<string, string[]>();
  for (const row of demoted.values()) {
    if (row.confidence === 'unknown' && byField.get(row.fieldId)!.length > 1) {
      continue;
    }
    const iOwners = inputOwners.get(row.observedInputId) ?? [];
    iOwners.push(row.fieldId);
    inputOwners.set(row.observedInputId, iOwners);
    const lOwners = locatorOwners.get(row.locator) ?? [];
    lOwners.push(row.fieldId);
    locatorOwners.set(row.locator, lOwners);
  }

  const conflictedFields = new Set<string>();
  for (const owners of inputOwners.values()) {
    if (owners.length > 1) owners.forEach((id) => conflictedFields.add(id));
  }
  for (const owners of locatorOwners.values()) {
    if (owners.length > 1) owners.forEach((id) => conflictedFields.add(id));
  }

  const proposals: MappingProposalRow[] = [];
  for (const row of demoted.values()) {
    if (conflictedFields.has(row.fieldId)) {
      warnings.push('conflict_demoted');
      proposals.push({ ...row, confidence: 'unknown' });
      continue;
    }
    proposals.push(row);
  }

  const highFieldIds = new Set(
    proposals.filter((p) => p.confidence === 'high').map((p) => p.fieldId),
  );
  const unmappedFieldIds = [...schemaIds].filter((id) => !highFieldIds.has(id));

  let status: MappingProposalStatus;
  if (proposals.some((p) => p.confidence === 'high')) {
    status = unmappedFieldIds.length === 0 ? 'ok' : 'partial';
  } else if (proposals.length === 0) {
    status = 'no_confident_mapping';
  } else {
    status = 'no_confident_mapping';
  }

  return {
    schemaVersion: MAPPING_PROPOSAL_SCHEMA_VERSION,
    requestId: input.requestId,
    serviceId: input.serviceId,
    status,
    proposals,
    unmappedFieldIds,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Final confidence after safety. modelConfidence alone is insufficient:
 * HIGH requires model high (semantic assessment survived safety).
 * Lexical agreement is not consulted here (D-118-8 / AC-118-25).
 */
function toFinalConfidence(
  modelConfidence: ConfidenceLevel,
  _evidenceCount: number,
): ConfidenceLevel {
  if (modelConfidence === 'high') return 'high';
  if (modelConfidence === 'medium') return 'medium';
  if (modelConfidence === 'low') return 'low';
  return 'unknown';
}

/** Prefill helper: only HIGH into empty slots. */
export function applyHighConfidencePrefill(
  currentLocators: Record<string, string>,
  proposal: StructuredMappingProposal,
): { next: Record<string, string>; appliedFieldIds: string[] } {
  const next = { ...currentLocators };
  const appliedFieldIds: string[] = [];
  for (const row of proposal.proposals) {
    if (row.confidence !== 'high') continue;
    const existing = (next[row.fieldId] ?? '').trim();
    if (existing) continue;
    next[row.fieldId] = row.locator;
    appliedFieldIds.push(row.fieldId);
  }
  return { next, appliedFieldIds };
}
