import { useEffect, useMemo, useRef, useState } from 'react';

import Dashboard from './Dashboard';

import ManageServices from './ManageServices';

import UnlockScreen from './UnlockScreen';

import { definitionsToLegacyServices, loadBuiltinCatalogDefinitions } from './catalog';

import { isDevBuild } from './dev/devMode';

import { preloadServiceLogos } from './logoCache';

import { HUB_PRACTICE_LOGIN_ID, setRuntimeBuiltinServices, setRuntimeCategoryCatalog } from './mockServices';

import { clearRegistryCatalogCache } from './registry/registryLoader';
import { loadRegistryCategories } from './registry/categoryCatalog';

import type { ServiceDefinition } from './service/serviceModel';

import { formatErrorChain } from './formatErrorChain';

import { resetSupabaseAuthSession } from './supabase/auth';

import {
  deleteCustomServiceRegistryRow,
  DuplicateCustomServiceError,
  normalizeCustomServiceUrl,
  upsertCustomServiceRegistryRow,
} from './supabase/registryPersistence';

import { credentialsByServiceId } from './vault/credentialAccess';

import {
  addToSelection,
  removeFromSelection,
  SELECTION_PERSIST_FAILED_MESSAGE,
  shouldForcePersistFailure,
} from './serviceManagement/serviceSelection';

import { lockVault, persistVault, unlockVault, type VaultState } from './vault/vault';

import { ProfileResolution } from './profile';

import { AppVaultShell } from './trust';

import './App.css';

// Phase 107: Admin console at #/admin — gated shell mounts from main.tsx (AdminGate).
export { isAdminRoute, ADMIN_ROUTE_HASH } from './admin/adminRoutes';



type Screen = 'manage' | 'dashboard';

const CUSTOM_SERVICE_CLOUD_FAIL_MESSAGE =
  'לא ניתן להוסיף את האתר כרגע. בדקו חיבור לרשת ונסו שוב.';

const CUSTOM_SERVICE_DUPLICATE_MESSAGE =
  'האתר כבר קיים ברשימת השירותים שלך.';



function isUserCreatedDefinition(definition: ServiceDefinition): boolean {

  return definition.source === 'user-created';

}



function mergeCustomDefinitions(

  vaultCustom: ServiceDefinition[],

  registryCustom: ServiceDefinition[],

): ServiceDefinition[] {

  const byId = new Map<string, ServiceDefinition>();



  for (const definition of vaultCustom) {

    byId.set(definition.id, definition);

  }



  for (const definition of registryCustom) {

    byId.set(definition.id, definition);

  }



  return [...byId.values()];

}



function App() {

  const [isUnlocked, setIsUnlocked] = useState(false);

  const [screen, setScreen] = useState<Screen>('manage');

  const [manageIsFirstRun, setManageIsFirstRun] = useState(false);

  const [showMagicMomentHint, setShowMagicMomentHint] = useState(false);

  const [catalogDefinitions, setCatalogDefinitions] = useState<ServiceDefinition[]>([]);

  const [catalogLoading, setCatalogLoading] = useState(false);

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [vaultState, setVaultState] = useState<VaultState>({

    credentials: {},

    accessProfiles: [],

    selectedIds: [],

    customServices: [],

  });



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

    () => [...legacyBuiltinServices, ...legacyCustomServices],

    [legacyBuiltinServices, legacyCustomServices],

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



  useEffect(() => {

    if (!isUnlocked) {

      return;

    }



    let cancelled = false;

    setCatalogLoading(true);

    setCatalogError(null);



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

        }

      });



    return () => {

      cancelled = true;

    };

  }, [isUnlocked]);



  async function saveVaultState(state: VaultState) {

    await persistVault(state);

  }



  function handleLockVault() {
    lockVault();
    setIsUnlocked(false);
  }

  async function handleUnlock(password: string) {

    const loaded = await unlockVault(password);

    setVaultState(loaded);

    setIsUnlocked(true);

    if (loaded.selectedIds.length > 0) {

      setManageIsFirstRun(false);

      setScreen('dashboard');

    } else {

      if (isDevBuild()) {

        const initialIds = [HUB_PRACTICE_LOGIN_ID];

        const nextState: VaultState = {

          ...loaded,

          selectedIds: initialIds,

        };

        setVaultState(nextState);

        setManageIsFirstRun(true);

        setScreen('manage');

        void saveVaultState(nextState);

      } else {

        setManageIsFirstRun(true);

        setScreen('manage');

      }

    }

  }



  async function persistSelectionState(next: VaultState) {
    if (shouldForcePersistFailure()) {
      throw new Error('Forced persist failure (Phase 104 test hook)');
    }
    await saveVaultState(next);
  }

  // Idempotent, persist-first selection change (D-104-4, D-104-5, D-104-14).
  // Digital Home reflects the change only after persistVault succeeds (AC-104-15).
  async function changeSelection(id: string, mode: 'add' | 'remove') {
    if (selectionLockRef.current.has(id)) {
      return;
    }
    selectionLockRef.current.add(id);
    setPendingIds((prev) => new Set(prev).add(id));
    setSelectionError(null);

    const next =
      mode === 'add' ? addToSelection(vaultState, id) : removeFromSelection(vaultState, id);

    try {
      await persistSelectionState(next);
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



  async function addCustomService(definition: ServiceDefinition) {
    // Local idempotency: reject a second tile for the same normalized primary URL.
    const normalizedUrl = normalizeCustomServiceUrl(definition.url);
    const alreadyExistsLocally = customServices.some(
      (existing) => normalizeCustomServiceUrl(existing.url) === normalizedUrl,
    );
    if (alreadyExistsLocally) {
      throw new Error(CUSTOM_SERVICE_DUPLICATE_MESSAGE);
    }

    // Cloud-first: do not create a local tile unless service_registry write succeeds.
    try {
      await upsertCustomServiceRegistryRow(definition);
    } catch (error) {
      if (error instanceof DuplicateCustomServiceError) {
        throw new Error(CUSTOM_SERVICE_DUPLICATE_MESSAGE);
      }
      if (import.meta.env.DEV) {
        console.warn('[vault] Custom service registry upsert failed:', error);
      }
      throw new Error(CUSTOM_SERVICE_CLOUD_FAIL_MESSAGE);
    }

    const nextState: VaultState = {
      ...vaultState,
      customServices: [...customServices, definition],
      selectedIds: [...new Set([...selectedIds, definition.id])],
    };

    // Persist-first: only commit the tile after persistVault succeeds (AC-104-14, AC-104-15).
    try {
      await saveVaultState(nextState);
    } catch (error) {
      // Best-effort rollback to avoid a registry row without a tile.
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

  }



  async function handleVaultStateChange(state: VaultState) {

    setVaultState(state);

    await saveVaultState(state);

  }



  if (!isUnlocked) {

    return <UnlockScreen onUnlock={handleUnlock} />;

  }



  // Soft loading: with an unlocked empty selection, still allow Digital Home shells
  // (AC-105-13). Only block the whole app before unlock completes catalog for first paint.
  if (catalogLoading && !isUnlocked) {

    return (

      <div className="onboarding">

        <p>טוען קטלוג שירותים…</p>

      </div>

    );

  }



  async function retryCatalogLoad() {

    setCatalogLoading(true);

    setCatalogError(null);

    await resetSupabaseAuthSession();

    clearRegistryCatalogCache();

    try {

      const definitions = await loadBuiltinCatalogDefinitions();
      setRuntimeCategoryCatalog(await loadRegistryCategories());
      setCatalogDefinitions(definitions);

    } catch (error) {

      setCatalogError(formatErrorChain(error));

    } finally {

      setCatalogLoading(false);

    }

  }



  // Full-screen catalog error only when there is nothing to manage yet.
  // With existing selected services, Service Management stays usable and the
  // Discover section shows a friendly error inline (AC-104-10).
  if (catalogError && selectedIds.size === 0) {

    return (

      <div className="onboarding">

        <p>לא ניתן לטעון את קטלוג השירותים מהרשת.</p>

        <p>{catalogError}</p>

        <p className="onboarding-first-run-note">

          {catalogError.includes('Failed to fetch') ||
          catalogError.includes('issuer certificate') ||
          catalogError.includes('anonymous auth failed')
            ? 'פתחי את הכתובת שמופיעה בטרמינל אחרי npm run dev (למשל http://localhost:5173/). עצרי שרתים ישנים, הפעילי npm run dev מחדש, נקי Application → Storage ל-localhost, רענני Ctrl+Shift+R ולחצי «נסי שוב».'
            : 'ודאי שמיגרציות Phase 102 הורצו ב-Supabase וש-Anonymous sign-in מופעל. אפשר גם לנקות נתוני אתר ל-localhost (Application → Storage) ולנסות שוב.'}

        </p>

        <button type="button" className="finish-btn" onClick={() => void retryCatalogLoad()}>

          נסי שוב

        </button>

      </div>

    );

  }



  if (screen === 'dashboard') {

    return (

      <AppVaultShell vaultUnlocked={isUnlocked} onLockVault={handleLockVault}>

        <ProfileResolution

          accessProfiles={vaultState.accessProfiles}

          serviceNameById={serviceNameById}

        >

          {(resolveProfile) => (

            <Dashboard

              services={selectedServices}

              credentials={credentials}

              credentialsByProfileId={vaultState.credentials}

              resolveProfile={resolveProfile}

              showMagicMomentHint={showMagicMomentHint}

              onDismissMagicMomentHint={() => setShowMagicMomentHint(false)}

              catalogLoading={catalogLoading}

              catalogError={catalogError}

              onAddMore={() => {

                setManageIsFirstRun(false);

                setScreen('manage');

              }}

            />

          )}

        </ProfileResolution>

      </AppVaultShell>

    );

  }



  return (

    <AppVaultShell vaultUnlocked={isUnlocked} onLockVault={handleLockVault}>

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

