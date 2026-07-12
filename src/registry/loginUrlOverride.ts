import type { ServiceRegistryRow } from './registryMapper';
import type { LoginUrlDiscoverySource } from './loginDiscoveryMetadata';

export type LoginUrlSourceValue = LoginUrlDiscoverySource | 'unknown';

export function getLoginUrlSource(
  metadata: Record<string, unknown> | null | undefined,
): LoginUrlSourceValue {
  const value = metadata?.loginUrlSource;
  if (value === 'auto' || value === 'admin' || value === 'user') {
    return value;
  }
  return 'unknown';
}

export function isAdminProtectedLoginUrl(
  row: Pick<ServiceRegistryRow, 'metadata'>,
): boolean {
  return getLoginUrlSource(row.metadata) === 'admin';
}

export interface AutomatedDiscoverySkip {
  skip: boolean;
  reason?: string;
}

/**
 * Gate automated discovery/rediscovery/bulk refresh (AC-108-15).
 * Admin manual URLs are protected unless forceAdminOverwrite is true.
 */
export function shouldSkipAutomatedLoginDiscovery(
  row: Pick<ServiceRegistryRow, 'metadata'>,
  options?: { force?: boolean; forceAdminOverwrite?: boolean },
): AutomatedDiscoverySkip {
  if (options?.force || options?.forceAdminOverwrite) {
    return { skip: false };
  }

  if (isAdminProtectedLoginUrl(row)) {
    return {
      skip: true,
      reason: 'admin_override_protected',
    };
  }

  return { skip: false };
}
