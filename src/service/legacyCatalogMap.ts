import type { Service } from './legacyService';
import {
  SERVICE_SCHEMA_VERSION,
  type ServiceDefinition,
  type ServiceSource,
  validateServiceDefinition,
} from './serviceModel';

/**
 * Future adapter binding for catalog entries that use site-specific adapters today.
 * Prefer {@link Service.adapterId} on the legacy runtime shape when present.
 */
const LEGACY_ADAPTER_ID_BY_SERVICE_ID: Readonly<Record<string, string>> = {};

/**
 * Map a legacy runtime Service to a canonical ServiceDefinition.
 * Source must be explicit (options.source or service.source).
 * Never infer source from the id prefix (custom-* is identity only).
 */
export function legacyServiceToDefinition(
  service: Service,
  options?: { source?: ServiceSource },
): ServiceDefinition {
  const source = options?.source ?? service.source;
  if (!source) {
    throw new Error(
      `Legacy service "${service.id}" has no authoritative source; refuse to infer from id`,
    );
  }
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
