import type { Credential } from '../credentials';
import {
  createAccessProfile,
  getDefaultProfile,
  type AccessProfile,
} from '../profile/accessProfileModel';
import {
  normalizeExactlyOneDefaultPerService,
  validateAccessProfile,
  validateExactlyOneDefaultPerService,
} from '../profile/profileValidation';
import type { VaultState } from './vault';

const DEFAULT_PROFILE_LABEL = 'ראשי';

export class ProfileManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileManagementError';
  }
}

/** Cloud profile delete failed — do not show phantom delete (D-109-26 / AC-109-41). */
export const PROFILE_DELETE_CLOUD_FAILED_MESSAGE =
  'לא הצלחנו למחוק את הפרופיל מהחשבון. בדקו חיבור לרשת ונסו שוב.';

function assertValidProfiles(profiles: AccessProfile[]): void {
  const validation = validateExactlyOneDefaultPerService(profiles);
  if (!validation.valid) {
    throw new ProfileManagementError(
      validation.issues.map((issue) => issue.message).join('; '),
    );
  }
}

function touchProfile(profile: AccessProfile): AccessProfile {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
}

export function getProfilesForService(
  state: VaultState,
  serviceId: string,
): AccessProfile[] {
  const normalized = serviceId.trim();
  return state.accessProfiles
    .filter((profile) => profile.serviceId.trim() === normalized)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
}

export function getCredentialForProfile(
  state: VaultState,
  profileId: string,
): Credential | undefined {
  return state.credentials[profileId];
}

/** Ensure a default profile exists when saving credentials from legacy service-keyed paths. */
export function ensureDefaultProfileForService(
  state: VaultState,
  serviceId: string,
): VaultState {
  const normalized = serviceId.trim();
  const healedProfiles = normalizeExactlyOneDefaultPerService(state.accessProfiles);
  let nextState: VaultState =
    healedProfiles === state.accessProfiles
      ? state
      : { ...state, accessProfiles: healedProfiles };

  if (getDefaultProfile(nextState.accessProfiles, normalized)) {
    return nextState;
  }

  const existingForService = getProfilesForService(nextState, normalized);
  if (existingForService.length > 0) {
    // Multi/single without an explicit default — promote one instead of inventing another.
    return setDefaultAccessProfile(nextState, existingForService[0]!.id);
  }

  const candidate = createAccessProfile({
    serviceId: normalized,
    displayName: DEFAULT_PROFILE_LABEL,
    isDefault: true,
  });
  const validated = validateAccessProfile(candidate);
  if (!validated.valid) {
    throw new ProfileManagementError(
      validated.issues.map((issue) => issue.message).join('; '),
    );
  }

  return {
    ...nextState,
    accessProfiles: [...nextState.accessProfiles, validated.profile],
  };
}

export function addAccessProfile(
  state: VaultState,
  serviceId: string,
  displayName: string,
): VaultState {
  const normalizedServiceId = serviceId.trim();
  const trimmedName = displayName.trim();
  if (!trimmedName) {
    throw new ProfileManagementError('Profile display name is required');
  }

  const healedProfiles = normalizeExactlyOneDefaultPerService(state.accessProfiles);
  const baseState: VaultState =
    healedProfiles === state.accessProfiles
      ? state
      : { ...state, accessProfiles: healedProfiles };

  const existingForService = getProfilesForService(baseState, normalizedServiceId);
  const candidate = createAccessProfile({
    serviceId: normalizedServiceId,
    displayName: trimmedName,
    isDefault: existingForService.length === 0,
  });

  const validated = validateAccessProfile(candidate);
  if (!validated.valid) {
    throw new ProfileManagementError(
      validated.issues.map((issue) => issue.message).join('; '),
    );
  }

  const accessProfiles = normalizeExactlyOneDefaultPerService([
    ...baseState.accessProfiles,
    validated.profile,
  ]);
  assertValidProfiles(accessProfiles);

  return {
    ...baseState,
    accessProfiles,
  };
}

export function renameAccessProfile(
  state: VaultState,
  profileId: string,
  displayName: string,
): VaultState {
  const trimmedName = displayName.trim();
  if (!trimmedName) {
    throw new ProfileManagementError('Profile display name is required');
  }

  let found = false;
  const accessProfiles = state.accessProfiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile;
    }

    found = true;
    const updated = touchProfile({
      ...profile,
      displayName: trimmedName,
    });
    const validated = validateAccessProfile(updated);
    if (!validated.valid) {
      throw new ProfileManagementError(
        validated.issues.map((issue) => issue.message).join('; '),
      );
    }
    return validated.profile;
  });

  if (!found) {
    throw new ProfileManagementError('Profile not found');
  }

  return { ...state, accessProfiles };
}

export function setDefaultAccessProfile(state: VaultState, profileId: string): VaultState {
  const target = state.accessProfiles.find((profile) => profile.id === profileId);
  if (!target) {
    throw new ProfileManagementError('Profile not found');
  }

  const serviceId = target.serviceId.trim();
  const accessProfiles = state.accessProfiles.map((profile) => {
    if (profile.serviceId.trim() !== serviceId) {
      return profile;
    }

    const next = touchProfile({ ...profile });
    if (profile.id === profileId) {
      next.isDefault = true;
    } else {
      delete next.isDefault;
    }

    const validated = validateAccessProfile(next);
    if (!validated.valid) {
      throw new ProfileManagementError(
        validated.issues.map((issue) => issue.message).join('; '),
      );
    }

    return validated.profile;
  });

  assertValidProfiles(accessProfiles);
  return { ...state, accessProfiles };
}

/**
 * AD-123-13 — the last profile of an app may be deleted (the app keeps 0 profiles, no default).
 * Deleting the default with ≥ 2 remaining requires `replacementDefaultId` (a remaining profile of
 * the same app); missing / invalid throws and nothing changes. With 1 remaining, it becomes the
 * default. For a non-default target `replacementDefaultId` is ignored.
 */
export function deleteAccessProfile(
  state: VaultState,
  profileId: string,
  replacementDefaultId?: string,
): VaultState {
  const target = state.accessProfiles.find((profile) => profile.id === profileId);
  if (!target) {
    throw new ProfileManagementError('Profile not found');
  }

  const serviceId = target.serviceId.trim();
  const remaining = getProfilesForService(state, serviceId).filter(
    (profile) => profile.id !== profileId,
  );

  let newDefaultId: string | null = null;
  if (target.isDefault === true && remaining.length >= 2) {
    const replacement = remaining.find((profile) => profile.id === replacementDefaultId);
    if (!replacement) {
      throw new ProfileManagementError('Choose a new default profile');
    }
    newDefaultId = replacement.id;
  } else if (remaining.length === 1 && remaining[0]!.isDefault !== true) {
    newDefaultId = remaining[0]!.id;
  }

  let accessProfiles = state.accessProfiles.filter((profile) => profile.id !== profileId);
  if (newDefaultId) {
    accessProfiles = accessProfiles.map((profile) => {
      if (profile.serviceId.trim() !== serviceId) {
        return profile;
      }
      if (profile.id === newDefaultId) {
        return touchProfile({ ...profile, isDefault: true });
      }
      if (profile.isDefault === true) {
        const cleared = touchProfile({ ...profile });
        delete cleared.isDefault;
        return cleared;
      }
      return profile;
    });
  }

  const credentials = { ...state.credentials };
  delete credentials[profileId];

  accessProfiles = normalizeExactlyOneDefaultPerService(accessProfiles);
  assertValidProfiles(accessProfiles);
  return { ...state, accessProfiles, credentials };
}

export function saveCredentialForProfile(
  state: VaultState,
  profileId: string,
  credential: Credential,
): VaultState {
  if (!state.accessProfiles.some((profile) => profile.id === profileId)) {
    throw new ProfileManagementError('Profile not found');
  }

  return {
    ...state,
    credentials: {
      ...state.credentials,
      [profileId]: credential,
    },
  };
}

export function deleteCredentialForProfile(state: VaultState, profileId: string): VaultState {
  if (!state.accessProfiles.some((profile) => profile.id === profileId)) {
    throw new ProfileManagementError('Profile not found');
  }

  const credentials = { ...state.credentials };
  delete credentials[profileId];
  return { ...state, credentials };
}
