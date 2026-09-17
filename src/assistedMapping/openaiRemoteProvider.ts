import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import type {
  MappingLlmProvider,
  MappingLlmRawProposal,
  MappingLlmRawResponse,
  MappingLlmRequest,
} from './types';

const EDGE_FUNCTION_NAME = 'propose-field-mappings';

type EdgeOk = { ok: true; proposals: MappingLlmRawProposal[] };
type EdgeErr = { ok: false; reason?: string };

/**
 * Hub-side adapter: invokes server Edge Function.
 * No OpenAI SDK and no API key in the browser.
 */
export class RemoteOpenAiMappingLlmProvider implements MappingLlmProvider {
  async proposeMappings(input: MappingLlmRequest): Promise<MappingLlmRawResponse> {
    if (!isSupabaseConfigured()) {
      throw new Error('provider_not_configured');
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('provider_not_configured');
    }

    const { data, error } = await supabase.functions.invoke<EdgeOk | EdgeErr>(
      EDGE_FUNCTION_NAME,
      {
        body: {
          systemContractVersion: input.systemContractVersion,
          inspectionCapability: input.inspectionCapability,
          agentTask: input.agentTask,
          schema: input.schema,
          page: input.page,
          constraints: input.constraints,
        },
      },
    );

    if (error) {
      throw new Error(error.message || 'provider_error');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('provider_error');
    }
    if (!('ok' in data) || data.ok !== true) {
      const reason =
        data && 'reason' in data && typeof data.reason === 'string'
          ? data.reason
          : 'provider_error';
      throw new Error(reason);
    }
    return { proposals: Array.isArray(data.proposals) ? data.proposals : [] };
  }
}

export function assistedMappingProviderMode(): 'mock' | 'openai' {
  const envRecord =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    typeof (import.meta as { env?: unknown }).env === 'object' &&
    (import.meta as { env?: Record<string, unknown> }).env
      ? ((import.meta as { env: Record<string, unknown> }).env)
      : {};
  const mode = String(envRecord.VITE_ASSISTED_MAPPING_PROVIDER ?? '')
    .trim()
    .toLowerCase();
  if (mode === 'mock') return 'mock';
  if (mode === 'openai') return 'openai';
  // Default: use OpenAI Edge path when Supabase is configured.
  return isSupabaseConfigured() ? 'openai' : 'mock';
}

export { EDGE_FUNCTION_NAME };
