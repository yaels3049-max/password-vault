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
 * Prefer {@link Service.adapterId} on the legacy runtime shape when present.
 */
const LEGACY_ADAPTER_ID_BY_SERVICE_ID: Readonly<Record<string, string>> = {};

export function legacyServiceToDefinition(
  service: Service,
  options?: { source?: ServiceSource },
): ServiceDefinition {
  const source = options?.source ?? inferServiceSource(service);
  const adapterId = service.adapterId ?? LEGACY_ADAPTER_ID_BY_SERVICE_ID[service.id];

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
