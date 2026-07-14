import type { Credential } from '../credentials';
import { executeServiceFromTile } from '../execution/serviceExecution';
import { getLoginFields, type Service } from '../mockServices';
import type { ResolveProfileFn } from '../profile';

export interface OpenServiceDeps {
  resolveProfile: ResolveProfileFn;
  credentialsByProfileId: Record<string, Credential>;
}

export type OpenServiceOutcome =
  | { status: 'cancelled' }
  | { status: 'credentials_missing'; userMessage?: string }
  | {
      status: 'ok';
      userMessage?: string;
      metadataHealth?: 'fill_failed' | 'not_standard_login';
    }
  | { status: 'open_only'; userMessage?: string };

/**
 * Shared open-with-profile helper (AC-104-17): Digital Home tiles AND Service Management
 * "פתיחה" both route through this single path → `executeServiceFromTile`.
 * No parallel execution module may exist.
 */
export async function openServiceWithProfile(
  service: Service,
  deps: OpenServiceDeps,
): Promise<OpenServiceOutcome> {
  const resolution = await deps.resolveProfile(service.id);
  if (resolution === 'cancelled') {
    return { status: 'cancelled' };
  }
  if (resolution === 'unavailable') {
    return { status: 'credentials_missing' };
  }

  const loginFields = getLoginFields(service);
  const credential = deps.credentialsByProfileId[resolution];
  const result = executeServiceFromTile(service, credential, loginFields);

  if (result.status === 'credentials_missing') {
    // Site may already be open (AC-105-7); surface guidance without blocking.
    return { status: 'credentials_missing', userMessage: result.userMessage };
  }

  return {
    status: result.status,
    userMessage: result.userMessage,
    ...(result.status === 'ok' && result.metadataHealth
      ? { metadataHealth: result.metadataHealth }
      : {}),
  };
}
