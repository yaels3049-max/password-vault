import type { DiscoveryResult } from '../discovery';

export type LoginUrlDiscoverySource = 'auto' | 'admin' | 'user';

export interface DiscoveryMetadataInput {
  discovery: DiscoveryResult | null;
  source: LoginUrlDiscoverySource;
  success: boolean;
  errorCode?: string;
}

/** Merge login discovery fields into service_registry.metadata (Phase 108). */
export function buildDiscoveryMetadataPatch(
  existing: Record<string, unknown> | null,
  input: DiscoveryMetadataInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = { ...(existing ?? {}) };

  metadata.loginUrlLastCheckedAt = now;
  metadata.loginUrlSource = input.source;

  if (input.success && input.discovery?.loginUrl) {
    metadata.loginUrlLastDiscoveredAt = now;
    metadata.loginUrlConfidence = input.discovery.confidence ?? null;
    metadata.discoveryMethod = input.discovery.method ?? null;
    metadata.loginUrlDiscoveryError = null;
  } else {
    metadata.loginUrlDiscoveryError =
      input.errorCode ?? input.discovery?.reason ?? 'discovery_failed';
    if (input.discovery?.confidence) {
      metadata.loginUrlConfidence = input.discovery.confidence;
    }
    if (input.discovery?.method) {
      metadata.discoveryMethod = input.discovery.method;
    }
  }

  metadata.lastDiscoveryOutcome = {
    at: now,
    success: input.success,
    method: input.discovery?.method ?? null,
    confidence: input.discovery?.confidence ?? null,
    loginUrl: input.discovery?.loginUrl ?? null,
    reason: input.discovery?.reason ?? input.errorCode ?? null,
    source: input.source,
  };

  return metadata;
}
