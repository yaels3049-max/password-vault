import type { Service } from './mockServices';
import { resolveServiceLogo } from './resolveServiceLogo';
import { resolveManagedIconUrl } from './serviceAssets/resolveActiveManagedAsset';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function isManagedStorageUrl(url: string): boolean {
  return /supabase\.co\/storage|\/storage\/v1\/object\/public\/service-assets\//i.test(
    url,
  );
}

/**
 * Phase 111 M8 paint cascade (D-111-6 / AC-111-17):
 * (1) active managed Storage URL if present (admin upload wins)
 * (2) else pre-111 resolveServiceLogo / logoUrl (incl. highResFavicon)
 * (3) else null → Tile/ServiceCard emoji or initial fallback
 */
export function getCachedServiceLogo(service: Service): Promise<string | null> {
  if (cache.has(service.id)) {
    return Promise.resolve(cache.get(service.id)!);
  }

  const existing = inflight.get(service.id);
  if (existing) return existing;

  const managed = resolveManagedIconUrl(
    {
      serviceId: service.id,
      logoUrl: service.logoUrl,
    },
    128,
  );

  if (managed && isManagedStorageUrl(managed)) {
    cache.set(service.id, managed);
    return Promise.resolve(managed);
  }

  if (managed && !/gstatic\.com\/favicon|google\.com\/s2\/favicons/i.test(managed)) {
    // Non-CDN explicit managed-style URL (blob, custom CDN) — accept without live probe.
    if (managed.startsWith('blob:') || isManagedStorageUrl(managed)) {
      cache.set(service.id, managed);
      return Promise.resolve(managed);
    }
  }

  // Tier (2): pre-111 live validation / site probe via resolveServiceLogo.
  const promise = resolveServiceLogo({
    url: service.url,
    logoUrl: service.logoUrl,
  }).then((result) => {
    cache.set(service.id, result);
    inflight.delete(service.id);
    return result;
  });

  inflight.set(service.id, promise);
  return promise;
}

export function preloadServiceLogos(services: Service[]): void {
  for (const service of services) {
    void getCachedServiceLogo(service);
  }
}

export function peekCachedLogo(serviceId: string): string | null | undefined {
  return cache.get(serviceId);
}

/** Clear cache after admin upload so Home/Manage pick up new URLs. */
export function invalidateServiceLogoCache(serviceId?: string): void {
  if (serviceId) {
    cache.delete(serviceId);
    inflight.delete(serviceId);
    return;
  }
  cache.clear();
  inflight.clear();
}
