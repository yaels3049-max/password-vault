/**
 * Canonical Service entity (Phase 3 — Iteration 3.1).
 *
 * Service definitions are configuration only. Credentials live in the vault (ADR-002).
 * See CATALOG_MAPPING.md for how mockServices.ts entries map to this model.
 */

export const SERVICE_SCHEMA_VERSION = 1;

export const DISPLAY_NAME_MAX_LENGTH = 120;

export type ServiceCategory = string;

export type LoginFieldType = 'text' | 'password';

export interface LoginField {
  id: string;
  label: string;
  type: LoginFieldType;
}

/** Provenance of a service definition. */
export type ServiceSource =
  | 'built-in-catalog'
  | 'user-created'
  | 'imported'
  | 'org-catalog';

/**
 * Forward-compatible metadata bag. Unknown keys must be ignorable by older clients.
 */
export type ServiceMetadata = Record<string, unknown>;

/**
 * Canonical Service entity — metadata and references only; no credentials.
 */
export interface ServiceDefinition {
  /** Schema version for forward-compatible parsing and migration. */
  schemaVersion: typeof SERVICE_SCHEMA_VERSION;

  /** Stable unique identifier within the hub instance. */
  id: string;

  /** Human-readable name for tiles and credential UI. */
  displayName: string;

  /** Primary site URL (homepage or canonical entry point). */
  url: string;

  /** Dedicated login page when different from url. Optional until discovery or catalog supplies it. */
  loginUrl?: string;

  /** Ordered login field schema; vault credential keys. */
  loginFields?: LoginField[];

  /** UX grouping. */
  category?: ServiceCategory;

  /** Presentation reference: emoji, asset id, icon URL, or user upload handle. */
  icon?: string;

  /** Where this definition originated. */
  source?: ServiceSource;

  /**
   * Registered adapter reference when generic integration is insufficient.
   * Metadata only in Iteration 3.1 — not wired to autofill routing.
   */
  adapterId?: string;

  /** Extensibility hooks (e.g. legacy logoUrl, locale). */
  metadata?: ServiceMetadata;
}

export interface ServiceValidationIssue {
  field: string;
  message: string;
}

export type ServiceValidationResult =
  | { valid: true; definition: ServiceDefinition }
  | { valid: false; issues: ServiceValidationIssue[] };

/** Top-level keys that must never appear on a service definition. */
const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'username',
  'password',
  'credentials',
  'credential',
  'secret',
  'token',
  'apiKey',
  'accessToken',
  'refreshToken',
]);

const ALLOWED_URL_SCHEMES = new Set(['https:', 'http:']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidUrl(value: string): boolean {
  if (value.startsWith('/')) {
    return value.length > 1;
  }

  try {
    const parsed = new URL(value);
    return ALLOWED_URL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectForbiddenCredentialKeys(
  record: Record<string, unknown>,
): ServiceValidationIssue[] {
  const issues: ServiceValidationIssue[] = [];

  for (const key of Object.keys(record)) {
    if (FORBIDDEN_CREDENTIAL_KEYS.has(key)) {
      issues.push({
        field: key,
        message: 'Credentials must not be stored in the service definition',
      });
    }
  }

  return issues;
}

function validateLoginFields(
  loginFields: unknown,
): { fields?: LoginField[]; issues: ServiceValidationIssue[] } {
  const issues: ServiceValidationIssue[] = [];

  if (!Array.isArray(loginFields)) {
    issues.push({ field: 'loginFields', message: 'loginFields must be an array' });
    return { issues };
  }

  const fields: LoginField[] = [];
  const seenIds = new Set<string>();
  let passwordCount = 0;

  for (const [index, entry] of loginFields.entries()) {
    if (!isPlainObject(entry)) {
      issues.push({
        field: `loginFields[${index}]`,
        message: 'Each login field must be an object',
      });
      continue;
    }

    const { id, label, type } = entry;

    if (!isNonEmptyString(id)) {
      issues.push({
        field: `loginFields[${index}].id`,
        message: 'Field id is required',
      });
      continue;
    }

    if (seenIds.has(id)) {
      issues.push({
        field: `loginFields[${index}].id`,
        message: `Duplicate field id "${id}"`,
      });
      continue;
    }
    seenIds.add(id);

    if (!isNonEmptyString(label)) {
      issues.push({
        field: `loginFields[${index}].label`,
        message: 'Field label is required',
      });
      continue;
    }

    if (type !== 'text' && type !== 'password') {
      issues.push({
        field: `loginFields[${index}].type`,
        message: 'Field type must be "text" or "password"',
      });
      continue;
    }

    if (type === 'password') {
      passwordCount += 1;
    }

    fields.push({ id, label, type });
  }

  if (fields.length > 0 && passwordCount === 0) {
    issues.push({
      field: 'loginFields',
      message: 'At least one password-type field is required when loginFields is present',
    });
  }

  return { fields: issues.length === 0 ? fields : undefined, issues };
}

/**
 * Validate and normalize a canonical ServiceDefinition.
 * adapterId is accepted as metadata only; registry checks are deferred to Iteration 3.6.
 */
export function validateServiceDefinition(
  input: unknown,
): ServiceValidationResult {
  if (!isPlainObject(input)) {
    return {
      valid: false,
      issues: [{ field: 'service', message: 'Service definition must be an object' }],
    };
  }

  const issues: ServiceValidationIssue[] = [
    ...collectForbiddenCredentialKeys(input),
  ];

  const schemaVersion = input.schemaVersion ?? SERVICE_SCHEMA_VERSION;
  if (schemaVersion !== SERVICE_SCHEMA_VERSION) {
    issues.push({
      field: 'schemaVersion',
      message: `Unsupported schema version: ${String(schemaVersion)}`,
    });
  }

  const id = input.id;
  if (!isNonEmptyString(id)) {
    issues.push({ field: 'id', message: 'id is required' });
  }

  const displayName = input.displayName;
  if (!isNonEmptyString(displayName)) {
    issues.push({ field: 'displayName', message: 'displayName is required' });
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    issues.push({
      field: 'displayName',
      message: `displayName must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
    });
  }

  const url = input.url;
  if (!isNonEmptyString(url)) {
    issues.push({ field: 'url', message: 'url is required' });
  } else if (!isValidUrl(url)) {
    issues.push({ field: 'url', message: 'url must be a valid http(s) URL or app-relative path' });
  }

  const loginUrl = input.loginUrl;
  if (loginUrl !== undefined) {
    if (!isNonEmptyString(loginUrl)) {
      issues.push({ field: 'loginUrl', message: 'loginUrl must be a non-empty string when provided' });
    } else if (!isValidUrl(loginUrl)) {
      issues.push({
        field: 'loginUrl',
        message: 'loginUrl must be a valid http(s) URL or app-relative path',
      });
    }
  }

  let loginFields: LoginField[] | undefined;
  if (input.loginFields !== undefined) {
    const loginFieldResult = validateLoginFields(input.loginFields);
    issues.push(...loginFieldResult.issues);
    loginFields = loginFieldResult.fields;
  }

  const category = input.category;
  if (category !== undefined && !isNonEmptyString(category)) {
    issues.push({ field: 'category', message: 'category must be a non-empty string when provided' });
  }

  const icon = input.icon;
  if (icon !== undefined && !isNonEmptyString(icon)) {
    issues.push({ field: 'icon', message: 'icon must be a non-empty string when provided' });
  }

  const source = input.source;
  if (
    source !== undefined &&
    source !== 'built-in-catalog' &&
    source !== 'user-created' &&
    source !== 'imported' &&
    source !== 'org-catalog'
  ) {
    issues.push({ field: 'source', message: 'source is not a recognized value' });
  }

  const adapterId = input.adapterId;
  if (adapterId !== undefined && !isNonEmptyString(adapterId)) {
    issues.push({
      field: 'adapterId',
      message: 'adapterId must be a non-empty string when provided',
    });
  }

  const metadata = input.metadata;
  if (metadata !== undefined) {
    if (!isPlainObject(metadata)) {
      issues.push({ field: 'metadata', message: 'metadata must be an object' });
    } else {
      issues.push(...collectForbiddenCredentialKeys(metadata));
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const definition: ServiceDefinition = {
    schemaVersion: SERVICE_SCHEMA_VERSION,
    id: id as string,
    displayName: displayName as string,
    url: url as string,
  };

  if (loginUrl !== undefined) {
    definition.loginUrl = loginUrl as string;
  }
  if (loginFields !== undefined) {
    definition.loginFields = loginFields;
  }
  if (category !== undefined) {
    definition.category = category as ServiceCategory;
  }
  if (icon !== undefined) {
    definition.icon = icon as string;
  }
  if (source !== undefined) {
    definition.source = source as ServiceSource;
  }
  if (adapterId !== undefined) {
    definition.adapterId = adapterId as string;
  }
  if (metadata !== undefined && isPlainObject(metadata)) {
    definition.metadata = metadata as ServiceMetadata;
  }

  return { valid: true, definition };
}

/** Default login field schema when a service omits loginFields. */
export const DEFAULT_LOGIN_FIELDS: LoginField[] = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];

export function getLoginFieldsForDefinition(
  definition: Pick<ServiceDefinition, 'loginFields'>,
): LoginField[] {
  return definition.loginFields ?? DEFAULT_LOGIN_FIELDS;
}

export function getServiceOpenUrlForDefinition(
  definition: Pick<ServiceDefinition, 'url' | 'loginUrl'>,
): string {
  return definition.loginUrl ?? definition.url;
}
