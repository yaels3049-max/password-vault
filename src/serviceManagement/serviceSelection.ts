import type { VaultState } from '../vault/vault';

export const SELECTION_PERSIST_FAILED_MESSAGE =
  'לא ניתן לשמור את השינוי כרגע. בדקו חיבור לרשת ונסו שוב.';

/** Cloud membership delete failed — do not show phantom remove (D-113-29 / AC-113-51). */
export const SELECTION_REMOVE_CLOUD_FAILED_MESSAGE =
  'לא הצלחנו להסיר את האתר מהחשבון. בדקו חיבור לרשת ונסו שוב.';

/** Thrown by cloud remove when Auth/Supabase is missing (must not no-op). */
export const CLOUD_REMOVE_UNAVAILABLE_MESSAGE =
  'CLOUD_REMOVE_UNAVAILABLE';

/**
 * Add a service id to the selection (idempotent — Set dedupes repeated adds). An app that is not
 * selected yet starts without the profiles / credentials left behind by an earlier AC-104-16
 * removal (arch §7), so old credentials never reappear.
 */
export function addToSelection(state: VaultState, serviceId: string): VaultState {
  if (!state.selectedIds.includes(serviceId)) {
    state = removeAppProfiles(state, serviceId);
  }
  const nextIds = new Set(state.selectedIds);
  nextIds.add(serviceId);
  return { ...state, selectedIds: [...nextIds] };
}

/** All profiles of the app and their credentials. */
function removeAppProfiles(state: VaultState, serviceId: string): VaultState {
  const target = serviceId.trim();
  const removed = new Set(
    state.accessProfiles.filter((profile) => profile.serviceId.trim() === target).map((profile) => profile.id),
  );
  if (removed.size === 0 && !(target in state.credentials)) {
    return state;
  }
  const credentials: VaultState['credentials'] = {};
  for (const [key, credential] of Object.entries(state.credentials)) {
    if (!removed.has(key) && key !== target) {
      credentials[key] = credential;
    }
  }
  return {
    ...state,
    accessProfiles: state.accessProfiles.filter((profile) => !removed.has(profile.id)),
    credentials,
  };
}

/**
 * AD-123-11 — the app is gone from this vault: its selection, all of its profiles, their
 * credentials and its `customServices` entry (custom site). Pure; the caller persists.
 */
export function removeAppFromVault(state: VaultState, serviceId: string): VaultState {
  const target = serviceId.trim();
  const next = removeAppProfiles(state, target);
  return {
    ...next,
    selectedIds: next.selectedIds.filter((id) => id.trim() !== target),
    customServices: next.customServices.filter((service) => service.id.trim() !== target),
  };
}

/** Remove a service id from the selection. Profiles and credentials are preserved (AC-104-16). */
export function removeFromSelection(state: VaultState, serviceId: string): VaultState {
  if (!state.selectedIds.includes(serviceId)) {
    return state;
  }
  return {
    ...state,
    selectedIds: state.selectedIds.filter((id) => id !== serviceId),
  };
}

/**
 * Dev-only persist-failure hook for T13 (persist failure → friendly error, no phantom tile).
 * Enable in the browser console: `window.__PHASE104_FORCE_PERSIST_FAIL = true`.
 * Never active in production builds.
 */
export function shouldForcePersistFailure(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__PHASE104_FORCE_PERSIST_FAIL === true
  );
}
