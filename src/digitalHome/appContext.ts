/**
 * Phase 123.1 — Digital Home app context (AD-123-2, -3, -6, -7, -13). Pure helpers only:
 * no storage, no cloud, no React.
 */
import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import {
  addAccessProfile,
  ProfileManagementError,
  saveCredentialForProfile,
} from '../vault/profileManagement';
import type { VaultState } from '../vault/vault';

/** AD-123-3 — the single profile-management host is opened with this request. */
export interface ProfileManagementRequest {
  serviceId: string;
  profileId?: string;
  mode: 'edit' | 'add';
}

export interface AppContextActions {
  switcher: boolean;
  edit_profile: boolean;
  add_profile: boolean;
  empty_state: boolean;
  menu: {
    remove_app: boolean;
    edit_site_details: boolean;
  };
}

export type DeleteProfilePlan = 'simple' | 'auto_default' | 'choose_default';

function displayOrder(profiles: AccessProfile[]): AccessProfile[] {
  return [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName, 'he'));
}

/** AD-123-6 — green dot: ≥ 1 profile for the app; credentials are ignored. */
export function appHasProfile(
  state: Pick<VaultState, 'accessProfiles'>,
  serviceId: string,
): boolean {
  const normalized = serviceId.trim();
  return state.accessProfiles.some((profile) => profile.serviceId.trim() === normalized);
}

/**
 * AD-123-7 — the profile a window opens on: the default, else (legacy data without a default)
 * the first in display order. Never reads a persisted "last used" profile.
 */
export function initialActiveProfile(profiles: AccessProfile[]): string | null {
  if (profiles.length === 0) {
    return null;
  }
  const ordered = displayOrder(profiles);
  return (ordered.find((profile) => profile.isDefault === true) ?? ordered[0])!.id;
}

/**
 * AD-123-14 (123.3 clarification) — the single Digital Home "custom" rule: the app is in the vault
 * `customServices` AND its runtime source is `user-created`. A vault-custom id whose runtime source
 * is the catalog (promoted) is catalog-origin.
 */
export function isUserCustomApp(service: { source?: string }, inVaultCustomServices: boolean): boolean {
  return inVaultCustomServices && service.source === 'user-created';
}

/**
 * AD-123-2 — actions of the floating window for one app. `isCustom` = `isUserCustomApp` (AD-123-14).
 */
export function appContextActions(
  service: { id: string },
  profiles: AccessProfile[],
  isCustom: boolean,
): AppContextActions {
  void service;
  const count = profiles.length;
  return {
    switcher: count >= 2,
    edit_profile: count >= 1,
    add_profile: true,
    empty_state: count === 0,
    menu: {
      remove_app: true,
      edit_site_details: isCustom,
    },
  };
}

/** AD-123-13 — what deleting `profileId` needs, given the profiles of its app. */
export function deleteProfilePlan(profiles: AccessProfile[], profileId: string): DeleteProfilePlan {
  const target = profiles.find((profile) => profile.id === profileId);
  if (!target || target.isDefault !== true) {
    return 'simple';
  }
  const remaining = profiles.length - 1;
  if (remaining <= 0) {
    return 'simple';
  }
  return remaining === 1 ? 'auto_default' : 'choose_default';
}

/**
 * AD-123-3 add mode — one save = `addAccessProfile`, then `saveCredentialForProfile` when a
 * credential was entered. The caller persists the returned state once.
 */
export function addProfileWithCredential(
  state: VaultState,
  serviceId: string,
  displayName: string,
  credential: Credential | null,
): { state: VaultState; profileId: string } {
  const before = new Set(state.accessProfiles.map((profile) => profile.id));
  let next = addAccessProfile(state, serviceId, displayName);
  const added = next.accessProfiles.filter((profile) => !before.has(profile.id));
  if (added.length !== 1) {
    throw new ProfileManagementError('Profile not found');
  }
  const profileId = added[0]!.id;
  if (credential) {
    next = saveCredentialForProfile(next, profileId, credential);
  }
  return { state: next, profileId };
}
