/**
 * Canonical Access Profile entity (Phase 4 — Iteration 4.1).
 *
 * Profiles are user-owned identity contexts bound to a service. Credentials live in
 * the vault keyed by profile id — never on this entity (ADR-002).
 * See PROFILE_MODEL.md for relationship to ServiceDefinition and credential sets.
 */

export const ACCESS_PROFILE_SCHEMA_VERSION = 1;

export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 120;

export const ACCESS_PROFILE_ID_PREFIX = 'profile-';

/**
 * Access Profile — identity context for one service. No credentials.
 */
export interface AccessProfile {
  /** Schema version for forward-compatible parsing and migration. */
  schemaVersion: typeof ACCESS_PROFILE_SCHEMA_VERSION;

  /** Stable unique identifier within the vault instance. */
  id: string;

  /** Parent service id (catalog or custom ServiceDefinition.id). */
  serviceId: string;

  /** Human-readable profile label (e.g. "פרטי", "עבודה"). */
  displayName: string;

  /** ISO-8601 timestamp when the profile was created. */
  createdAt: string;

  /** ISO-8601 timestamp when the profile was last updated. */
  updatedAt: string;

  /** Optional user-facing description. */
  description?: string;

  /** Optional presentation color (hex, token, or theme key). */
  color?: string;

  /** Optional presentation icon (emoji, asset id, or URL). */
  icon?: string;

  /** When true, preferred default for this service when resolution does not choose explicitly. */
  isDefault?: boolean;
}

export interface CreateAccessProfileInput {
  serviceId: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  /** Override id generation (tests only). */
  id?: string;
  /** Override timestamps (tests only). */
  createdAt?: string;
  updatedAt?: string;
}

/** Stable unique id for access profiles. */
export function generateAccessProfileId(): string {
  return `${ACCESS_PROFILE_ID_PREFIX}${crypto.randomUUID()}`;
}

function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a new AccessProfile with generated id and timestamps.
 * Does not persist. Caller should run validateAccessProfile before storage.
 */
export function createAccessProfile(input: CreateAccessProfileInput): AccessProfile {
  const timestamp = nowIsoTimestamp();

  const profile: AccessProfile = {
    schemaVersion: ACCESS_PROFILE_SCHEMA_VERSION,
    id: input.id ?? generateAccessProfileId(),
    serviceId: input.serviceId.trim(),
    displayName: input.displayName.trim(),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };

  if (input.description !== undefined) {
    profile.description = input.description.trim();
  }

  if (input.color !== undefined) {
    profile.color = input.color.trim();
  }

  if (input.icon !== undefined) {
    profile.icon = input.icon.trim();
  }

  if (input.isDefault === true) {
    profile.isDefault = true;
  }

  return profile;
}

/** Whether the profile is explicitly marked as the default for its service. */
export function isDefaultProfile(profile: AccessProfile): boolean {
  return profile.isDefault === true;
}

/**
 * Resolve the default profile for a service from a list.
 * Prefers explicit isDefault; if exactly one profile exists for the service, returns it.
 */
export function getDefaultProfile(
  profiles: AccessProfile[],
  serviceId: string,
): AccessProfile | null {
  const normalizedServiceId = serviceId.trim();
  const forService = profiles.filter(
    (profile) => profile.serviceId.trim() === normalizedServiceId,
  );

  if (forService.length === 0) {
    return null;
  }

  const explicitDefault = forService.find((profile) => isDefaultProfile(profile));
  if (explicitDefault) {
    return explicitDefault;
  }

  if (forService.length === 1) {
    return forService[0] ?? null;
  }

  return null;
}
