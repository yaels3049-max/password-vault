import type { Service } from '../service/legacyService';
import type { ServiceDefinition } from '../service/serviceModel';
import { toBrowserAccessibleStorageUrl } from '../supabase/env';
import { readActiveIconPointer, type ActiveIconPointer } from './types';

/**
 * Resolve the active managed icon for paint (D-111-6 cascade tier 1).
 * Returns Storage/active pointer only — callers must fall back to pre-111 path
 * (faviconSiteUrl / resolveServiceLogo) then emoji when this is null (D-111-17).
 */
export function resolveActiveManagedAsset(
  input:
    | { serviceId: string; metadata?: Record<string, unknown> | null; logoUrl?: string | null }
    | Service
    | ServiceDefinition,
): ActiveIconPointer | null {
  if ('metadata' in input && input.metadata) {
    const fromMeta = readActiveIconPointer(input.metadata as Record<string, unknown>);
    if (fromMeta) {
      return fromMeta;
    }
  }

  // Legacy Service shape: logoUrl may already be the managed Storage URL (set at map time).
  if ('logoUrl' in input && typeof input.logoUrl === 'string' && input.logoUrl.trim()) {
    const url = input.logoUrl.trim();
    // Reject known third-party paint CDNs
    if (/gstatic\.com\/favicon|google\.com\/s2\/favicons/i.test(url)) {
      return null;
    }
    if (/service-assets|supabase\.co\/storage/i.test(url) || url.startsWith('blob:')) {
      return {
        assetId: '',
        assetSource: 'auto',
        version: 1,
        checksum: '',
        publicUrl: url,
        status: 'active',
        updatedAt: '',
      };
    }
  }

  return null;
}

export function resolveManagedIconUrl(
  input: Parameters<typeof resolveActiveManagedAsset>[0],
  preferredSize: 32 | 64 | 128 = 128,
): string | null {
  const active = resolveActiveManagedAsset(input);
  if (!active) {
    return null;
  }
  const keyed = active.sizes?.[`${preferredSize}`];
  const raw =
    typeof keyed === 'string' && keyed.trim() ? keyed.trim() : active.publicUrl;
  return raw ? toBrowserAccessibleStorageUrl(raw) : null;
}

/** Deterministic fallback token for UI when no managed image exists. */
export function resolveIconFallbackLabel(service: {
  id: string;
  name?: string;
  displayName?: string;
  icon?: string;
}): { kind: 'emoji' | 'initial'; token: string } {
  if (service.icon && service.icon.trim() && !/^https?:/i.test(service.icon)) {
    return { kind: 'emoji', token: service.icon.trim().slice(0, 8) };
  }
  const name = (service.name || service.displayName || service.id || '?').trim();
  const initial = name.charAt(0).toUpperCase() || '?';
  return { kind: 'initial', token: initial };
}
