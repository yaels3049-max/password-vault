import type {
  CredentialSchemaField,
  MappingLlmProvider,
  MappingLlmRawProposal,
  MappingLlmRequest,
  MappingLlmRawResponse,
  SafePageInput,
} from './types';

export type MockMappingScenario =
  | 'default'
  | 'semantic_non_lexical'
  | 'lexical_exact'
  | 'invented_input'
  | 'invented_locator'
  | 'conflict'
  | 'ambiguous'
  | 'empty';

/**
 * Provider-neutral mock. No vendor SDK.
 * Scripted scenarios drive AC verification; default live mode uses
 * type affinity + uniqueness without service-specific vocabulary lists.
 */
export class MockMappingLlmProvider implements MappingLlmProvider {
  private readonly scenario: MockMappingScenario;

  constructor(scenario: MockMappingScenario = 'default') {
    this.scenario = scenario;
  }

  async proposeMappings(input: MappingLlmRequest): Promise<MappingLlmRawResponse> {
    switch (this.scenario) {
      case 'semantic_non_lexical':
        return { proposals: semanticNonLexical(input) };
      case 'lexical_exact':
        return { proposals: lexicalExact(input) };
      case 'invented_input':
        return {
          proposals: [
            {
              fieldId: input.schema[0]?.fieldId ?? 'x',
              observedInputId: 'invented-input-id',
              locator: '#x',
              modelConfidence: 'high',
              evidence: [{ category: 'semantic_role_match' }],
            },
          ],
        };
      case 'invented_locator':
        return {
          proposals: inventedLocator(input),
        };
      case 'conflict':
        return { proposals: conflictPair(input) };
      case 'ambiguous':
        return { proposals: ambiguousPair(input) };
      case 'empty':
        return { proposals: [] };
      case 'default':
      default:
        return { proposals: defaultLiveProposals(input) };
    }
  }
}

function firstAllowed(pageInputs: SafePageInput[]): SafePageInput | undefined {
  return pageInputs.find(
    (i) =>
      i.visible &&
      i.editable &&
      !i.disabled &&
      !i.readOnly &&
      i.locatorCandidates[0]?.locator,
  );
}

function semanticNonLexical(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const field =
    input.schema.find((f) => f.fieldId === 'tax_id') ??
    input.schema.find((f) => f.fieldId === 'business_id') ??
    input.schema[0];
  const target =
    input.page.inputs.find((i) => i.idAttr === 'commercial') ??
    input.page.inputs.find((i) => i.idAttr === 'osek') ??
    firstAllowed(input.page.inputs);
  if (!field || !target?.locatorCandidates[0]) return [];
  return [
    {
      fieldId: field.fieldId,
      observedInputId: target.inputId,
      locator: target.locatorCandidates[0].locator,
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match', noteCode: 'fixture_semantic' }],
    },
  ];
}

function lexicalExact(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const out: MappingLlmRawProposal[] = [];
  for (const field of input.schema) {
    const match = input.page.inputs.find(
      (i) =>
        i.idAttr === field.fieldId ||
        i.nameAttr === field.fieldId ||
        i.locatorCandidates.some((c) => c.locator === `#${field.fieldId}`),
    );
    if (!match?.locatorCandidates[0]) continue;
    out.push({
      fieldId: field.fieldId,
      observedInputId: match.inputId,
      locator: match.locatorCandidates[0].locator,
      modelConfidence: 'high',
      evidence: [{ category: 'id_name_affinity' }],
    });
  }
  return out;
}

function inventedLocator(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const field = input.schema[0];
  const target = firstAllowed(input.page.inputs);
  if (!field || !target) return [];
  return [
    {
      fieldId: field.fieldId,
      observedInputId: target.inputId,
      locator: '#totally-invented-locator',
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match' }],
    },
  ];
}

function conflictPair(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const a = input.schema[0];
  const b = input.schema[1];
  const target = firstAllowed(input.page.inputs);
  if (!a || !b || !target?.locatorCandidates[0]) return [];
  const loc = target.locatorCandidates[0].locator;
  return [
    {
      fieldId: a.fieldId,
      observedInputId: target.inputId,
      locator: loc,
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match' }],
    },
    {
      fieldId: b.fieldId,
      observedInputId: target.inputId,
      locator: loc,
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match' }],
    },
  ];
}

function ambiguousPair(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const field = input.schema[0];
  const inputs = input.page.inputs.filter(
    (i) => i.visible && i.editable && i.locatorCandidates[0],
  );
  if (!field || inputs.length < 2) return [];
  return [
    {
      fieldId: field.fieldId,
      observedInputId: inputs[0]!.inputId,
      locator: inputs[0]!.locatorCandidates[0]!.locator,
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match' }],
    },
    {
      fieldId: field.fieldId,
      observedInputId: inputs[1]!.inputId,
      locator: inputs[1]!.locatorCandidates[0]!.locator,
      modelConfidence: 'high',
      evidence: [{ category: 'semantic_role_match' }],
    },
  ];
}

function defaultLiveProposals(input: MappingLlmRequest): MappingLlmRawProposal[] {
  const usedInputs = new Set<string>();
  const out: MappingLlmRawProposal[] = [];
  const fields = [...input.schema];
  const inputs = input.page.inputs.filter(
    (i) => i.visible && i.editable && !i.disabled && !i.readOnly && i.locatorCandidates[0],
  );

  // Password-type affinity (generic, not service-specific).
  for (const field of fields) {
    const wantsPassword =
      /password|secret|pin|סיסמ/i.test(field.fieldId) ||
      /password|secret|pin|סיסמ/i.test(field.label) ||
      field.type === 'password';
    if (!wantsPassword) continue;
    const match = inputs.find(
      (i) => !usedInputs.has(i.inputId) && (i.type || '').toLowerCase() === 'password',
    );
    if (!match?.locatorCandidates[0]) continue;
    usedInputs.add(match.inputId);
    out.push({
      fieldId: field.fieldId,
      observedInputId: match.inputId,
      locator: match.locatorCandidates[0].locator,
      modelConfidence: 'high',
      evidence: [{ category: 'type_affinity' }],
    });
  }

  // Lexical id/name strengtheners (optional, not mandatory for other fields).
  for (const field of fields) {
    if (out.some((p) => p.fieldId === field.fieldId)) continue;
    const match = inputs.find(
      (i) =>
        !usedInputs.has(i.inputId) &&
        (i.idAttr === field.fieldId ||
          i.nameAttr === field.fieldId ||
          i.autocomplete === field.fieldId),
    );
    if (!match?.locatorCandidates[0]) continue;
    usedInputs.add(match.inputId);
    out.push({
      fieldId: field.fieldId,
      observedInputId: match.inputId,
      locator: match.locatorCandidates[0].locator,
      modelConfidence: 'high',
      evidence: [{ category: 'id_name_affinity' }],
    });
  }

  // Remaining 1:1 uniqueness — semantic path without lexical equality.
  const remainingFields = fields.filter((f) => !out.some((p) => p.fieldId === f.fieldId));
  const remainingInputs = inputs.filter((i) => !usedInputs.has(i.inputId));
  if (remainingFields.length === 1 && remainingInputs.length === 1) {
    const field = remainingFields[0]!;
    const match = remainingInputs[0]!;
    out.push({
      fieldId: field.fieldId,
      observedInputId: match.inputId,
      locator: match.locatorCandidates[0]!.locator,
      modelConfidence: 'high',
      evidence: [
        { category: 'semantic_role_match' },
        { category: 'uniqueness_among_candidates' },
      ],
    });
  }

  return out;
}

export function schemaFromLoginFields(
  loginFields: Array<{ id: string; label: string; type?: string }>,
): CredentialSchemaField[] {
  return loginFields.map((f) => ({
    fieldId: f.id,
    label: f.label,
    type: f.type,
  }));
}
