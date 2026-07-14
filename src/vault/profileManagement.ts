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

export function deleteAccessProfile(state: VaultState, profileId: string): VaultState {
  const target = state.accessProfiles.find((profile) => profile.id === profileId);
  if (!target) {
    throw new ProfileManagementError('Profile not found');
  }

  const serviceProfiles = getProfilesForService(state, target.serviceId);
  if (serviceProfiles.length <= 1) {
    throw new ProfileManagementError('Cannot delete the last profile for a service');
  }

  let accessProfiles = state.accessProfiles.filter((profile) => profile.id !== profileId);
  const credentials = { ...state.credentials };
  delete credentials[profileId];

  if (target.isDefault) {
    const replacement = accessProfiles.find(
      (profile) => profile.serviceId.trim() === target.serviceId.trim(),
    );
    if (replacement) {
      accessProfiles = accessProfiles.map((profile) =>
        profile.id === replacement.id
          ? touchProfile({ ...profile, isDefault: true })
          : profile,
      );
    }
  }

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
