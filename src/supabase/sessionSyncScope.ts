import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import type { VaultState } from '../vault/vault';

/**
 * AD-123-18 (D-123-5 write cost) — what this session last saw in the cloud, captured at its last
 * hydrate and updated by its own successful writes. In memory only. It decides only WHETHER a row
 * has something to write; whether a row may be INSERTED is decided by the persisted outbox
 * (amendment A, `vault/syncOutbox.ts`), never here.
 *
 * Credentials are compared by object reference (reducers replace the object on edit), so no
 * secret is copied here.
 */
interface SessionSyncScope {
  userId: string;
  profileSnapshots: Map<string, string>;
  credentialRefs: Map<string, Credential | undefined>;
}

let scope: SessionSyncScope | null = null;

export function profileSnapshot(profile: AccessProfile): string {
  return JSON.stringify([
    profile.serviceId.trim(),
    profile.displayName,
    profile.isDefault === true,
    profile.schemaVersion,
  ]);
}

/** The cloud rows as read at login (`fetchCloudSyncBaseline`). */
export interface CloudSyncBaseline {
  serviceIds: Set<string>;
  profileIds: Set<string>;
  profileSnapshots: Map<string, string>;
  credentials: Map<string, Credential>;
}

/** Never equal to a vault credential: marks a local credential the cloud does not hold. */
const NOT_IN_CLOUD: Credential = Object.freeze({}) as Credential;

function sameCredential(local: Credential, cloud: Credential | undefined): boolean {
  if (!cloud) return false;
  const keys = Object.keys(local);
  return keys.length === Object.keys(cloud).length && keys.every((key) => cloud[key] === local[key]);
}

/** Login hydrate: everything in `state` is the baseline. */
export function resetSessionSyncBaseline(userId: string, state: VaultState): void {
  scope = {
    userId: userId.trim(),
    profileSnapshots: new Map(state.accessProfiles.map((p) => [p.id, profileSnapshot(p)])),
    credentialRefs: new Map(state.accessProfiles.map((p) => [p.id, state.credentials[p.id]])),
  };
}

/**
 * Login: the baseline is the cloud as read, so a local value that differs from its cloud row
 * (e.g. a default healed by the hydrate, a credential the cloud key cannot read) stays pending
 * and is written by the login repair; rows equal to the cloud are not written.
 */
export function resetSessionSyncBaselineFromCloud(
  userId: string,
  state: VaultState,
  cloud: CloudSyncBaseline,
): void {
  const profileSnapshots = new Map<string, string>();
  const credentialRefs = new Map<string, Credential | undefined>();
  for (const profile of state.accessProfiles) {
    const snapshot = cloud.profileSnapshots.get(profile.id);
    if (snapshot === undefined) continue;
    profileSnapshots.set(profile.id, snapshot);
    const local = state.credentials[profile.id];
    credentialRefs.set(
      profile.id,
      local === undefined || sameCredential(local, cloud.credentials.get(profile.id)) ? local : NOT_IN_CLOUD,
    );
  }
  scope = { userId: userId.trim(), profileSnapshots, credentialRefs };
}

export function clearSessionSyncScope(): void {
  scope = null;
}

export function hasSessionSyncScope(userId: string): boolean {
  return scope !== null && scope.userId === userId.trim();
}

function scopeFor(userId: string): SessionSyncScope | null {
  return scope && scope.userId === userId.trim() ? scope : null;
}

/** Not in the baseline, or changed (profile fields / credential object) since it. */
export function profileHasPendingWrite(
  userId: string,
  profile: AccessProfile,
  credential: Credential | undefined,
): boolean {
  const current = scopeFor(userId);
  if (!current) return true;
  if (!current.profileSnapshots.has(profile.id)) return true;
  return (
    current.profileSnapshots.get(profile.id) !== profileSnapshot(profile) ||
    current.credentialRefs.get(profile.id) !== credential
  );
}

export function credentialChangedSinceBaseline(
  userId: string,
  profileId: string,
  credential: Credential | undefined,
): boolean {
  const current = scopeFor(userId);
  if (!current || !current.profileSnapshots.has(profileId)) return true;
  return current.credentialRefs.get(profileId) !== credential;
}

export function markProfileSynced(
  userId: string,
  profile: AccessProfile,
  credential: Credential | undefined,
): void {
  const current = scopeFor(userId);
  if (!current) return;
  current.profileSnapshots.set(profile.id, profileSnapshot(profile));
  current.credentialRefs.set(profile.id, credential);
}

export function forgetProfile(userId: string | null, profileId: string): void {
  const current = userId ? scopeFor(userId) : scope;
  current?.profileSnapshots.delete(profileId);
  current?.credentialRefs.delete(profileId);
}

/** Profiles of `state` with a local change the cloud has not received yet. */
export function pendingProfileIds(userId: string, state: VaultState): Set<string> {
  return new Set(
    state.accessProfiles
      .filter((p) => profileHasPendingWrite(userId, p, state.credentials[p.id]))
      .map((p) => p.id),
  );
}

/**
 * Focus re-hydrate: the new baseline is what the cloud has now. Profiles with a pending local
 * change keep their old baseline entry (or none) so they stay pending until written.
 */
export function rebaseSessionSyncScope(
  userId: string,
  state: VaultState,
  cloudProfileIds: Set<string>,
  pending: Set<string>,
): void {
  const previous = scopeFor(userId);
  if (!previous) return;
  const next: SessionSyncScope = {
    userId: previous.userId,
    profileSnapshots: new Map(),
    credentialRefs: new Map(),
  };
  for (const profile of state.accessProfiles) {
    if (!cloudProfileIds.has(profile.id)) continue;
    if (pending.has(profile.id)) {
      if (previous.profileSnapshots.has(profile.id)) {
        next.profileSnapshots.set(profile.id, previous.profileSnapshots.get(profile.id)!);
        next.credentialRefs.set(profile.id, previous.credentialRefs.get(profile.id));
      }
      continue;
    }
    next.profileSnapshots.set(profile.id, profileSnapshot(profile));
    next.credentialRefs.set(profile.id, state.credentials[profile.id]);
  }
  scope = next;
}
