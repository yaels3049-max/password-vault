import type { Service, ServiceCategory } from '../service/legacyService';
import type { ServiceDefinition } from '../service/serviceModel';
import { resolveManagedIconUrl } from '../serviceAssets/resolveActiveManagedAsset';
import { readLoginIntelligence } from '../loginIntelligence/readWrite';

/** Pre-111 presentation helper — still used as cascade tier (2). */
export function highResFavicon(siteUrl: string): string {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(siteUrl)}&size=128`;
}

/**
 * Phase 111 M8 paint cascade (D-111-6 / D-111-17):
 * (1) active managed Storage URL if present
 * (2) else pre-111 path (explicit logoUrl / faviconSiteUrl → highResFavicon)
 * (3) else undefined → UI emoji/initial fallback
 *
 * Admin upload wins via metadata.activeIcon. Day-one must NOT be Storage-only.
 */
function resolveLogoUrl(definition: ServiceDefinition): string | undefined {
  const managed = resolveManagedIconUrl(definition, 128);
  if (managed) {
    return managed;
  }

  const metadata = definition.metadata;
  if (!metadata) {
    return undefined;
  }

  if (typeof metadata.logoUrl === 'string' && metadata.logoUrl.trim()) {
    return metadata.logoUrl.trim();
  }

  if (typeof metadata.faviconSiteUrl === 'string' && metadata.faviconSiteUrl.trim()) {
    return highResFavicon(metadata.faviconSiteUrl);
  }

  return undefined;
}

/**
 * Map a canonical ServiceDefinition to the legacy runtime Service shape
 * consumed by Dashboard, vault, and autofill routing today.
 */
export function definitionToLegacyService(definition: ServiceDefinition): Service {
  if (!definition.category) {
    throw new Error(`Built-in catalog entry "${definition.id}" is missing category`);
  }

  if (!definition.icon) {
    throw new Error(`Built-in catalog entry "${definition.id}" is missing icon`);
  }

  const service: Service = {
    id: definition.id,
    name: definition.displayName,
    icon: definition.icon,
    url: definition.url,
    category: definition.category as ServiceCategory,
  };

  if (definition.loginUrl) {
    service.loginUrl = definition.loginUrl;
  }
  if (definition.loginFields) {
    service.loginFields = definition.loginFields;
  }
  if (definition.adapterId) {
    service.adapterId = definition.adapterId;
  }

  if (definition.metadata) {
    service.metadata = definition.metadata;
    const li = readLoginIntelligence(definition.metadata);
    if (li) {
      service.loginIntelligence = li;
    }
  }

  const logoUrl = resolveLogoUrl(definition);
  if (logoUrl) {
    service.logoUrl = logoUrl;
  }

  return service;
}

export function definitionsToLegacyServices(
  definitions: ServiceDefinition[],
): Service[] {
  return definitions.map((definition) => definitionToLegacyService(definition));
}
