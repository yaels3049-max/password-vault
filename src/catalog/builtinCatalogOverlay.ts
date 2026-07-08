import { BUILTIN_CATALOG_DEFINITIONS } from './builtinCatalog';
import type { ServiceDefinition } from '../service/serviceModel';

const BUILTIN_BY_ID = new Map(
  BUILTIN_CATALOG_DEFINITIONS.map((definition) => [definition.id, definition]),
);

/**
 * Merge presentation-only gaps from builtinCatalog when registry rows are stale
 * (icon, category, favicon metadata). Execution fields come from registry seed only (D-103-13).
 */
export function applyBuiltinCatalogOverlay(definition: ServiceDefinition): ServiceDefinition {
  if (definition.source !== 'built-in-catalog') {
    return definition;
  }

  const builtin = BUILTIN_BY_ID.get(definition.id);
  if (!builtin) {
    return definition;
  }

  const metadata = { ...(definition.metadata ?? {}) };
  const builtinFavicon = builtin.metadata?.faviconSiteUrl;
  if (!metadata.faviconSiteUrl && builtinFavicon) {
    metadata.faviconSiteUrl = builtinFavicon;
  }

  return {
    ...definition,
    category: definition.category ?? builtin.category,
    icon: definition.icon ?? builtin.icon,
    metadata: Object.keys(metadata).length > 0 ? metadata : definition.metadata,
  };
}

export function applyBuiltinCatalogOverlayAll(
  definitions: ServiceDefinition[],
): ServiceDefinition[] {
  return definitions.map((definition) => applyBuiltinCatalogOverlay(definition));
}
