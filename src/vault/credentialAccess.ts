import type { Credential } from '../credentials';
import {
  createAccessProfile,
  getDefaultProfile,
  type AccessProfile,
} from '../profile/accessProfileModel';
import { validateAccessProfile } from '../profile/profileValidation';
import type { VaultState } from './vault';

const DEFAULT_PROFILE_LABEL = 'ראשי';

/**
 * Build a service-id-keyed credential map for Dashboard and autofill (single default profile per service).
 * Credential values are unchanged — only the lookup key differs in storage.
 */
export function credentialsByServiceId(state: VaultState): Record<string, Credential> {
  const result: Record<string, Credential> = {};

  for (const profile of state.accessProfiles) {
    const credential = state.credentials[profile.id];
    if (!credential) {
      continue;
    }

    const defaultProfile = getDefaultProfile(state.accessProfiles, profile.serviceId);
    if (defaultProfile?.id === profile.id) {
      result[profile.serviceId] = credential;
    }
  }

  return result;
}

function ensureDefaultProfile(
  accessProfiles: AccessProfile[],
  serviceId: string,
): { accessProfiles: AccessProfile[]; profile: AccessProfile } {
  const normalizedServiceId = serviceId.trim();
  const existing = getDefaultProfile(accessProfiles, normalizedServiceId);
  if (existing) {
    return { accessProfiles, profile: existing };
  }

  const candidate = createAccessProfile({
    serviceId: normalizedServiceId,
    displayName: DEFAULT_PROFILE_LABEL,
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
    accessProfiles: [...accessProfiles, validated.profile],
    profile: validated.profile,
  };
}

function stripLegacyServiceKey(
  credentials: Record<string, Credential>,
  serviceId: string,
): Record<string, Credential> {
  if (!(serviceId in credentials)) {
    return credentials;
  }

  const next = { ...credentials };
  delete next[serviceId];
  return next;
}

/** Persist credentials under the default profile id for a service. */
export function saveCredentialForService(
  state: VaultState,
  serviceId: string,
  credential: Credential,
): VaultState {
  const ensured = ensureDefaultProfile(state.accessProfiles, serviceId);
  const normalizedServiceId = serviceId.trim();
  const credentials = stripLegacyServiceKey(
    {
      ...state.credentials,
      [ensured.profile.id]: credential,
    },
    normalizedServiceId,
  );

  return {
    ...state,
    accessProfiles: ensured.accessProfiles,
    credentials,
  };
}

/** Remove credentials for the default profile of a service. Profile entity is retained. */
export function deleteCredentialForService(state: VaultState, serviceId: string): VaultState {
  const normalizedServiceId = serviceId.trim();
  const profile = getDefaultProfile(state.accessProfiles, normalizedServiceId);
  let credentials = stripLegacyServiceKey({ ...state.credentials }, normalizedServiceId);

  if (profile) {
    delete credentials[profile.id];
  }

  return {
    ...state,
    credentials,
  };
}

export function getDefaultProfileIdForService(
  accessProfiles: AccessProfile[],
  serviceId: string,
): string | null {
  return getDefaultProfile(accessProfiles, serviceId)?.id ?? null;
}
