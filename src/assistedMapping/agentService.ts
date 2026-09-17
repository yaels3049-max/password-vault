import {
  AGENT_TASK_PROPOSE_FIELD_MAPPINGS,
  INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
  type CredentialSchemaField,
  type MappingLlmProvider,
  type SafePageStructure,
  type StructuredMappingProposal,
} from './types';
import { applySafetyAndConfidence } from './safetyValidation';
import { MockMappingLlmProvider } from './mockProvider';
import {
  RemoteOpenAiMappingLlmProvider,
  assistedMappingProviderMode,
} from './openaiRemoteProvider';

const SYSTEM_CONTRACT_VERSION = 'phase118-v1';

function createDefaultProvider(): MappingLlmProvider {
  return assistedMappingProviderMode() === 'openai'
    ? new RemoteOpenAiMappingLlmProvider()
    : new MockMappingLlmProvider('default');
}

/** Active provider override (tests) or lazy default. */
let activeProvider: MappingLlmProvider | null = null;

export function getMappingLlmProvider(): MappingLlmProvider {
  if (!activeProvider) {
    activeProvider = createDefaultProvider();
  }
  return activeProvider;
}

/** Test-only / future adapter injection. */
export function setMappingLlmProviderForTests(provider: MappingLlmProvider): void {
  activeProvider = provider;
}

export function resetMappingLlmProviderToMock(
  scenario?: ConstructorParameters<typeof MockMappingLlmProvider>[0],
): void {
  activeProvider = new MockMappingLlmProvider(scenario ?? 'default');
}

export function resetMappingLlmProviderToDefault(): void {
  activeProvider = createDefaultProvider();
}

/**
 * Agent Service façade (Hub). Provider-neutral.
 * Does not write registry / autofillProfile / supportState.
 * Deterministic safety validation always runs after provider raw output
 * (or on empty raw proposals when D-118-14 short-circuits).
 */
export async function proposeFieldMappings(input: {
  requestId: string;
  serviceId: string;
  schema: CredentialSchemaField[];
  page: SafePageStructure;
  provider?: MappingLlmProvider;
}): Promise<StructuredMappingProposal> {
  const inputs = input.page?.inputs;
  // D-118-14 / AC-118-26 — fail closed before any MappingLlmProvider call.
  if (!Array.isArray(inputs) || inputs.length === 0) {
    const closed = applySafetyAndConfidence({
      requestId: input.requestId,
      serviceId: input.serviceId,
      schema: input.schema,
      page: input.page,
      rawProposals: [],
    });
    return {
      ...closed,
      warnings: [...(closed.warnings ?? []), 'no_observed_inputs'],
    };
  }

  const provider = input.provider ?? getMappingLlmProvider();
  try {
    const raw = await provider.proposeMappings({
      systemContractVersion: SYSTEM_CONTRACT_VERSION,
      inspectionCapability: INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
      agentTask: AGENT_TASK_PROPOSE_FIELD_MAPPINGS,
      schema: input.schema,
      page: input.page,
      constraints: {
        locatorType: 'css',
        requireExactOneCandidatePreference: true,
      },
    });
    return applySafetyAndConfidence({
      requestId: input.requestId,
      serviceId: input.serviceId,
      schema: input.schema,
      page: input.page,
      rawProposals: raw.proposals ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const errorCode =
      message === 'unauthorized'
        ? 'unauthorized'
        : message === 'timeout'
          ? 'timeout'
          : 'provider_error';
    return applySafetyAndConfidence({
      requestId: input.requestId,
      serviceId: input.serviceId,
      schema: input.schema,
      page: input.page,
      rawProposals: [],
      errorCode,
    });
  }
}

/** Non-secret audit summary for DEV logs. */
export function assistedMappingAuditSummary(proposal: StructuredMappingProposal): Record<
  string,
  string | number | undefined
> {
  return {
    requestId: proposal.requestId,
    serviceId: proposal.serviceId,
    status: proposal.status,
    errorCode: proposal.errorCode,
    proposalCount: proposal.proposals.length,
    highCount: proposal.proposals.filter((p) => p.confidence === 'high').length,
    unmappedCount: proposal.unmappedFieldIds.length,
  };
}
