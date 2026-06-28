import type { Service, ServiceCategory } from '../service/legacyService';
import type { ServiceDefinition } from '../service/serviceModel';

export function highResFavicon(siteUrl: string): string {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(siteUrl)}&size=128`;
}

function resolveLogoUrl(definition: ServiceDefinition): string | undefined {
  const metadata = definition.metadata;
  if (!metadata) {
    return undefined;
  }

  if (typeof metadata.logoUrl === 'string' && metadata.logoUrl.trim()) {
    return metadata.logoUrl;
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
