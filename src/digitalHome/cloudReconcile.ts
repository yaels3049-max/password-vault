import { normalizeExactlyOneDefaultPerService } from '../profile/profileValidation';
import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import { outboxOf } from '../vault/syncOutbox';
import type { VaultState } from '../vault/vault';

/** AD-123-18 (3) — at most one focus / visibility re-hydrate per interval. */
export const CLOUD_REFRESH_MIN_INTERVAL_MS = 10_000;

export const MSG_REMOVED_ELSEWHERE = 'האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.';

export interface GoneRows {
  goneProfileIds: string[];
  goneServiceIds: string[];
}

/**
 * AD-123-18 (2) — rows deleted elsewhere are removed here: the app's selection with all of its
 * profiles and their credentials, and single profiles with their credentials.
 */
export function dropGoneFromVault(state: VaultState, gone: GoneRows): VaultState {
  const goneServices = new Set(gone.goneServiceIds.map((id) => id.trim()).filter(Boolean));
  const goneProfiles = new Set(gone.goneProfileIds);
  const dropProfile = (profileId: string, serviceId: string) =>
    goneProfiles.has(profileId) || goneServices.has(serviceId.trim());

  const accessProfiles = state.accessProfiles.filter((p) => !dropProfile(p.id, p.serviceId));
  const selectedIds = state.selectedIds.filter((id) => !goneServices.has(id.trim()));
  if (
    accessProfiles.length === state.accessProfiles.length &&
    selectedIds.length === state.selectedIds.length
  ) {
    return state;
  }
  const kept = new Set(accessProfiles.map((p) => p.id));
  const credentials: VaultState['credentials'] = {};
  for (const [profileId, credential] of Object.entries(state.credentials)) {
    const owner = state.accessProfiles.find((p) => p.id === profileId);
    if (!owner || kept.has(profileId)) credentials[profileId] = credential;
  }
  return {
    ...state,
    selectedIds,
    accessProfiles: normalizeExactlyOneDefaultPerService(accessProfiles),
    credentials,
  };
}

export interface CloudWorkspaceIds {
  serviceIds: Set<string>;
  profileIds: Set<string>;
}

/**
 * AD-123-18 amendment A — login / re-hydrate. A local row absent from the cloud is kept (and
 * inserted by the next sync) when its id is in the outbox; otherwise it was deleted elsewhere and
 * is removed with its credentials. Legacy rows (no outbox) follow the second rule. Outbox ids the
 * cloud already has are confirmed and leave the outbox.
 *
 * `cloud === null` (existence unknown) or an empty cloud membership (D-109-25: cannot prove a
 * deletion) → nothing is removed; outbox rows are still kept.
 */
export function applyOutboxAfterHydrate(
  local: VaultState,
  hydrated: VaultState,
  cloud: CloudWorkspaceIds | null,
): VaultState {
  const outbox = outboxOf(local);
  const pendingServices = new Set(outbox.serviceIds.filter((id) => !cloud?.serviceIds.has(id)));
  const pendingProfiles = new Set(outbox.profileIds.filter((id) => !cloud?.profileIds.has(id)));
  const canDrop = cloud !== null && cloud.serviceIds.size > 0;

  const selectedIds = hydrated.selectedIds.filter(
    (id) => !canDrop || cloud.serviceIds.has(id.trim()) || pendingServices.has(id.trim()),
  );
  for (const id of local.selectedIds) {
    if (pendingServices.has(id.trim()) && !selectedIds.some((s) => s.trim() === id.trim())) {
      selectedIds.push(id);
    }
  }
  const selected = new Set(selectedIds.map((id) => id.trim()));

  const accessProfiles: AccessProfile[] = hydrated.accessProfiles.filter(
    (p) => !canDrop || cloud.profileIds.has(p.id) || pendingProfiles.has(p.id),
  );
  const droppedProfiles = new Set(
    hydrated.accessProfiles.filter((p) => !accessProfiles.includes(p)).map((p) => p.id),
  );
  const credentials: Record<string, Credential> = {};
  for (const [profileId, credential] of Object.entries(hydrated.credentials)) {
    if (!droppedProfiles.has(profileId)) credentials[profileId] = credential;
  }
  for (const profile of local.accessProfiles) {
    if (!pendingProfiles.has(profile.id) || !selected.has(profile.serviceId.trim())) continue;
    if (accessProfiles.some((p) => p.id === profile.id)) continue;
    accessProfiles.push(profile);
    const credential = local.credentials[profile.id];
    if (credential) credentials[profile.id] = credential;
  }

  const keptProfiles = new Set(accessProfiles.map((p) => p.id));
  return {
    ...hydrated,
    selectedIds,
    accessProfiles: normalizeExactlyOneDefaultPerService(accessProfiles),
    credentials,
    syncOutbox: {
      serviceIds: [...pendingServices].filter((id) => selected.has(id)),
      profileIds: [...pendingProfiles].filter((id) => keptProfiles.has(id)),
    },
  };
}

export interface ReconcileChanges {
  removedServiceIds: Set<string>;
  removedProfileIds: Set<string>;
  /** Apps removed, or apps that lost a profile. */
  affectedServiceIds: Set<string>;
}

export function reconcileChanges(before: VaultState, after: VaultState): ReconcileChanges {
  const afterSelected = new Set(after.selectedIds.map((id) => id.trim()));
  const afterProfiles = new Set(after.accessProfiles.map((p) => p.id));
  const removedServiceIds = new Set(
    before.selectedIds.map((id) => id.trim()).filter((id) => !afterSelected.has(id)),
  );
  const removedProfileIds = new Set<string>();
  const affectedServiceIds = new Set(removedServiceIds);
  for (const profile of before.accessProfiles) {
    if (!afterProfiles.has(profile.id)) {
      removedProfileIds.add(profile.id);
      affectedServiceIds.add(profile.serviceId.trim());
    }
  }
  return { removedServiceIds, removedProfileIds, affectedServiceIds };
}
