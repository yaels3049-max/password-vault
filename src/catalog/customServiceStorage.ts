import type { Service } from '../service/legacyService';
import { legacyServiceToDefinition } from '../service/legacyCatalogMap';
import {
  validateServiceDefinition,
  type ServiceDefinition,
} from '../service/serviceModel';
import { isStoredServiceDefinition } from './customService';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLegacyStoredService(value: unknown): value is Service {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' && typeof value.name === 'string';
}

/**
 * Normalize a custom service from vault storage.
 * Supports legacy Service entries and canonical ServiceDefinition entries.
 */
export function normalizeStoredCustomService(value: unknown): ServiceDefinition {
  if (isStoredServiceDefinition(value)) {
    const validated = validateServiceDefinition(value);
    if (!validated.valid) {
      throw new Error(
        `Stored custom service "${value.id}" is invalid: ${validated.issues
          .map((issue) => `${issue.field}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    return validated.definition;
  }

  if (isLegacyStoredService(value)) {
    return legacyServiceToDefinition(value, { source: 'user-created' });
  }

  throw new Error('Unsupported custom service storage format');
}

export function normalizeStoredCustomServices(values: unknown[]): ServiceDefinition[] {
  return values.map((value) => normalizeStoredCustomService(value));
}
