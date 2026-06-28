import type { Service } from './legacyService';
import {
  SERVICE_SCHEMA_VERSION,
  type ServiceDefinition,
  type ServiceSource,
  validateServiceDefinition,
} from './serviceModel';

/**
 * Infer catalog provenance from a legacy runtime Service id.
 * Custom services created in the hub use ids prefixed with `custom-`.
 */
export function inferServiceSource(service: Pick<Service, 'id'>): ServiceSource {
  return service.id.startsWith('custom-') ? 'user-created' : 'built-in-catalog';
}

/**
 * Future adapter binding for catalog entries that use site-specific adapters today.
 * Metadata only in Iteration 3.1 — autofill still routes by legacy service id.
 */
const LEGACY_ADAPTER_ID_BY_SERVICE_ID: Readonly<Record<string, string>> = {
  htzone: 'htzone',
};

/**
 * Map a legacy runtime {@link Service} (mockServices / vault customServices shape)
 * to the canonical {@link ServiceDefinition}.
 *
 * Field mapping:
 * - id → id
 * - name → displayName
 * - url → url (primary URL)
 * - loginUrl → loginUrl
 * - loginFields → loginFields
 * - category → category
 * - icon → icon
 * - logoUrl → metadata.logoUrl (presentation layer; not part of integration)
 * - source → inferred from id (`built-in-catalog` | `user-created`)
 * - adapterId → metadata-only for htzone; undefined for all other current entries
 */
export function legacyServiceToDefinition(
  service: Service,
  options?: { source?: ServiceSource },
): ServiceDefinition {
  const source = options?.source ?? inferServiceSource(service);
  const adapterId = LEGACY_ADAPTER_ID_BY_SERVICE_ID[service.id];

  const candidate: ServiceDefinition = {
    schemaVersion: SERVICE_SCHEMA_VERSION,
    id: service.id,
    displayName: service.name,
    url: service.url,
    source,
    category: service.category,
    icon: service.icon,
  };

  if (service.loginUrl) {
    candidate.loginUrl = service.loginUrl;
  }
  if (service.loginFields) {
    candidate.loginFields = service.loginFields;
  }
  if (service.logoUrl) {
    candidate.metadata = { logoUrl: service.logoUrl };
  }
  if (adapterId) {
    candidate.adapterId = adapterId;
  }

  const result = validateServiceDefinition(candidate);
  if (!result.valid) {
    throw new Error(
      `Legacy service "${service.id}" does not map to a valid ServiceDefinition: ${result.issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  return result.definition;
}

/** Map an array of legacy catalog services to canonical definitions. */
export function legacyServicesToDefinitions(services: Service[]): ServiceDefinition[] {
  return services.map((service) => legacyServiceToDefinition(service));
}
