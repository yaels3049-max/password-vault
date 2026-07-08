import type { Service, ServiceCategory } from '../mockServices';

export interface DiscoveryFilter {
  query: string;
  category: ServiceCategory | null;
}

/** Hostname (without leading www.) for domain-based search matching. */
export function serviceDomain(service: Service): string {
  const raw = service.loginUrl?.trim() || service.url?.trim() || '';
  if (!raw) {
    return '';
  }

  try {
    return new URL(raw).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * Client-side discovery search (D-104-9): match display name OR domain,
 * optionally restricted to a single category. Operates over the loaded
 * registry catalog only — no server calls.
 */
export function filterDiscoveryServices(
  services: Service[],
  filter: DiscoveryFilter,
): Service[] {
  const query = filter.query.trim().toLowerCase();

  return services.filter((service) => {
    if (filter.category && service.category !== filter.category) {
      return false;
    }

    if (!query) {
      return true;
    }

    const name = service.name.toLowerCase();
    return name.includes(query) || serviceDomain(service).includes(query);
  });
}
