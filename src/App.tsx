import { useEffect, useMemo, useRef, useState } from 'react';

import Dashboard from './Dashboard';

import AuthEntryScreen from './auth/AuthEntryScreen';
import {
  AUTH_COPY,
  AccountStatusError,
  restoreAccountSession,
  signOutAccount,
  type AppUserProfile,
} from './auth';

import {
  classifyAddCustomService,
  definitionsToLegacyServices,
  loadBuiltinCatalogDefinitions,
  userMessageForCustomAddFailure,
} from './catalog';

import { isDevBuild } from './dev/devMode';
import { startSaveTiming, type SaveTiming } from './dev/saveTiming';
import { logCatalogGateSummary } from './dev/catalogGateSummary';

import { preloadServiceLogos } from './logoCache';

import { setRuntimeBuiltinServices, setRuntimeCategoryCatalog } from './mockServices';

import { clearRegistryCatalogCache } from './registry/registryLoader';
import { loadRegistryCategories } from './registry/categoryCatalog';

import type { ServiceDefinition } from './service/serviceModel';
import { resolveOwnSiteDefinition } from './digitalHome/ownSiteDefinition';

import { formatErrorChain } from './formatErrorChain';

import {
  CUSTOM_SERVICE_ALREADY_EXISTS_MESSAGE,
  deleteCustomServiceRegistryRow,
  DuplicateCustomServiceError,
  ensureKnownBuiltinRegistryRow,
  normalizeCustomServiceUrl,
  serviceUrlIdentityKey,
  upsertCustomServiceRegistryRow,
  type AddCustomServiceResult,
} from './supabase/registryPersistence';

import {
  getKnownBuiltinDefinition,
  isKnownBuiltinServiceId,
} from './catalog/knownServiceBootstrap';

import {
  addToSelection,
  removeAppFromVault,
  SELECTION_PERSIST_FAILED_MESSAGE,
  SELECTION_REMOVE_CLOUD_FAILED_MESSAGE,
  shouldForcePersistFailure,
} from './serviceManagement/serviceSelection';

import {
  lockVault,
  persistVault,
  unlockVault,
  getActiveVaultCryptoKey,
  getCloudCredentialCryptoKey,
  emptyVaultState,
  WrongPasswordError,
  type VaultState,
} from './vault/vault';
import {
  hydrateWorkspaceFromCloud,
  syncVaultStateToSupabase,
  removeUserServiceFromCloud,
  bumpDualWriteGeneration,
  refreshWorkspaceFromCloud,
  setCloudGoneListener,
  setCloudConfirmedListener,
  fetchCloudSyncBaseline,
} from './supabase/persistence';
import {
  clearSessionSyncScope,
  resetSessionSyncBaseline,
  resetSessionSyncBaselineFromCloud,
} from './supabase/sessionSyncScope';
import {
  clearConfirmedInserts,
  clearDroppedRows,
  hasConfirmedInserts,
  noteDeliberateAdd,
  noteDroppedRows,
  recordLocalCreations,
  rememberEarlyConfirmations,
  takeEarlyConfirmations,
  type ConfirmedInserts,
} from './vault/syncOutbox';
import {
  applyOutboxAfterHydrate,
  CLOUD_REFRESH_MIN_INTERVAL_MS,
  dropGoneFromVault,
  reconcileChanges,
  type GoneRows,
} from './digitalHome/cloudReconcile';

import { ProfileResolution } from './profile';

import { AppVaultShell } from './trust';
import DigitalHomeCredentialModal from './loginAssistance/DigitalHomeCredentialModal';
import { offersCredentialManagementPanel } from './service/credentialSchema';
import { isUserCustomApp, type ProfileManagementRequest } from './digitalHome/appContext';
import { userFacingCategories, type AddOutcome } from './digitalHome/catalogModel';
import AppCatalogModal from './digitalHome/AppCatalogModal';
import EditSiteDetailsModal from './digitalHome/EditSiteDetailsModal';
import RemoveAppConfirmDialog from './digitalHome/RemoveAppConfirmDialog';
import UndoToast, { UNDO_WINDOW_MS } from './digitalHome/UndoToast';

import './App.css';

// Phase 107: Admin console at #/admin — gated shell mounts from main.tsx (AdminGate).
export { isAdminRoute, ADMIN_ROUTE_HASH } from './admin/adminRoutes';



/** AD-123-11 / PQ-123-1 — a removal waiting for its Undo window; memory only, never persisted. */
interface PendingRemoval {
  serviceId: string;
  serviceName: string;
  url: string;
  /** Step 5 runs for user-created custom apps only (AD-123-14), decided when the removal begins. */
  deleteOwnRow: boolean;
  deadline: number;
  committing: boolean;
}

type RemovalResult = 'removed' | 'failed' | 'none';

const CUSTOM_SERVICE_DUPLICATE_MESSAGE = CUSTOM_SERVICE_ALREADY_EXISTS_MESSAGE;

const CATALOG_NOT_READY_FOR_CUSTOM_ADD_MESSAGE =
  'לא ניתן לבדוק כפילות מול קטלוג האתרים כרגע. נסו שוב.';



function isUserCreatedDefinition(definition: ServiceDefinition): boolean {

  return definition.source === 'user-created';

}



/**
 * D-123-8 — every app in the vault `customServices` resolves to ONE definition: its registry
 * entry (own row, or the global it was promoted to in place) when approved for users, else the
 * vault copy as stored. Registry-only own rows (no vault copy yet) are kept as before.
 */
function mergeCustomDefinitions(
  vaultCustom: ServiceDefinition[],
  catalog: ServiceDefinition[],
): { definitions: ServiceDefinition[]; approvedOwnIds: Set<string> } {
  const byId = new Map<string, ServiceDefinition>();
  const catalogById = new Map<string, ServiceDefinition>();
  for (const definition of catalog) {
    catalogById.set(definition.id, definition);
    if (isUserCreatedDefinition(definition)) {
      byId.set(definition.id, definition);
    }
  }

  const approvedOwnIds = new Set<string>();
  for (const vaultCopy of vaultCustom) {
    const resolved = resolveOwnSiteDefinition(vaultCopy, catalogById.get(vaultCopy.id));
    if (resolved.approved) {
      approvedOwnIds.add(vaultCopy.id);
    }
    byId.set(vaultCopy.id, resolved.definition);
  }

  return { definitions: [...byId.values()], approvedOwnIds };
}

/**
 * Collapse built-in + custom cards that share the same site URL so Digital Home
 * and the catalog do not show duplicates (e.g. hapoalim + custom bank URL).
 * Preference uses authoritative mapped `source`, never the id prefix.
 */
function isUserCreatedRuntimeSource(
  service: { source?: string },
): boolean {
  return service.source === 'user-created';
}

function isCatalogOrGlobalRuntimeSource(
  service: { source?: string },
): boolean {
  return service.source !== undefined && service.source !== 'user-created';
}

function dedupeServicesByPrimaryUrl<
  T extends { id: string; url: string; source?: string },
>(services: T[], preferredIds: Set<string>): T[] {
  const byKey = new Map<string, T>();

  for (const service of services) {
    const key = serviceUrlIdentityKey(service.url);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, service);
      continue;
    }

    const existingPreferred = preferredIds.has(existing.id);
    const candidatePreferred = preferredIds.has(service.id);

    if (candidatePreferred && !existingPreferred) {
      byKey.set(key, service);
      continue;
    }

    if (existingPreferred && candidatePreferred) {
      // Both selected — keep catalog/global over a user-created private row.
      if (isUserCreatedRuntimeSource(existing) && isCatalogOrGlobalRuntimeSource(service)) {
        byKey.set(key, service);
      }
      continue;
    }

    if (!existingPreferred && !candidatePreferred) {
      if (isUserCreatedRuntimeSource(existing) && isCatalogOrGlobalRuntimeSource(service)) {
        byKey.set(key, service);
      }
    }
  }

  return [...byKey.values()];
}



function App() {

  const [accountProfile, setAccountProfile] = useState<AppUserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBootError, setAuthBootError] = useState<string | null>(null);
  const [loginEmailPrefill, setLoginEmailPrefill] = useState('');

  const [isUnlocked, setIsUnlocked] = useState(false);

  const [showMagicMomentHint, setShowMagicMomentHint] = useState(false);

  const [catalogDefinitions, setCatalogDefinitions] = useState<ServiceDefinition[]>([]);

  const [catalogLoading, setCatalogLoading] = useState(false);

  /** False until the first catalog fetch after unlock finishes (success or error). */
  const [catalogHydrated, setCatalogHydrated] = useState(false);

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [vaultState, setVaultState] = useState<VaultState>(() => emptyVaultState());

  /** AD-123-3 — the single profile-management host (one per app). */
  const [profileRequest, setProfileRequest] = useState<ProfileManagementRequest | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [siteEditServiceId, setSiteEditServiceId] = useState<string | null>(null);
  /** AD-123-18 (3) — apps changed by a cloud reconcile; Digital Home closes its window on them. */
  const [homeReconcile, setHomeReconcile] = useState<{
    seq: number;
    affectedServiceIds: string[];
    closedOtherSurface: boolean;
  } | null>(null);
  const profileRequestRef = useRef(profileRequest);
  profileRequestRef.current = profileRequest;
  // AC-113-45: the app window closes when the host opens, so focus returns to the app's tile.
  const profileReturnFocusId = useRef<string | null>(null);
  useEffect(() => {
    if (profileRequest) {
      profileReturnFocusId.current = profileRequest.serviceId;
      return;
    }
    const serviceId = profileReturnFocusId.current;
    profileReturnFocusId.current = null;
    if (!serviceId) return;
    document
      .querySelector<HTMLElement>(`[data-service-tile][data-service-id="${CSS.escape(serviceId)}"] button`)
      ?.focus();
  }, [profileRequest]);
  const siteEditServiceIdRef = useRef(siteEditServiceId);
  siteEditServiceIdRef.current = siteEditServiceId;



  const selectedIds = useMemo(() => new Set(vaultState.selectedIds), [vaultState.selectedIds]);

  const customServices = vaultState.customServices;

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const [selectionError, setSelectionError] = useState<string | null>(null);

  const selectionLockRef = useRef<Set<string>>(new Set());

  const [removeRequestId, setRemoveRequestId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const pendingRemovalRef = useRef<PendingRemoval | null>(null);
  const removalTimerRef = useRef<number | null>(null);
  const removalCommitRef = useRef<Promise<RemovalResult> | null>(null);

  // AD-123-11: the pending (or committing) app is hidden by UI state only; the vault still has it.
  const hiddenRemovalId = pendingRemoval?.serviceId ?? null;
  const visibleSelectedIds = useMemo(() => {
    if (!hiddenRemovalId) return selectedIds;
    const visible = new Set(selectedIds);
    visible.delete(hiddenRemovalId);
    return visible;
  }, [selectedIds, hiddenRemovalId]);

  const customServiceIds = useMemo(
    () => new Set(customServices.map((service) => service.id.trim())),
    [customServices],
  );



  const builtinDefinitions = useMemo(

    () => catalogDefinitions.filter((definition) => !isUserCreatedDefinition(definition)),

    [catalogDefinitions],

  );



  const ownSites = useMemo(

    () => mergeCustomDefinitions(customServices, catalogDefinitions),

    [customServices, catalogDefinitions],

  );



  // D-123-8: a global that is an own site (promoted in place) is represented by its resolved entry.
  const legacyBuiltinServices = useMemo(

    () =>
      definitionsToLegacyServices(
        builtinDefinitions.filter((definition) => !customServiceIds.has(definition.id.trim())),
      ),

    [builtinDefinitions, customServiceIds],

  );



  const legacyCustomServices = useMemo(

    () => definitionsToLegacyServices(ownSites.definitions),

    [ownSites],

  );



  const allServices = useMemo(
    () =>
      dedupeServicesByPrimaryUrl(
        [...legacyBuiltinServices, ...legacyCustomServices],
        selectedIds,
      ).filter(
        (service) =>
          service.id !== 'hub-practice-login' && service.category !== 'practice',
      ),
    [legacyBuiltinServices, legacyCustomServices, selectedIds],
  );



  const selectedServices = allServices.filter((s) => selectedIds.has(s.id));

  const serviceNameById = useMemo(() => {

    const names: Record<string, string> = {};

    for (const service of selectedServices) {

      names[service.id] = service.name;

    }

    return names;

  }, [selectedServices]);



  useEffect(() => {

    setRuntimeBuiltinServices(builtinDefinitions);

  }, [builtinDefinitions]);



  useEffect(() => {

    preloadServiceLogos(selectedServices);

  }, [selectedServices]);

  // Phase 109 amendment: refresh with vault key gone → Login (no authenticated+locked mid-state).
  // Prefill email from any restored session, then sign out so the only door is Auth entry.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await restoreAccountSession();
        if (!cancelled && profile?.email) {
          setLoginEmailPrefill(profile.email);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthBootError(
            error instanceof AccountStatusError
              ? error.message
              : AUTH_COPY.genericAuthFailure,
          );
        }
      } finally {
        // Sign out only while Digital Home is still mounted. If the user navigated
        // to #/admin before restore finished, do not wipe the admin login session.
        if (!cancelled) {
          try {
            await signOutAccount();
          } catch {
            // ignore
          }
          setAccountProfile(null);
          clearWorkspaceMemory();
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    setCatalogHydrated(false);
    // Always refetch — stale session cache kept admin-disabled services visible.
    clearRegistryCatalogCache();

    loadBuiltinCatalogDefinitions()
      .then(async (definitions) => {
        const registryCategories = await loadRegistryCategories();
        setRuntimeCategoryCatalog(registryCategories);
        return definitions;
      })
      .then((definitions) => {
        if (!cancelled) {
          setCatalogDefinitions(definitions);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCatalogError(formatErrorChain(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogLoading(false);
          setCatalogHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isUnlocked]);

  // Drop selections for registry services that are no longer active (admin-disabled)
  // and remove their cloud membership so hydrate cannot resurrect them.
  // IMPORTANT: never apply a stale VaultState snapshot — that stomped custom-add
  // selection (tile appeared in Discover but not in «האתרים שלי»).
  const vaultStateRef = useRef(vaultState);
  vaultStateRef.current = vaultState;
  const catalogDefinitionsRef = useRef(catalogDefinitions);
  catalogDefinitionsRef.current = catalogDefinitions;
  useEffect(() => {
    logCatalogGateSummary(catalogDefinitions);
  }, [catalogDefinitions]);
  const catalogHydratedRef = useRef(catalogHydrated);
  catalogHydratedRef.current = catalogHydrated;
  const catalogLoadingRef = useRef(catalogLoading);
  catalogLoadingRef.current = catalogLoading;
  const catalogErrorRef = useRef(catalogError);
  catalogErrorRef.current = catalogError;
  const pruneInactiveRef = useRef(false);
  useEffect(() => {
    if (!isUnlocked || !catalogHydrated || catalogError || catalogLoading) {
      return;
    }
    if (catalogDefinitions.length === 0 && vaultState.selectedIds.length > 0) {
      // Empty catalog with selections — likely load failure path already handled.
      return;
    }
    if (pruneInactiveRef.current) {
      return;
    }

    const activeCatalogIds = new Set(catalogDefinitions.map((definition) => definition.id));
    const latest = vaultStateRef.current;
    const privateCustomIds = new Set(
      latest.customServices.map((service) => service.id.trim()).filter(Boolean),
    );
    const removed = latest.selectedIds.filter(
      (id) => !activeCatalogIds.has(id) && !privateCustomIds.has(id),
    );
    if (removed.length === 0) {
      return;
    }

    const removedSet = new Set(removed);
    pruneInactiveRef.current = true;
    void (async () => {
      try {
        for (const id of removed) {
          try {
            await removeUserServiceFromCloud(id);
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[vault] prune inactive cloud remove failed:', id, error);
            }
          }
        }
        // Re-read latest after awaits so a concurrent custom-add is not erased.
        const current = vaultStateRef.current;
        const nextSelected = current.selectedIds.filter((id) => !removedSet.has(id));
        if (nextSelected.length === current.selectedIds.length) {
          return;
        }
        const next = recordLocalCreations(current, { ...current, selectedIds: nextSelected });
        await persistVault(next, { awaitCloudSync: true });
        setVaultState(next);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[vault] prune inactive selections failed:', error);
        }
      } finally {
        pruneInactiveRef.current = false;
      }
    })();
  }, [
    isUnlocked,
    catalogHydrated,
    catalogLoading,
    catalogError,
    catalogDefinitions,
    vaultState.selectedIds,
    vaultState.customServices,
  ]);

  /**
   * AD-123-18 (3) — a cloud reconcile removed apps / profiles: an open modal or site editor on
   * them closes (Digital Home closes its floating window and shows the notice).
   */
  function closeSurfacesAfterReconcile(before: VaultState, after: VaultState) {
    const changes = reconcileChanges(before, after);
    if (changes.affectedServiceIds.size === 0) {
      return;
    }
    let closedOtherSurface = false;
    const request = profileRequestRef.current;
    if (request && changes.affectedServiceIds.has(request.serviceId.trim())) {
      setProfileRequest(null);
      closedOtherSurface = true;
    }
    const siteEdit = siteEditServiceIdRef.current;
    if (siteEdit && changes.removedServiceIds.has(siteEdit.trim())) {
      setSiteEditServiceId(null);
      closedOtherSurface = true;
    }
    setHomeReconcile((previous) => ({
      seq: (previous?.seq ?? 0) + 1,
      affectedServiceIds: [...changes.affectedServiceIds],
      closedOtherSurface,
    }));
  }

  async function commitReconciledState(before: VaultState, next: VaultState) {
    await persistVault(next, { skipCloudSync: true });
    setVaultState(next);
    vaultStateRef.current = next;
    const changes = reconcileChanges(before, next);
    noteDroppedRows(changes.removedServiceIds, changes.removedProfileIds);
    closeSurfacesAfterReconcile(before, next);
  }

  // AD-123-18 amendment A — confirmed outbox inserts leave the outbox (local persist only).
  function commitConfirmedInserts(confirmed: ConfirmedInserts) {
    const before = vaultStateRef.current;
    rememberEarlyConfirmations(before, confirmed);
    const next = clearConfirmedInserts(before, confirmed);
    if (next === before) {
      return;
    }
    vaultStateRef.current = next;
    setVaultState(next);
    void persistVault(next, { skipCloudSync: true }).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('[vault] clearing confirmed outbox entries failed:', error);
      }
    });
  }

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }
    setCloudConfirmedListener(commitConfirmedInserts);
    return () => setCloudConfirmedListener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) {
      return;
    }
    const early = takeEarlyConfirmations(vaultState);
    if (hasConfirmedInserts(early)) {
      commitConfirmedInserts(early);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, vaultState]);

  // AD-123-18 (2) — a background dual-write found rows deleted elsewhere → remove them here.
  useEffect(() => {
    if (!isUnlocked) {
      return;
    }
    setCloudGoneListener((gone: GoneRows) => {
      const before = vaultStateRef.current;
      const next = dropGoneFromVault(before, gone);
      if (next === before) {
        return;
      }
      void commitReconciledState(before, next).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('[vault] removing rows deleted elsewhere failed:', error);
        }
      });
    });
    return () => setCloudGoneListener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

  // AD-123-18 (3) — re-hydrate when the window becomes visible / focused again (throttled).
  const accountUserId = accountProfile?.id ?? null;
  useEffect(() => {
    if (!isUnlocked || !accountUserId) {
      return;
    }
    const userId = accountUserId;
    let lastRun = Date.now();
    let inFlight = false;
    async function refreshOnReturn() {
      if (document.visibilityState !== 'visible' || inFlight) return;
      if (Date.now() - lastRun < CLOUD_REFRESH_MIN_INTERVAL_MS) return;
      inFlight = true;
      lastRun = Date.now();
      try {
        const keys = [getCloudCredentialCryptoKey(), getActiveVaultCryptoKey()].filter(
          (key): key is CryptoKey => Boolean(key),
        );
        if (keys.length === 0) return;
        const before = vaultStateRef.current;
        const refreshed = await refreshWorkspaceFromCloud(userId, keys, before);
        // A local change during the read wins; the next return refreshes again.
        if (!refreshed || vaultStateRef.current !== before) return;
        await commitReconciledState(before, refreshed);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[vault] refresh on return failed:', error);
        }
      } finally {
        inFlight = false;
      }
    }
    const onReturn = () => void refreshOnReturn();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, accountUserId]);

  async function saveVaultState(state: VaultState) {

    await persistVault(state);

  }



  /** D-109-23 / D-109-26: drop prior user's in-memory workspace before loading another. */
  function clearWorkspaceMemory() {
    lockVault();
    clearSessionSyncScope();
    clearDroppedRows();
    setHomeReconcile(null);
    setIsUnlocked(false);
    setVaultState(emptyVaultState());
    setProfileRequest(null);
    setCatalogOpen(false);
    setSiteEditServiceId(null);
    setCatalogDefinitions([]);
    setCatalogHydrated(false);
    setCatalogError(null);
    setCatalogLoading(false);
    setShowMagicMomentHint(false);
    setPendingIds(new Set());
    setSelectionError(null);
    selectionLockRef.current = new Set();
    clearRemovalTimer();
    setPending(null);
    setRemoveRequestId(null);
    setRemoveError(null);
    pruneInactiveRef.current = false;
    clearRegistryCatalogCache();
  }

  /** Vault lock and logout are the same path (AC-109-24): clear session + vault → Login. */
  async function handleLogout() {
    const email = accountProfile?.email ?? '';
    // AD-123-12: a pending removal commits before the workspace is cleared.
    if (pendingRemovalRef.current) {
      await commitPendingRemoval();
    }
    clearWorkspaceMemory();
    await signOutAccount();
    setAccountProfile(null);
    setAuthBootError(null);
    if (email) {
      setLoginEmailPrefill(email);
    }
  }

  function handleLockVault() {
    void handleLogout();
  }

  /** Single door: clear prior workspace, unlock THIS userId's vault, hydrate cloud→local, then paint. */
  async function handleAuthenticated(profile: AppUserProfile, password: string) {
    clearWorkspaceMemory();
    try {
      const timing = startSaveTiming('login');
      const loaded = await unlockVault(password, profile.id);
      const vaultKey = getActiveVaultCryptoKey();
      const cloudCredKey = getCloudCredentialCryptoKey();
      if (!vaultKey || !cloudCredKey) {
        throw new Error('Vault key missing after unlock');
      }
      timing.mark('unlock');

      // D-109-24 / AC-109-38: cloud→local before Digital Home paint (Chrome↔Edge parity).
      let hydrated = await hydrateWorkspaceFromCloud(
        profile.id,
        [cloudCredKey, vaultKey],
        loaded,
      );
      timing.mark('hydrate');
      // AD-123-18 amendment A: rows absent from the cloud are kept only when in the outbox.
      const cloud = await fetchCloudSyncBaseline(profile.id, cloudCredKey);
      hydrated = applyOutboxAfterHydrate(loaded, hydrated, cloud);
      // The repair writes only rows that differ from the cloud as read. A local credential the
      // cloud key cannot read (legacy vault-key era) differs, so it is re-keyed for Edge.
      if (cloud) {
        resetSessionSyncBaselineFromCloud(profile.id, hydrated, cloud);
      } else {
        resetSessionSyncBaseline(profile.id, hydrated);
      }
      timing.mark('cloudBaseline');
      // Persist into THIS browser's IndexedDB; the repair dual-write inserts only outbox rows,
      // and never wipes ciphertext omitted from partial payloads (D-109-25).
      await persistVault(hydrated, { skipCloudSync: true });
      timing.mark('persistLocal');
      try {
        const repair = await syncVaultStateToSupabase(cloudCredKey, hydrated, {
          expectedUserId: profile.id,
        });
        const settled = clearConfirmedInserts(dropGoneFromVault(hydrated, repair), repair.confirmed);
        if (settled !== hydrated) {
          // Stale local rows (deleted in another session) are dropped, not recreated (D-123-1).
          hydrated = settled;
          await persistVault(hydrated, { skipCloudSync: true });
        }
      } catch (error) {
        if (isDevBuild()) {
          console.warn('[vault] post-hydrate update-only sync failed:', error);
        }
      }
      timing.mark('repairSync');
      timing.done();

      setAccountProfile(profile);
      setAuthBootError(null);
      setLoginEmailPrefill(profile.email ?? '');
      setVaultState(hydrated);
      setIsUnlocked(true);
      // FR-01 / AD-123-1 — after login the user always lands on Digital Home; the hint is shown
      // once the first app is added.
      setShowMagicMomentHint(hydrated.selectedIds.length === 0);
    } catch (error) {
      clearWorkspaceMemory();
      await signOutAccount();
      setAccountProfile(null);
      if (error instanceof WrongPasswordError) {
        throw new Error(AUTH_COPY.vaultUnlockFailed);
      }
      throw error;
    }
  }



  async function persistSelectionState(
    next: VaultState,
    options?: { awaitCloudSync?: boolean },
  ) {
    if (shouldForcePersistFailure()) {
      throw new Error('Forced persist failure (Phase 104 test hook)');
    }
    await persistVault(next, {
      awaitCloudSync: options?.awaitCloudSync === true,
    });
  }

  // Idempotent, persist-first selection change (D-104-4, D-104-5, D-104-14).
  // Digital Home reflects the change only after persistVault succeeds (AC-104-15).
  // Remove = AD-123-11 commit (supersedes AC-104-16): cloud membership delete, local removal of
  // the app with its profiles / credentials, re-verify, then the own custom registry row.
  async function changeSelection(
    id: string,
    mode: 'add' | 'remove',
    options?: { deleteOwnRow?: boolean },
  ): Promise<boolean | undefined> {
    if (selectionLockRef.current.has(id)) {
      return;
    }
    selectionLockRef.current.add(id);
    setPendingIds((prev) => new Set(prev).add(id));
    setSelectionError(null);

    try {
      if (mode === 'add' && isKnownBuiltinServiceId(id)) {
        const known = getKnownBuiltinDefinition(id);
        if (known) {
          await ensureKnownBuiltinRegistryRow(known);
          clearRegistryCatalogCache();
          const refreshed = await loadBuiltinCatalogDefinitions();
          setRuntimeCategoryCatalog(await loadRegistryCategories());
          setCatalogDefinitions(refreshed);
        }
      }

      if (mode === 'add') {
        noteDeliberateAdd(id);
      }
      // The latest committed state: a removal commits from the Undo timer, after other edits.
      const vaultState = vaultStateRef.current;
      // A removal adds nothing to the outbox and drops the app's ids from it (arch ruling 3).
      const next = recordLocalCreations(
        vaultState,
        mode === 'add' ? addToSelection(vaultState, id) : removeAppFromVault(vaultState, id),
      );

      if (mode === 'remove') {
        // Durable remove: delete cloud membership BEFORE local success paint.
        // Bump dual-write gen so any in-flight upsert cannot resurrect this row.
        bumpDualWriteGeneration();
        try {
          await removeUserServiceFromCloud(id);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[vault] cloud remove-service failed:', error);
          }
          setSelectionError(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE);
          return;
        }
      }

      try {
        await persistSelectionState(next, {
          awaitCloudSync: mode === 'remove',
        });
      } catch (error) {
        if (mode === 'remove') {
          if (import.meta.env.DEV) {
            console.warn('[serviceManagement] local persist after cloud remove failed:', error);
          }
          await restoreLocalAfterFailedRemove(vaultState);
          setSelectionError(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE);
          return;
        }
        throw error;
      }

      if (mode === 'remove') {
        // Final guard: a raced upsert must not leave membership behind.
        try {
          await removeUserServiceFromCloud(id);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[vault] cloud remove re-verify failed:', error);
          }
          await restoreLocalAfterFailedRemove(vaultState);
          setSelectionError(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE);
          return;
        }
        if (options?.deleteOwnRow) {
          await deleteOwnCustomRow(id);
        }
      }

      vaultStateRef.current = next;
      setVaultState(next);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[serviceManagement] selection persist failed:', error);
      }
      setSelectionError(SELECTION_PERSIST_FAILED_MESSAGE);
    } finally {
      selectionLockRef.current.delete(id);
      setPendingIds((prev) => {
        const nextPending = new Set(prev);
        nextPending.delete(id);
        return nextPending;
      });
    }
  }

  function addService(id: string): Promise<boolean | undefined> {
    return changeSelection(id, 'add');
  }

  /** AD-123-8 / FR-18 — catalog add = addService → changeSelection(id, 'add'); no profile. */
  async function addApp(id: string): Promise<AddOutcome> {
    // AD-123-12: re-adding the app of a pending removal commits the removal first; the app is
    // then added fresh.
    if (pendingRemovalRef.current?.serviceId === id && (await commitPendingRemoval()) === 'failed') {
      return { status: 'failed', message: SELECTION_REMOVE_CLOUD_FAILED_MESSAGE };
    }
    if (vaultStateRef.current.selectedIds.includes(id)) {
      return { status: 'already_added' };
    }
    const ok = await addService(id);
    return ok === true
      ? { status: 'added' }
      : { status: 'failed', message: SELECTION_PERSIST_FAILED_MESSAGE };
  }

  /** AD-123-11 — a failed removal leaves local as it was, also after the local write (steps 3–4). */
  async function restoreLocalAfterFailedRemove(previous: VaultState) {
    try {
      await persistVault(previous, { skipCloudSync: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[vault] restoring local after a failed remove failed:', error);
      }
    }
  }

  /** AD-123-11 step 5 — the app already counts as removed: one retry, then a dev warning only. */
  async function deleteOwnCustomRow(id: string) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await deleteCustomServiceRegistryRow(id);
        return;
      } catch (error) {
        if (attempt === 2 && import.meta.env.DEV) {
          console.warn('[vault] own custom registry row delete failed:', error);
        }
      }
    }
  }

  function setPending(next: PendingRemoval | null) {
    pendingRemovalRef.current = next;
    setPendingRemoval(next);
  }

  function clearRemovalTimer() {
    if (removalTimerRef.current !== null) {
      window.clearTimeout(removalTimerRef.current);
      removalTimerRef.current = null;
    }
  }

  /** «הסרת אפליקציה» — opens the confirm. Another pending removal commits now (AD-123-12). */
  async function requestRemoveApp(serviceId: string): Promise<void> {
    const pending = pendingRemovalRef.current;
    if (pending?.serviceId === serviceId) {
      return;
    }
    if (pending) {
      await commitPendingRemoval();
    }
    if (!vaultStateRef.current.selectedIds.includes(serviceId)) {
      return;
    }
    setRemoveError(null);
    setSelectionError(null);
    setRemoveRequestId(serviceId);
  }

  /** Confirmed: hide the tile and start the Undo window. Nothing is written yet. */
  function beginPendingRemoval(serviceId: string) {
    setRemoveRequestId(null);
    const service = allServices.find((item) => item.id === serviceId);
    if (!service || pendingRemovalRef.current || removalCommitRef.current) {
      return;
    }
    setPending({
      serviceId,
      serviceName: service.name,
      url: service.url,
      deleteOwnRow: isUserCustomApp(service, customServiceIds.has(serviceId.trim())),
      deadline: Date.now() + UNDO_WINDOW_MS,
      committing: false,
    });
    clearRemovalTimer();
    removalTimerRef.current = window.setTimeout(() => {
      removalTimerRef.current = null;
      void commitPendingRemoval();
    }, UNDO_WINDOW_MS);
  }

  /** «ביטול» in the Undo window — zero writes. */
  function undoPendingRemoval() {
    if (removalCommitRef.current) {
      return;
    }
    clearRemovalTimer();
    setPending(null);
  }

  /**
   * AD-123-11 — commits the pending removal under the selection lock. On failure the tile comes
   * back and local stays as it was. 'none' = nothing was pending.
   */
  function commitPendingRemoval(): Promise<RemovalResult> {
    if (removalCommitRef.current) {
      return removalCommitRef.current;
    }
    const pending = pendingRemovalRef.current;
    if (!pending) {
      return Promise.resolve('none');
    }
    clearRemovalTimer();
    setPending({ ...pending, committing: true });
    const run = (async (): Promise<RemovalResult> => {
      try {
        const ok = await changeSelection(pending.serviceId, 'remove', {
          deleteOwnRow: pending.deleteOwnRow,
        });
        if (ok === true) {
          return 'removed';
        }
        setRemoveError(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE);
        return 'failed';
      } finally {
        setPending(null);
        removalCommitRef.current = null;
      }
    })();
    removalCommitRef.current = run;
    return run;
  }

  /** AD-123-12 — a custom site added with the URL of the pending removal commits it first. */
  async function commitPendingRemovalForUrl(rawUrl: string) {
    const pending = pendingRemovalRef.current;
    if (pending && serviceUrlIdentityKey(pending.url) === serviceUrlIdentityKey(rawUrl)) {
      await commitPendingRemoval();
    }
  }



  async function snapshotCatalogForCustomAdd(): Promise<ServiceDefinition[]> {
    const ready =
      catalogHydratedRef.current &&
      !catalogLoadingRef.current &&
      !catalogErrorRef.current;
    if (ready) {
      return catalogDefinitionsRef.current;
    }

    try {
      clearRegistryCatalogCache();
      const definitions = await loadBuiltinCatalogDefinitions();
      setRuntimeCategoryCatalog(await loadRegistryCategories());
      setCatalogDefinitions(definitions);
      setCatalogError(null);
      setCatalogHydrated(true);
      setCatalogLoading(false);
      catalogDefinitionsRef.current = definitions;
      catalogErrorRef.current = null;
      catalogHydratedRef.current = true;
      catalogLoadingRef.current = false;
      return definitions;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[vault] Catalog snapshot for custom add failed:', error);
      }
      throw new Error(CATALOG_NOT_READY_FOR_CUSTOM_ADD_MESSAGE);
    }
  }

  function displayNameForExistingCustom(
    existingServiceId: string,
    existingDisplayName: string | null,
  ): string {
    if (existingDisplayName?.trim()) {
      return existingDisplayName.trim();
    }
    const fromVault = vaultStateRef.current.customServices.find(
      (service) => service.id === existingServiceId,
    );
    if (fromVault?.displayName.trim()) {
      return fromVault.displayName;
    }
    const fromCatalog = catalogDefinitionsRef.current.find(
      (service) => service.id === existingServiceId,
    );
    if (fromCatalog?.displayName.trim()) {
      return fromCatalog.displayName;
    }
    return 'האתר';
  }

  async function addCustomService(definition: ServiceDefinition): Promise<AddCustomServiceResult> {
    const normalizedUrl = normalizeCustomServiceUrl(definition.url);
    await commitPendingRemovalForUrl(normalizedUrl);
    const catalogSnapshot = await snapshotCatalogForCustomAdd();
    const latestVault = vaultStateRef.current;
    const classified = classifyAddCustomService({
      normalizedUrl,
      definitions: catalogSnapshot,
      selectedIds: new Set(latestVault.selectedIds),
      localCustomServices: latestVault.customServices,
    });
    if (classified) {
      return classified;
    }

    const timing = startSaveTiming('custom-site create');
    // Explicit login entry only. Do not call Login Discovery (D-108-4 / D-108-7).
    try {
      await upsertCustomServiceRegistryRow(definition);
      timing.mark('registryUpsert');
    } catch (error) {
      if (error instanceof DuplicateCustomServiceError) {
        const displayName = displayNameForExistingCustom(
          error.existingServiceId,
          error.existingDisplayName,
        );
        if (vaultStateRef.current.selectedIds.includes(error.existingServiceId)) {
          return {
            status: 'already_in_user_home',
            existingServiceId: error.existingServiceId,
            displayName,
          };
        }
        return {
          status: 'same_user_custom_duplicate',
          existingServiceId: error.existingServiceId,
          displayName,
        };
      }
      if (import.meta.env.DEV) {
        console.warn('[vault] Custom service registry upsert failed:', error);
      }
      throw new Error(userMessageForCustomAddFailure(error));
    }

    const persistBase = vaultStateRef.current;
    noteDeliberateAdd(definition.id);
    const nextState = recordLocalCreations(persistBase, {
      ...persistBase,
      customServices: [...persistBase.customServices, definition],
      selectedIds: [...new Set([...persistBase.selectedIds, definition.id])],
    });

    // Persist-first: only commit the tile after persistVault succeeds (AC-104-14, AC-104-15).
    try {
      await persistVault(nextState, { awaitCloudSync: true });
      timing.mark('persistVaultAndSync');
    } catch (error) {
      try {
        await deleteCustomServiceRegistryRow(definition.id);
      } catch (rollbackError) {
        if (import.meta.env.DEV) {
          console.warn('[vault] Custom service registry rollback failed:', rollbackError);
        }
      }
      throw error;
    }

    setVaultState(nextState);
    setSelectionError(null);
    // D-123-5: the tile already comes from vault `customServices`; the catalog refresh runs in
    // the background instead of holding the form on «שומר…».
    void refreshCatalogAfterCustomSave(timing);
    return { status: 'created' };
  }

  async function refreshCatalogAfterCustomSave(timing: SaveTiming) {
    try {
      clearRegistryCatalogCache();
      const refreshed = await loadBuiltinCatalogDefinitions();
      setRuntimeCategoryCatalog(await loadRegistryCategories());
      setCatalogDefinitions(refreshed);
      timing.mark('catalogReload (background)');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[vault] catalog refresh after custom save failed:', error);
      }
    } finally {
      timing.done();
    }
  }

  async function updateCustomService(definition: ServiceDefinition): Promise<void> {
    const timing = startSaveTiming('custom-site edit');
    try {
      await upsertCustomServiceRegistryRow(definition);
      timing.mark('registryUpsert');
    } catch (error) {
      if (error instanceof DuplicateCustomServiceError) {
        throw new Error(CUSTOM_SERVICE_DUPLICATE_MESSAGE);
      }
      if (import.meta.env.DEV) {
        console.warn('[vault] Custom service registry update failed:', error);
      }
      throw new Error(userMessageForCustomAddFailure(error));
    }

    const nextCustom = customServices.some((service) => service.id === definition.id)
      ? customServices.map((service) =>
          service.id === definition.id ? definition : service,
        )
      : [...customServices, definition];
    const nextState: VaultState = {
      ...vaultState,
      customServices: nextCustom,
    };

    await persistVault(nextState, { awaitCloudSync: true });
    timing.mark('persistVaultAndSync');
    setVaultState(nextState);
    setSelectionError(null);
    void refreshCatalogAfterCustomSave(timing);
  }


  async function handleVaultStateChange(state: VaultState) {
    const next = recordLocalCreations(vaultStateRef.current, state);

    setVaultState(next);

    await saveVaultState(next);

  }

  /** AD-123-3 / AD-123-5 — opens the host only; nothing is written until a save in the modal. */
  function openProfileManagement(request: ProfileManagementRequest) {
    const service = allServices.find((item) => item.id === request.serviceId);
    if (!service || !offersCredentialManagementPanel(service)) {
      return;
    }
    setProfileRequest(request);
  }

  const profileHostService = profileRequest
    ? allServices.find((item) => item.id === profileRequest.serviceId) ?? null
    : null;

  const profileHost =
    profileRequest && profileHostService ? (
      <DigitalHomeCredentialModal
        service={profileHostService}
        request={{ profileId: profileRequest.profileId, mode: profileRequest.mode }}
        vaultState={vaultState}
        vaultUnlocked={isUnlocked}
        onLockVault={handleLockVault}
        onVaultStateChange={handleVaultStateChange}
        onClose={() => setProfileRequest(null)}
      />
    ) : null;



  if (!authReady) {
    return (
      <div className="onboarding">
        <p>טוען חשבון…</p>
      </div>
    );
  }

  if (!accountProfile || !isUnlocked) {
    return (
      <>
        {authBootError ? (
          <p className="unlock-error" style={{ paddingTop: '1rem' }} role="alert">
            {authBootError}
          </p>
        ) : null}
        <AuthEntryScreen
          initialEmail={loginEmailPrefill}
          onAuthenticated={handleAuthenticated}
        />
      </>
    );
  }

  // Wait for the first catalog hydrate after unlock so Digital Home never paints
  // vault-only customs and then jumps when builtins arrive.
  if (!catalogHydrated) {
    return (
      <div className="onboarding">
        <p>טוען קטלוג אתרים…</p>
      </div>
    );
  }

  /** Retry from the catalog modal; Digital Home stays (no full-screen loading or error). */
  async function retryCatalogLoad() {
    setCatalogLoading(true);
    setCatalogError(null);
    // Phase 109: do not sign out the account session on catalog retry
    clearRegistryCatalogCache();

    try {
      const definitions = await loadBuiltinCatalogDefinitions();
      setRuntimeCategoryCatalog(await loadRegistryCategories());
      setCatalogDefinitions(definitions);
    } catch (error) {
      setCatalogError(formatErrorChain(error));
    } finally {
      setCatalogLoading(false);
      setCatalogHydrated(true);
    }
  }

  const catalogHost = catalogOpen ? (
    <AppCatalogModal
      services={allServices}
      categories={userFacingCategories()}
      selectedIds={visibleSelectedIds}
      pendingIds={pendingIds}
      catalogError={catalogError}
      onRetryCatalog={() => void retryCatalogLoad()}
      onAddApp={addApp}
      onAddCustom={addCustomService}
      onClose={() => setCatalogOpen(false)}
    />
  ) : null;

  const siteEditService = siteEditServiceId
    ? allServices.find((item) => item.id === siteEditServiceId) ?? null
    : null;

  const siteEditHost = siteEditService ? (
    <EditSiteDetailsModal
      service={siteEditService}
      definition={vaultState.customServices.find((item) => item.id === siteEditService.id)}
      categories={userFacingCategories()}
      onSave={updateCustomService}
      onClose={() => setSiteEditServiceId(null)}
    />
  ) : null;

  /** AD-123-14 — only user-created apps in the vault `customServices` can be edited. */
  function openSiteDetailsEdit(serviceId: string) {
    if (!customServiceIds.has(serviceId)) {
      return;
    }
    const service = allServices.find((item) => item.id === serviceId);
    if (!service || !isUserCustomApp(service, true)) {
      return;
    }
    setSiteEditServiceId(serviceId);
  }

  const removeRequestService = removeRequestId
    ? allServices.find((item) => item.id === removeRequestId) ?? null
    : null;

  // The catalog modal shows its own add failure inline.
  const homeError = removeError ?? (catalogOpen ? null : selectionError);

  // AD-123-11 — user-side confirm, Undo window and failure notice (N-4).
  const removeAppHosts = (
    <>
      {removeRequestService && (
        <RemoveAppConfirmDialog
          serviceName={removeRequestService.name}
          onConfirm={() => beginPendingRemoval(removeRequestService.id)}
          onCancel={() => setRemoveRequestId(null)}
        />
      )}
      {pendingRemoval && !pendingRemoval.committing && (
        <UndoToast
          serviceName={pendingRemoval.serviceName}
          deadline={pendingRemoval.deadline}
          onUndo={undoPendingRemoval}
        />
      )}
      {homeError && (
        <div className="dh-remove-error" role="alert" dir="rtl" data-remove-error="true">
          <span>{homeError}</span>
          <button
            type="button"
            className="la-icon-btn"
            aria-label="סגירה"
            onClick={() => {
              setRemoveError(null);
              setSelectionError(null);
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );



  // AD-123-1 — Digital Home is the only user screen, also with 0 apps and a catalog error: the
  // error and its retry live in the catalog modal (AC-104-10 inline variant).
  return (

      <AppVaultShell>

        <ProfileResolution

          accessProfiles={vaultState.accessProfiles}

          serviceNameById={serviceNameById}

        >

          {(resolveProfile) => (
            <>
            <Dashboard

              services={hiddenRemovalId ? selectedServices.filter((s) => s.id !== hiddenRemovalId) : selectedServices}

              credentialsByProfileId={vaultState.credentials}

              accessProfiles={vaultState.accessProfiles}

              resolveProfile={resolveProfile}

              userDisplayName={[accountProfile.firstName, accountProfile.lastName]
                .filter(Boolean)
                .join(' ')}

              showMagicMomentHint={showMagicMomentHint}

              onDismissMagicMomentHint={() => setShowMagicMomentHint(false)}

              catalogLoading={catalogLoading}

              catalogError={catalogError}

              vaultUnlocked={isUnlocked}

              onLockVault={handleLockVault}

              customServiceIds={customServiceIds}

              approvedOwnSiteIds={ownSites.approvedOwnIds}

              onOpenProfileManagement={openProfileManagement}

              onOpenCatalog={() => setCatalogOpen(true)}

              onEditSiteDetails={(service) => openSiteDetailsEdit(service.id)}

              onRemoveApp={(service) => void requestRemoveApp(service.id)}

              cloudReconcile={homeReconcile}

            />

            {profileHost}
            {catalogHost}
            {siteEditHost}
            {removeAppHosts}
            </>
          )}

        </ProfileResolution>

      </AppVaultShell>

  );

}



export default App;

