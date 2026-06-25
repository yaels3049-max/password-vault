import type { Service } from './mockServices';
import { resolveServiceLogo } from './resolveServiceLogo';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export function getCachedServiceLogo(service: Service): Promise<string | null> {
  if (cache.has(service.id)) {
    return Promise.resolve(cache.get(service.id)!);
  }

  const existing = inflight.get(service.id);
  if (existing) return existing;

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
