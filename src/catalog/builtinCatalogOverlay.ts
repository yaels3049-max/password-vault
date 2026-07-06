import { BUILTIN_CATALOG_DEFINITIONS } from './builtinCatalog';
import type { ServiceDefinition } from '../service/serviceModel';

const BUILTIN_BY_ID = new Map(
  BUILTIN_CATALOG_DEFINITIONS.map((definition) => [definition.id, definition]),
);

/**
 * Merge execution-critical fields from builtinCatalog when registry rows are stale
 * (e.g. migration 20260706120000 not yet applied).
 */
export function applyBuiltinCatalogOverlay(definition: ServiceDefinition): ServiceDefinition {
  if (definition.source !== 'built-in-catalog') {
    return definition;
  }

  const builtin = BUILTIN_BY_ID.get(definition.id);
  if (!builtin) {
    return definition;
  }

  return {
    ...definition,
    adapterId: definition.adapterId ?? builtin.adapterId,
    loginUrl: definition.loginUrl ?? builtin.loginUrl,
    loginFields: definition.loginFields ?? builtin.loginFields,
    category: definition.category ?? builtin.category,
    icon: definition.icon ?? builtin.icon,
  };
}

export function applyBuiltinCatalogOverlayAll(
  definitions: ServiceDefinition[],
): ServiceDefinition[] {
  return definitions.map((definition) => applyBuiltinCatalogOverlay(definition));
}
