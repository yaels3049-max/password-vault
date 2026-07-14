import type { ServiceCategory } from '../service/legacyService';
import {
  SERVICE_SCHEMA_VERSION,
  validateServiceDefinition,
  type ServiceDefinition,
} from '../service/serviceModel';

const CUSTOM_SERVICE_ID_PREFIX = 'custom-';

export function isCustomServiceId(id: string): boolean {
  return id.startsWith(CUSTOM_SERVICE_ID_PREFIX);
}

/** Stable unique id for user-created services. */
export function generateCustomServiceId(): string {
  return `${CUSTOM_SERVICE_ID_PREFIX}${crypto.randomUUID()}`;
}

export type CustomPrimaryUrlValidationResult =
  | { valid: true; normalizedUrl: string }
  | { valid: false; message: string };

/** Apex hosts like example.com / example.co.il — safe to prefix www. */
function isLikelyApexHostname(hostname: string): boolean {
  const labels = hostname.toLowerCase().split('.').filter(Boolean);
  if (labels.length === 2) return true;
  if (
    labels.length === 3 &&
    ['co', 'ac', 'org', 'gov', 'com', 'net', 'idf'].includes(labels[1] ?? '')
  ) {
    return true;
  }
  return false;
}

/**
 * Custom services require a valid HTTPS primary URL (Iteration 3.3a).
 * Completes bare hosts: `example.co.il` → `https://www.example.co.il`.
 */
export function validateCustomPrimaryUrl(url: string): CustomPrimaryUrlValidationResult {
  const trimmed = url.trim().replace(/\s+/g, '');
  if (!trimmed) {
    return { valid: false, message: 'יש להזין כתובת אתר' };
  }

  try {
    let candidate = trimmed;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else if (/^http:\/\//i.test(candidate)) {
      candidate = `https://${candidate.slice('http://'.length)}`;
    }

    const parsed = new URL(candidate);

    if (parsed.protocol !== 'https:') {
      return { valid: false, message: 'כתובת האתר חייבת להיות HTTPS' };
    }

    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, message: 'כתובת האתר אינה תקינה' };
    }

    if (
      !parsed.hostname.toLowerCase().startsWith('www.') &&
      isLikelyApexHostname(parsed.hostname)
    ) {
      parsed.hostname = `www.${parsed.hostname}`;
    }

    return { valid: true, normalizedUrl: parsed.href };
  } catch {
    return { valid: false, message: 'כתובת האתר אינה תקינה' };
  }
}

export interface CreateCustomServiceInput {
  displayName: string;
  primaryUrl: string;
  category: ServiceCategory;
}

export function createCustomServiceDefinition(
  input: CreateCustomServiceInput,
): ServiceDefinition {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error('displayName is required');
  }

  const urlValidation = validateCustomPrimaryUrl(input.primaryUrl);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.message);
  }

  const candidate: ServiceDefinition = {
    schemaVersion: SERVICE_SCHEMA_VERSION,
    id: generateCustomServiceId(),
    displayName,
    url: urlValidation.normalizedUrl,
    icon: '🔗',
    category: input.category,
    source: 'user-created',
    metadata: { faviconSiteUrl: urlValidation.normalizedUrl },
  };

  const result = validateServiceDefinition(candidate);
  if (!result.valid) {
    const details = result.issues
      .map((issue) => `${issue.field}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid custom service: ${details}`);
  }

  return result.definition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when vault entry is already a canonical ServiceDefinition. */
export function isStoredServiceDefinition(value: unknown): value is ServiceDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.url === 'string'
  );
}
