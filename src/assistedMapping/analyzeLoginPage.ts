import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';
import { originFromHttpsLoginEntry } from '../autofill/validatedProfile';
import { proposeFieldMappings, assistedMappingAuditSummary } from './agentService';
import { schemaFromLoginFields } from './mockProvider';
import { applyHighConfidencePrefill } from './safetyValidation';
import {
  ADMIN_LOGIN_PAGE_INSPECT_MESSAGE,
  ANALYZE_FAILED_LABEL_HE,
  ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE,
  ANALYZE_NEED_SCHEMA_LABEL_HE,
  type SafePageStructure,
  type StructuredMappingProposal,
} from './types';

export type AnalyzeLoginPageResult =
  | {
      ok: true;
      proposal: StructuredMappingProposal;
      prefill: { next: Record<string, string>; appliedFieldIds: string[] };
    }
  | { ok: false; message: string; proposal?: StructuredMappingProposal };

interface InspectResponse {
  ok?: boolean;
  reason?: string;
  page?: SafePageStructure;
}

/**
 * Admin authoring flow: inspect Login Entry → mock/provider propose → safety → HIGH prefill.
 * Never persists mappings or changes supportState.
 */
export async function analyzeLoginPageForMapping(input: {
  serviceId: string;
  loginFields: Array<{ id: string; label: string; type?: string }>;
  loginEntryUrl: string;
  currentLocators: Record<string, string>;
}): Promise<AnalyzeLoginPageResult> {
  const schema = schemaFromLoginFields(input.loginFields);
  if (schema.length === 0) {
    return { ok: false, message: ANALYZE_NEED_SCHEMA_LABEL_HE };
  }

  const loginEntryUrl = input.loginEntryUrl.trim();
  const allowedOrigin = originFromHttpsLoginEntry(loginEntryUrl);
  if (!allowedOrigin) {
    return { ok: false, message: ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE };
  }

  if (!probeExtensionAvailable()) {
    return {
      ok: false,
      message: ANALYZE_FAILED_LABEL_HE,
      proposal: {
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        serviceId: input.serviceId,
        status: 'error',
        errorCode: 'extension_unavailable',
        proposals: [],
        unmappedFieldIds: schema.map((f) => f.fieldId),
      },
    };
  }

  const requestId = crypto.randomUUID();
  const inspect = await sendExtensionMessageAsync<InspectResponse>({
    type: ADMIN_LOGIN_PAGE_INSPECT_MESSAGE,
    requestId,
    loginEntryUrl,
    allowedOrigin,
  });

  if (!inspect?.ok || !inspect.page) {
    const reason = inspect?.reason;
    const errorCode =
      reason === 'origin_mismatch'
        ? 'origin_mismatch'
        : reason === 'tab_load_timeout'
          ? 'tab_load_timeout'
          : 'inspect_failed';
    return {
      ok: false,
      message: ANALYZE_FAILED_LABEL_HE,
      proposal: {
        schemaVersion: 1,
        requestId,
        serviceId: input.serviceId,
        status: 'error',
        errorCode,
        proposals: [],
        unmappedFieldIds: schema.map((f) => f.fieldId),
      },
    };
  }

  const proposal = await proposeFieldMappings({
    requestId,
    serviceId: input.serviceId,
    schema,
    page: inspect.page,
  });

  if (import.meta.env.DEV) {
    console.info('[assisted-mapping]', assistedMappingAuditSummary(proposal));
  }

  if (proposal.status === 'error') {
    return { ok: false, message: ANALYZE_FAILED_LABEL_HE, proposal };
  }

  const prefill = applyHighConfidencePrefill(input.currentLocators, proposal);
  return { ok: true, proposal, prefill };
}
