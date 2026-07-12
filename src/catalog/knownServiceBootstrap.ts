import { BUILTIN_CATALOG_DEFINITIONS, HUB_PRACTICE_LOGIN_ID } from './builtinCatalog';
import type { ServiceDefinition } from '../service/serviceModel';
import { urlsReferToSameService } from '../supabase/registryPersistence';

const KNOWN_BY_ID = new Map(
  BUILTIN_CATALOG_DEFINITIONS.filter((d) => d.id !== HUB_PRACTICE_LOGIN_ID).map((d) => [
    d.id,
    d,
  ]),
);

/** Authoritative in-app seed for known services (Clalit, Shufersal, …). */
export function getKnownBuiltinDefinition(serviceId: string): ServiceDefinition | null {
  return KNOWN_BY_ID.get(serviceId) ?? null;
}

export function listKnownBuiltinDefinitions(): ServiceDefinition[] {
  return [...KNOWN_BY_ID.values()];
}

export function isKnownBuiltinServiceId(serviceId: string): boolean {
  return KNOWN_BY_ID.has(serviceId);
}

/**
 * Resolve a user-entered or custom definition to the canonical known-service seed
 * when the primary URL matches a built-in catalog entry.
 */
export function resolveKnownBuiltinByUrl(primaryUrl: string): ServiceDefinition | null {
  for (const definition of KNOWN_BY_ID.values()) {
    if (urlsReferToSameService(definition.url, primaryUrl)) {
      return definition;
    }
  }
  return null;
}

/**
 * When service_registry is missing known built-ins, this helper can rebuild a
 * definition list from the Hub seed. Prefer ensureKnownBuiltinRegistryRow on
 * add/select instead of injecting into the live catalog (avoids ghost tiles).
 */
export function bootstrapMissingKnownBuiltins(
  registryDefinitions: ServiceDefinition[],
): ServiceDefinition[] {
  const byId = new Map(registryDefinitions.map((definition) => [definition.id, definition]));
  const merged = [...registryDefinitions];

  for (const known of KNOWN_BY_ID.values()) {
    if (!byId.has(known.id)) {
      merged.push(known);
      byId.set(known.id, known);
    }
  }

  return merged;
}

/** Merge discovery metadata onto a known seed without clobbering integration fields. */
export function mergeDiscoveryOntoKnownSeed(
  seed: ServiceDefinition,
  discoveryPatch: {
    loginUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): ServiceDefinition {
  return {
    ...seed,
    loginUrl: discoveryPatch.loginUrl?.trim() || seed.loginUrl,
    metadata: {
      ...(seed.metadata ?? {}),
      ...(discoveryPatch.metadata ?? {}),
    },
  };
}
