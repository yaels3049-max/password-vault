import type {
  ConfidenceLevel,
  CredentialSchemaField,
  IdentifiedManagedIneligibleRow,
  MappingLlmRawProposal,
  MappingProposalErrorCode,
  MappingProposalRow,
  MappingProposalStatus,
  SafePageInput,
  SafePageStructure,
  StructuredMappingProposal,
} from './types';
import { MAPPING_PROPOSAL_SCHEMA_VERSION } from './types';
import { assertLocatorDeterministic } from './locatorDeterminism';

/**
 * Approvable Managed mapping target (120.4 I1).
 * Gated on managedEligible — NOT observation-only `visible`.
 * readOnly alone does not block (Managed allows).
 */
function isManagedApprovableTarget(input: SafePageInput): boolean {
  return (
    input.managedEligible === true &&
    !input.disabled &&
    input.locatorCandidates.some((c) => c.strategy === 'css' && c.locator.trim())
  );
}

function hasLocatorCandidate(input: SafePageInput): boolean {
  return input.locatorCandidates.some((c) => c.strategy === 'css' && c.locator.trim());
}

function locatorAllowed(input: SafePageInput, locator: string): boolean {
  const trimmed = locator.trim();
  if (!trimmed) return false;
  return input.locatorCandidates.some(
    (c) => c.strategy === 'css' && c.locator.trim() === trimmed,
  );
}

/**
 * Deterministic safety validation + final confidence (D-118-7…9 / 120.4).
 * Raw modelConfidence never becomes prefill HIGH alone without Managed eligibility.
 * State #3 (IDENTIFIED_BUT_MANAGED_INELIGIBLE) is preserved — never NOT_IDENTIFIED.
 * 120.9: after safety, exact-one gate before Managed-approvable locator prefill.
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
  const identifiedIneligible: IdentifiedManagedIneligibleRow[] = [];
  const warnings: string[] = [];
  const ineligibleFieldIds = new Set<string>();

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
    if (!hasLocatorCandidate(observed) || !locatorAllowed(observed, raw.locator)) {
      warnings.push('rejected_invented_locator');
      continue;
    }

    if (!isManagedApprovableTarget(observed)) {
      // State #3 — identified, Managed-ineligible. Preserve; do not approvable/prefill.
      if (!ineligibleFieldIds.has(raw.fieldId)) {
        ineligibleFieldIds.add(raw.fieldId);
        identifiedIneligible.push({
          fieldId: raw.fieldId,
          observedInputId: raw.observedInputId,
          locator: raw.locator.trim(),
          state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
          reason: 'managed_ineligible',
        });
        warnings.push('identified_but_managed_ineligible');
      }
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

  // 120.9 — after safety, before Managed prefill eligibility: exact-one gate.
  // Semantic HIGH/MEDIUM retained; non-deterministic locators are not approvable.
  const gatedProposals: MappingProposalRow[] = proposals.map((row) => {
    if (row.confidence !== 'high' && row.confidence !== 'medium') {
      return row;
    }
    const observed = inputsById.get(row.observedInputId);
    const deterministic = observed
      ? assertLocatorDeterministic(row.locator, observed)
      : false;
    if (!deterministic) {
      warnings.push('locator_not_deterministic');
    }
    return { ...row, locatorDeterministic: deterministic };
  });

  const confidentFieldIds = new Set(
    gatedProposals
      .filter((p) => p.confidence === 'high' || p.confidence === 'medium')
      .map((p) => p.fieldId),
  );
  const unmappedFieldIds = [...schemaIds].filter((id) => !confidentFieldIds.has(id));

  let status: MappingProposalStatus;
  if (gatedProposals.some((p) => p.confidence === 'high' || p.confidence === 'medium')) {
    status = unmappedFieldIds.length === 0 ? 'ok' : 'partial';
  } else if (gatedProposals.length === 0) {
    status = 'no_confident_mapping';
  } else {
    status = 'no_confident_mapping';
  }

  return {
    schemaVersion: MAPPING_PROPOSAL_SCHEMA_VERSION,
    requestId: input.requestId,
    serviceId: input.serviceId,
    status,
    proposals: gatedProposals,
    unmappedFieldIds,
    identifiedButManagedIneligible:
      identifiedIneligible.length > 0 ? identifiedIneligible : undefined,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Final confidence after safety. modelConfidence alone is insufficient:
 * HIGH requires model high (semantic assessment survived Managed eligibility).
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

/**
 * Prefill helper: HIGH and MEDIUM into empty slots (Section 20).
 * 120.9: only when locatorDeterministic === true (exact-one gate passed).
 * LOW/rejected/non-deterministic never prefill Managed locator.
 */
export function applyConfidentPrefill(
  currentLocators: Record<string, string>,
  proposal: StructuredMappingProposal,
): { next: Record<string, string>; appliedFieldIds: string[] } {
  const next = { ...currentLocators };
  const appliedFieldIds: string[] = [];
  for (const row of proposal.proposals) {
    if (row.confidence !== 'high' && row.confidence !== 'medium') continue;
    if (row.locatorDeterministic !== true) continue;
    const existing = (next[row.fieldId] ?? '').trim();
    if (existing) continue;
    next[row.fieldId] = row.locator;
    appliedFieldIds.push(row.fieldId);
  }
  return { next, appliedFieldIds };
}

/** @deprecated alias — Section 20 uses HIGH+MEDIUM via applyConfidentPrefill. */
export function applyHighConfidencePrefill(
  currentLocators: Record<string, string>,
  proposal: StructuredMappingProposal,
): { next: Record<string, string>; appliedFieldIds: string[] } {
  return applyConfidentPrefill(currentLocators, proposal);
}
