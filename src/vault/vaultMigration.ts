import type { AccessProfile } from '../profile/accessProfileModel';
import {
  createAccessProfile,
  getDefaultProfile,
} from '../profile/accessProfileModel';
import {
  normalizeExactlyOneDefaultPerService,
  validateAccessProfile,
} from '../profile/profileValidation';
import type { VaultPayload } from './crypto';

const DEFAULT_MIGRATED_PROFILE_LABEL = 'ראשי';

/** Deterministic profile id for legacy migration — idempotent per service. */
export function legacyDefaultProfileId(serviceId: string): string {
  return `profile-legacy-${serviceId.trim()}`;
}

function isProfileIdKey(key: string, profiles: AccessProfile[]): boolean {
  return profiles.some((profile) => profile.id === key);
}

function ensureDefaultProfileForService(
  profiles: AccessProfile[],
  serviceId: string,
): { profiles: AccessProfile[]; profile: AccessProfile; created: boolean } {
  const normalizedServiceId = serviceId.trim();
  const existing = getDefaultProfile(profiles, normalizedServiceId);
  if (existing) {
    return { profiles, profile: existing, created: false };
  }

  const legacyId = legacyDefaultProfileId(normalizedServiceId);
  const byLegacyId = profiles.find((profile) => profile.id === legacyId);
  if (byLegacyId) {
    return { profiles, profile: byLegacyId, created: false };
  }

  const candidate = createAccessProfile({
    id: legacyId,
    serviceId: normalizedServiceId,
    displayName: DEFAULT_MIGRATED_PROFILE_LABEL,
    isDefault: true,
  });

  const validated = validateAccessProfile(candidate);
  if (!validated.valid) {
    throw new Error(
      `Failed to create default profile for service "${normalizedServiceId}": ${validated.issues
        .map((issue) => issue.message)
        .join('; ')}`,
    );
  }

  return {
    profiles: [...profiles, validated.profile],
    profile: validated.profile,
    created: true,
  };
}

export interface VaultMigrationResult {
  payload: VaultPayload;
  /** True when credential keys or accessProfiles were changed. */
  migrated: boolean;
}

/**
 * Migrate legacy service-keyed credentials to profile-keyed storage.
 * Idempotent: safe to run on every unlock.
 */
export function migrateVaultPayload(payload: VaultPayload): VaultMigrationResult {
  let profiles = [...payload.accessProfiles];
  const credentials = { ...payload.credentials };
  let migrated = false;

  for (const [key, credential] of Object.entries(payload.credentials)) {
    if (isProfileIdKey(key, profiles)) {
      continue;
    }

    const serviceId = key.trim();
    if (!serviceId) {
      continue;
    }

    const ensured = ensureDefaultProfileForService(profiles, serviceId);
    profiles = ensured.profiles;
    if (ensured.created) {
      migrated = true;
    }

    const profile = ensured.profile;

    if (credentials[profile.id] !== credential) {
      credentials[profile.id] = credential;
      migrated = true;
    }

    if (key in credentials && key !== profile.id) {
      delete credentials[key];
      migrated = true;
    }
  }

  const normalizedProfiles = normalizeExactlyOneDefaultPerService(profiles);
  if (normalizedProfiles !== profiles) {
    profiles = normalizedProfiles;
    migrated = true;
  }

  return {
    payload: {
      ...payload,
      accessProfiles: profiles,
      credentials,
    },
    migrated,
  };
}
