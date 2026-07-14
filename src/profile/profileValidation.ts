import {
  ACCESS_PROFILE_SCHEMA_VERSION,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  type AccessProfile,
} from './accessProfileModel';

export interface ProfileValidationIssue {
  field: string;
  message: string;
}

export type AccessProfileValidationResult =
  | { valid: true; profile: AccessProfile }
  | { valid: false; issues: ProfileValidationIssue[] };

export type ProfileCollectionValidationResult =
  | { valid: true }
  | { valid: false; issues: ProfileValidationIssue[] };

/** Top-level keys that must never appear on an access profile. */
const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'username',
  'password',
  'email',
  'credentials',
  'credential',
  'credentialSet',
  'credentialset',
  'fieldValues',
  'fields',
  'secret',
  'token',
  'apiKey',
  'accessToken',
  'refreshToken',
  'loginFields',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function collectForbiddenCredentialKeys(
  record: Record<string, unknown>,
): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];

  for (const key of Object.keys(record)) {
    if (FORBIDDEN_CREDENTIAL_KEYS.has(key)) {
      issues.push({
        field: key,
        message: 'Credentials must not be stored on an access profile',
      });
    }
  }

  return issues;
}

/**
 * Validate and normalize a canonical AccessProfile.
 * Does not verify that serviceId exists in catalog — caller supplies service context.
 */
export function validateAccessProfile(input: unknown): AccessProfileValidationResult {
  if (!isPlainObject(input)) {
    return {
      valid: false,
      issues: [{ field: 'profile', message: 'Access profile must be an object' }],
    };
  }

  const issues: ProfileValidationIssue[] = [
    ...collectForbiddenCredentialKeys(input),
  ];

  const schemaVersion = input.schemaVersion ?? ACCESS_PROFILE_SCHEMA_VERSION;
  if (schemaVersion !== ACCESS_PROFILE_SCHEMA_VERSION) {
    issues.push({
      field: 'schemaVersion',
      message: `Unsupported schema version: ${String(schemaVersion)}`,
    });
  }

  const id = input.id;
  if (!isNonEmptyString(id)) {
    issues.push({ field: 'id', message: 'id is required' });
  }

  const serviceId = input.serviceId;
  if (!isNonEmptyString(serviceId)) {
    issues.push({ field: 'serviceId', message: 'serviceId is required' });
  }

  const displayName = input.displayName;
  if (!isNonEmptyString(displayName)) {
    issues.push({ field: 'displayName', message: 'displayName is required' });
  } else if (displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) {
    issues.push({
      field: 'displayName',
      message: `displayName must be at most ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters`,
    });
  }

  const createdAt = input.createdAt;
  if (!isNonEmptyString(createdAt)) {
    issues.push({ field: 'createdAt', message: 'createdAt is required' });
  } else if (!isValidIsoTimestamp(createdAt)) {
    issues.push({ field: 'createdAt', message: 'createdAt must be a valid ISO-8601 timestamp' });
  }

  const updatedAt = input.updatedAt;
  if (!isNonEmptyString(updatedAt)) {
    issues.push({ field: 'updatedAt', message: 'updatedAt is required' });
  } else if (!isValidIsoTimestamp(updatedAt)) {
    issues.push({ field: 'updatedAt', message: 'updatedAt must be a valid ISO-8601 timestamp' });
  }

  const description = input.description;
  if (description !== undefined && !isNonEmptyString(description)) {
    issues.push({
      field: 'description',
      message: 'description must be a non-empty string when provided',
    });
  }

  const color = input.color;
  if (color !== undefined && !isNonEmptyString(color)) {
    issues.push({
      field: 'color',
      message: 'color must be a non-empty string when provided',
    });
  }

  const icon = input.icon;
  if (icon !== undefined && !isNonEmptyString(icon)) {
    issues.push({
      field: 'icon',
      message: 'icon must be a non-empty string when provided',
    });
  }

  if (input.isDefault !== undefined && typeof input.isDefault !== 'boolean') {
    issues.push({ field: 'isDefault', message: 'isDefault must be a boolean when provided' });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  const profile: AccessProfile = {
    schemaVersion: ACCESS_PROFILE_SCHEMA_VERSION,
    id: (id as string).trim(),
    serviceId: (serviceId as string).trim(),
    displayName: (displayName as string).trim(),
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  };

  if (description !== undefined) {
    profile.description = (description as string).trim();
  }

  if (color !== undefined) {
    profile.color = (color as string).trim();
  }

  if (icon !== undefined) {
    profile.icon = (icon as string).trim();
  }

  if (input.isDefault === true) {
    profile.isDefault = true;
  }

  return { valid: true, profile };
}

/** Ensure every profile id in a collection is unique. */
export function validateUniqueProfileIds(
  profiles: AccessProfile[],
): ProfileCollectionValidationResult {
  const seen = new Set<string>();
  const issues: ProfileValidationIssue[] = [];

  for (const profile of profiles) {
    const id = profile.id.trim();
    if (seen.has(id)) {
      issues.push({
        field: 'id',
        message: `Duplicate profile id "${id}"`,
      });
      continue;
    }
    seen.add(id);
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return { valid: true };
}

/**
 * When a service has multiple profiles, exactly one must be marked default.
 * Single-profile services may have zero or one default flag.
 */
export function validateExactlyOneDefaultPerService(
  profiles: AccessProfile[],
): ProfileCollectionValidationResult {
  const issues: ProfileValidationIssue[] = [];
  const byService = new Map<string, AccessProfile[]>();

  for (const profile of profiles) {
    const serviceId = profile.serviceId.trim();
    const group = byService.get(serviceId) ?? [];
    group.push(profile);
    byService.set(serviceId, group);
  }

  for (const [serviceId, group] of byService) {
    if (group.length <= 1) {
      continue;
    }

    const defaultCount = group.filter((profile) => profile.isDefault === true).length;
    if (defaultCount !== 1) {
      issues.push({
        field: 'isDefault',
        message: `Service "${serviceId}" has ${group.length} profiles but ${defaultCount} marked default; exactly one is required`,
      });
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return { valid: true };
}

/**
 * Repair multi-profile services so exactly one profile is marked default.
 * Prefers the first existing default (stable by id); otherwise the first profile.
 * Single-profile groups are left unchanged.
 */
export function normalizeExactlyOneDefaultPerService(
  profiles: AccessProfile[],
): AccessProfile[] {
  const byService = new Map<string, AccessProfile[]>();

  for (const profile of profiles) {
    const serviceId = profile.serviceId.trim();
    const group = byService.get(serviceId) ?? [];
    group.push(profile);
    byService.set(serviceId, group);
  }

  const keepDefaultId = new Set<string>();
  for (const [, group] of byService) {
    if (group.length <= 1) {
      continue;
    }
    const defaults = group
      .filter((profile) => profile.isDefault === true)
      .sort((a, b) => a.id.localeCompare(b.id));
    const chosen =
      defaults[0] ??
      [...group].sort((a, b) => a.id.localeCompare(b.id))[0];
    if (chosen) {
      keepDefaultId.add(chosen.id);
    }
  }

  if (keepDefaultId.size === 0) {
    return profiles;
  }

  let changed = false;
  const now = new Date().toISOString();
  const next = profiles.map((profile) => {
    const group = byService.get(profile.serviceId.trim()) ?? [];
    if (group.length <= 1) {
      return profile;
    }

    const shouldBeDefault = keepDefaultId.has(profile.id);
    const isDefault = profile.isDefault === true;

    if (shouldBeDefault && !isDefault) {
      changed = true;
      return { ...profile, isDefault: true, updatedAt: now };
    }

    if (!shouldBeDefault && isDefault) {
      changed = true;
      const repaired = { ...profile, updatedAt: now };
      delete repaired.isDefault;
      return repaired;
    }

    return profile;
  });

  return changed ? next : profiles;
}
