import { useEffect, useMemo, useRef, useState } from 'react';

import Dashboard from './Dashboard';

import ManageServices from './ManageServices';

import AuthEntryScreen from './auth/AuthEntryScreen';
import {
  AUTH_COPY,
  AccountStatusError,
  countUserServices,
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

import { preloadServiceLogos } from './logoCache';

import { setRuntimeBuiltinServices, setRuntimeCategoryCatalog, type Service } from './mockServices';

import { clearRegistryCatalogCache } from './registry/registryLoader';
import { loadRegistryCategories } from './registry/categoryCatalog';

import type { ServiceDefinition } from './service/serviceModel';

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

import { credentialsByServiceId } from './vault/credentialAccess';

import {
  addToSelection,
  removeFromSelection,
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
} from './supabase/persistence';

import { ProfileResolution } from './profile';

import { AppVaultShell } from './trust';
import DigitalHomeCredentialModal from './loginAssistance/DigitalHomeCredentialModal';
import { offersCredentialManagementPanel, resolveCredentialEntry } from './service/credentialSchema';
import { ensureDefaultProfileForService } from './vault/profileManagement';

import './App.css';

// Phase 107: Admin console at #/admin — gated shell mounts from main.tsx (AdminGate).
export { isAdminRoute, ADMIN_ROUTE_HASH } from './admin/adminRoutes';



type Screen = 'manage' | 'dashboard';

const CUSTOM_SERVICE_DUPLICATE_MESSAGE = CUSTOM_SERVICE_ALREADY_EXISTS_MESSAGE;

const CATALOG_NOT_READY_FOR_CUSTOM_ADD_MESSAGE =
  'לא ניתן לבדוק כפילות מול קטלוג האתרים כרגע. נסו שוב.';



function isUserCreatedDefinition(definition: ServiceDefinition): boolean {

  return definition.source === 'user-created';

}



function mergeCustomDefinitions(
  vaultCustom: ServiceDefinition[],
  registryCustom: ServiceDefinition[],
): ServiceDefinition[] {
  const byId = new Map<string, ServiceDefinition>();

  // Registry first, then vault — vault discovery enrichment must not be wiped
  // when the registry row still has a null login_url (persist lag / RLS miss).
  for (const definition of registryCustom) {
    byId.set(definition.id, definition);
  }

  for (const definition of vaultCustom) {
    const existing = byId.get(definition.id);
    if (!existing) {
      byId.set(definition.id, definition);
      continue;
    }

    byId.set(definition.id, {
      ...existing,
      ...definition,
      loginUrl: definition.loginUrl ?? existing.loginUrl,
      loginFields: definition.loginFields ?? existing.loginFields,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(definition.metadata ?? {}),
      },
    });
  }

  return [...byId.values()];
}

/**
 * Collapse built-in + custom cards that share the same site URL so Digital Home
 * and Manage Services do not show duplicates (e.g. hapoalim + custom bank URL).
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

  const [screen, setScreen] = useState<Screen>('manage');

  const [manageIsFirstRun, setManageIsFirstRun] = useState(false);

  const [showMagicMomentHint, setShowMagicMomentHint] = useState(false);

  const [catalogDefinitions, setCatalogDefinitions] = useState<ServiceDefinition[]>([]);

  const [catalogLoading, setCatalogLoading] = useState(false);

  /** False until the first catalog fetch after unlock finishes (success or error). */
  const [catalogHydrated, setCatalogHydrated] = useState(false);

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [vaultState, setVaultState] = useState<VaultState>(() => emptyVaultState());

  const [homeCredentialService, setHomeCredentialService] = useState<Service | null>(null);



  const selectedIds = useMemo(() => new Set(vaultState.selectedIds), [vaultState.selectedIds]);

  const customServices = vaultState.customServices;

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const [selectionError, setSelectionError] = useState<string | null>(null);

  const selectionLockRef = useRef<Set<string>>(new Set());

  const credentials = useMemo(

    () => credentialsByServiceId(vaultState),

    [vaultState],

  );



  const builtinDefinitions = useMemo(

    () => catalogDefinitions.filter((definition) => !isUserCreatedDefinition(definition)),

    [catalogDefinitions],

  );



  const registryCustomDefinitions = useMemo(

    () => catalogDefinitions.filter((definition) => isUserCreatedDefinition(definition)),

    [catalogDefinitions],

  );



  const mergedCustomDefinitions = useMemo(

    () => mergeCustomDefinitions(customServices, registryCustomDefinitions),

    [customServices, registryCustomDefinitions],

  );



  const legacyBuiltinServices = useMemo(

    () => definitionsToLegacyServices(builtinDefinitions),

    [builtinDefinitions],

  );



  const legacyCustomServices = useMemo(

    () => definitionsToLegacyServices(mergedCustomDefinitions),

    [mergedCustomDefinitions],

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
        const next: VaultState = { ...current, selectedIds: nextSelected };
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



  async function saveVaultState(state: VaultState) {

    await persistVault(state);

  }



  /** D-109-23 / D-109-26: drop prior user's in-memory workspace before loading another. */
  function clearWorkspaceMemory() {
    lockVault();
    setIsUnlocked(false);
    setVaultState(emptyVaultState());
    setHomeCredentialService(null);
    setCatalogDefinitions([]);
    setCatalogHydrated(false);
    setCatalogError(null);
    setCatalogLoading(false);
    setScreen('manage');
    setManageIsFirstRun(false);
    setPendingIds(new Set());
    setSelectionError(null);
    selectionLockRef.current = new Set();
    pruneInactiveRef.current = false;
    clearRegistryCatalogCache();
  }

  /** Vault lock and logout are the same path (AC-109-24): clear session + vault → Login. */
  async function handleLogout() {
    const email = accountProfile?.email ?? '';
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

  async function resolvePostAuthScreen(
    loaded: VaultState,
    profile: AppUserProfile,
  ): Promise<Screen> {
    const cloudCount = await countUserServices(profile.id);
    if (cloudCount != null) {
      return cloudCount > 0 ? 'dashboard' : 'manage';
    }
    return loaded.selectedIds.length > 0 ? 'dashboard' : 'manage';
  }

  /** Single door: clear prior workspace, unlock THIS userId's vault, hydrate cloud→local, then paint. */
  async function handleAuthenticated(profile: AppUserProfile, password: string) {
    clearWorkspaceMemory();
    try {
      const loaded = await unlockVault(password, profile.id);
      const vaultKey = getActiveVaultCryptoKey();
      const cloudCredKey = getCloudCredentialCryptoKey();
      if (!vaultKey || !cloudCredKey) {
        throw new Error('Vault key missing after unlock');
      }

      // Re-key cloud ciphertext under the deterministic cloud-cred key so Edge can decrypt.
      // Uses local Chrome credentials when present (legacy vault-key dual-write era).
      if (Object.keys(loaded.credentials).length > 0) {
        try {
          await syncVaultStateToSupabase(cloudCredKey, loaded, {
            expectedUserId: profile.id,
          });
        } catch (error) {
          if (isDevBuild()) {
            console.warn('[vault] cloud credential re-key failed:', error);
          }
        }
      }

      // D-109-24 / AC-109-38: cloud→local before Digital Home paint (Chrome↔Edge parity).
      const hydrated = await hydrateWorkspaceFromCloud(
        profile.id,
        [cloudCredKey, vaultKey],
        loaded,
      );
      // Persist into THIS browser's IndexedDB; upsert-only dual-write repairs cloud
      // without wiping ciphertext omitted from partial payloads (D-109-25).
      await persistVault(hydrated, { skipCloudSync: true });
      try {
        await syncVaultStateToSupabase(cloudCredKey, hydrated, {
          expectedUserId: profile.id,
        });
      } catch (error) {
        if (isDevBuild()) {
          console.warn('[vault] post-hydrate upsert-only sync failed:', error);
        }
      }

      setAccountProfile(profile);
      setAuthBootError(null);
      setLoginEmailPrefill(profile.email ?? '');
      setVaultState(hydrated);
      setIsUnlocked(true);

      const nextScreen = await resolvePostAuthScreen(hydrated, profile);

      if (nextScreen === 'dashboard') {
        setManageIsFirstRun(false);
        setScreen('dashboard');
      } else {
        setManageIsFirstRun(true);
        setScreen('manage');
      }
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
  // Remove: cloud user_services delete must succeed before UI success (D-113-29 / AC-113-51).
  async function changeSelection(id: string, mode: 'add' | 'remove') {
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

      const next =
        mode === 'add' ? addToSelection(vaultState, id) : removeFromSelection(vaultState, id);

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
          setSelectionError(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE);
          return;
        }
      }

      setVaultState(next);
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

  function addService(id: string): Promise<void> {
    return changeSelection(id, 'add');
  }

  function removeService(id: string): Promise<void> {
    return changeSelection(id, 'remove');
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

    // Explicit login entry only. Do not call Login Discovery (D-108-4 / D-108-7).
    try {
      await upsertCustomServiceRegistryRow(definition);
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
    const nextState: VaultState = {
      ...persistBase,
      customServices: [...persistBase.customServices, definition],
      selectedIds: [...new Set([...persistBase.selectedIds, definition.id])],
    };

    // Persist-first: only commit the tile after persistVault succeeds (AC-104-14, AC-104-15).
    try {
      await persistVault(nextState, { awaitCloudSync: true });
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
    clearRegistryCatalogCache();
    const refreshed = await loadBuiltinCatalogDefinitions();
    setRuntimeCategoryCatalog(await loadRegistryCategories());
    setCatalogDefinitions(refreshed);
    return { status: 'created' };
  }

  async function updateCustomService(definition: ServiceDefinition): Promise<void> {
    try {
      await upsertCustomServiceRegistryRow(definition);
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
    setVaultState(nextState);
    setSelectionError(null);
    clearRegistryCatalogCache();
    const refreshed = await loadBuiltinCatalogDefinitions();
    setRuntimeCategoryCatalog(await loadRegistryCategories());
    setCatalogDefinitions(refreshed);
  }


  async function handleVaultStateChange(state: VaultState) {

    setVaultState(state);

    await saveVaultState(state);

  }

  async function openHomeCredentialModal(service: Service) {
    if (!offersCredentialManagementPanel(service)) {
      return;
    }
    const entry = resolveCredentialEntry(service);
    if (entry.kind === 'form') {
      const ensured = ensureDefaultProfileForService(vaultState, service.id);
      if (ensured !== vaultState) {
        await handleVaultStateChange(ensured);
      }
    }
    setHomeCredentialService(service);
  }



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

  // Wait for the first catalog hydrate after unlock so Digital Home / Manage
  // never paint vault-only customs and then jump when builtins arrive.
  if (!catalogHydrated) {
    return (
      <div className="onboarding">
        <p>טוען קטלוג אתרים…</p>
      </div>
    );
  }

  async function retryCatalogLoad() {
    setCatalogLoading(true);
    setCatalogError(null);
    setCatalogHydrated(false);
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



  // Full-screen catalog error only when there is nothing to manage yet.
  // With existing selected services, Service Management stays usable and the
  // Discover section shows a friendly error inline (AC-104-10).
  if (catalogError && selectedIds.size === 0) {

    return (

      <div className="onboarding">

        <p>לא ניתן לטעון את קטלוג האתרים מהרשת.</p>

        <p>{catalogError}</p>

        <p className="onboarding-first-run-note">

          {catalogError.includes('Failed to fetch') ||
          catalogError.includes('issuer certificate') ||
          catalogError.includes('נדרשת התחברות')
            ? 'פתחי את הכתובת שמופיעה בטרמינל אחרי npm run dev (למשל http://localhost:5173/). עצרי שרתים ישנים, הפעילי npm run dev מחדש, נקי Application → Storage ל-localhost, רענני Ctrl+Shift+R ולחצי «נסי שוב».'
            : 'ודאי שמיגרציות Phase 109 הורצו ב-Supabase ושיש התחברות לחשבון פעיל. אפשר גם לנקות נתוני אתר ל-localhost (Application → Storage) ולנסות שוב.'}

        </p>

        <button type="button" className="finish-btn" onClick={() => void retryCatalogLoad()}>

          נסי שוב

        </button>

      </div>

    );

  }



  if (screen === 'dashboard') {

    return (

      <AppVaultShell>

        <ProfileResolution

          accessProfiles={vaultState.accessProfiles}

          serviceNameById={serviceNameById}

        >

          {(resolveProfile) => (
            <>
            <Dashboard

              services={selectedServices}

              credentials={credentials}

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

              onAddMore={() => {

                setManageIsFirstRun(false);

                setScreen('manage');

              }}

              onAddCredentials={(service) => {
                void openHomeCredentialModal(service);
              }}

            />

            {homeCredentialService ? (
              <DigitalHomeCredentialModal
                service={homeCredentialService}
                vaultState={vaultState}
                vaultUnlocked={isUnlocked}
                onLockVault={handleLockVault}
                onVaultStateChange={handleVaultStateChange}
                onClose={() => setHomeCredentialService(null)}
              />
            ) : null}
            </>
          )}

        </ProfileResolution>

      </AppVaultShell>

    );

  }



  return (

    <AppVaultShell>

      <ManageServices
        allServices={allServices}
        selectedIds={selectedIds}
        isFirstRun={manageIsFirstRun}
        vaultState={vaultState}
        pendingIds={pendingIds}
        selectionError={selectionError}
        catalogError={catalogError}
        onAddService={addService}
        onRemoveService={removeService}
        onAddCustom={(definition) => addCustomService(definition)}
        onUpdateCustom={(definition) => updateCustomService(definition)}
        onVaultStateChange={handleVaultStateChange}
        onRetryCatalog={() => void retryCatalogLoad()}
        onContinue={() => {
          void saveVaultState(vaultState);
          setShowMagicMomentHint(manageIsFirstRun);
          setScreen('dashboard');
        }}
        onLockVault={handleLockVault}
        vaultUnlocked={isUnlocked}
      />

    </AppVaultShell>

  );

}



export default App;

