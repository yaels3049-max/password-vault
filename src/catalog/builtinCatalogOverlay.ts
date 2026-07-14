import { BUILTIN_CATALOG_DEFINITIONS } from './builtinCatalog';
import type { ServiceDefinition } from '../service/serviceModel';

const BUILTIN_BY_ID = new Map(
  BUILTIN_CATALOG_DEFINITIONS.map((definition) => [definition.id, definition]),
);

/**
 * Fill gaps from builtinCatalog when registry rows are stale.
 * Presentation: icon, category, favicon.
 * Execution (Phase 110): missing loginUrl / loginFields — so Digital Home opens the
 * real login entry and generic autofill can run (e.g. Hapoalim after seed lag).
 * Never overwrites non-empty registry/admin values.
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

  const loginUrl = definition.loginUrl?.trim() || builtin.loginUrl?.trim() || undefined;
  const loginFields =
    definition.loginFields && definition.loginFields.length > 0
      ? definition.loginFields
      : builtin.loginFields && builtin.loginFields.length > 0
        ? builtin.loginFields
        : definition.loginFields;

  return {
    ...definition,
    category: definition.category ?? builtin.category,
    icon: definition.icon ?? builtin.icon,
    ...(loginUrl ? { loginUrl } : {}),
    ...(loginFields ? { loginFields } : {}),
    metadata: Object.keys(metadata).length > 0 ? metadata : definition.metadata,
  };
}

export function applyBuiltinCatalogOverlayAll(
  definitions: ServiceDefinition[],
): ServiceDefinition[] {
  return definitions.map((definition) => applyBuiltinCatalogOverlay(definition));
}
