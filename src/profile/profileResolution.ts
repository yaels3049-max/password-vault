import type { AccessProfile } from './accessProfileModel';
import { getDefaultProfile } from './accessProfileModel';

/**
 * Profiles for a service, sorted for stable display in the execution-time chooser.
 */
export function profilesForService(
  accessProfiles: AccessProfile[],
  serviceId: string,
): AccessProfile[] {
  const normalized = serviceId.trim();
  return accessProfiles
    .filter((profile) => profile.serviceId.trim() === normalized)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
}

/** True when the user must confirm a profile before open (multiple profiles). */
export function needsUserProfileSelection(profiles: AccessProfile[]): boolean {
  return profiles.length > 1;
}

/**
 * When exactly one profile exists, resolve it without user interaction.
 * Returns null when zero or multiple profiles exist.
 */
export function autoResolvedProfileId(profiles: AccessProfile[]): string | null {
  if (profiles.length !== 1) {
    return null;
  }

  return profiles[0]?.id ?? null;
}

/**
 * Profile id to preselect in the chooser: explicit default, else the sole profile,
 * else the first profile in display order.
 */
export function preselectedProfileId(
  profiles: AccessProfile[],
  serviceId: string,
): string | null {
  if (profiles.length === 0) {
    return null;
  }

  const defaultProfile = getDefaultProfile(profiles, serviceId);
  if (defaultProfile) {
    return defaultProfile.id;
  }

  return profiles[0]?.id ?? null;
}

export type ProfileResolutionOutcome =
  | { kind: 'resolved'; profileId: string }
  | { kind: 'chooser_required'; profiles: AccessProfile[]; preselectedProfileId: string | null }
  | { kind: 'unavailable' };

/**
 * Decide whether profile resolution can complete immediately or needs user confirmation.
 */
export function planProfileResolution(
  accessProfiles: AccessProfile[],
  serviceId: string,
): ProfileResolutionOutcome {
  const profiles = profilesForService(accessProfiles, serviceId);

  if (profiles.length === 0) {
    return { kind: 'unavailable' };
  }

  const automatic = autoResolvedProfileId(profiles);
  if (automatic) {
    return { kind: 'resolved', profileId: automatic };
  }

  return {
    kind: 'chooser_required',
    profiles,
    preselectedProfileId: preselectedProfileId(profiles, serviceId),
  };
}
