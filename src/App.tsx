import { useEffect, useMemo, useState } from 'react';

import Dashboard from './Dashboard';

import ManageServices from './ManageServices';

import UnlockScreen from './UnlockScreen';

import { definitionsToLegacyServices, loadBuiltinCatalogDefinitions } from './catalog';

import { isDevBuild } from './dev/devMode';

import { preloadServiceLogos } from './logoCache';

import { HUB_PRACTICE_LOGIN_ID, setRuntimeBuiltinServices } from './mockServices';

import { clearRegistryCatalogCache } from './registry/registryLoader';

import type { ServiceDefinition } from './service/serviceModel';

import { formatErrorChain } from './formatErrorChain';

import { resetSupabaseAuthSession } from './supabase/auth';

import { upsertCustomServiceRegistryRow } from './supabase/registryPersistence';

import { credentialsByServiceId } from './vault/credentialAccess';

import { persistVault, unlockVault, type VaultState } from './vault/vault';

import { ProfileResolution } from './profile';

import './App.css';



type Screen = 'manage' | 'dashboard';



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



  function toggleService(id: string) {

    const nextIds = new Set(selectedIds);

    if (nextIds.has(id)) {

      nextIds.delete(id);

    } else {

      nextIds.add(id);

    }

    const nextState: VaultState = {

      ...vaultState,

      selectedIds: [...nextIds],

    };

    setVaultState(nextState);

    void saveVaultState(nextState);

  }



  async function addCustomService(definition: ServiceDefinition) {

    const nextState: VaultState = {

      ...vaultState,

      customServices: [...customServices, definition],

      selectedIds: [...new Set([...selectedIds, definition.id])],

    };

    setVaultState(nextState);

    await saveVaultState(nextState);



    try {

      await upsertCustomServiceRegistryRow(definition);

      clearRegistryCatalogCache();

      const refreshed = await loadBuiltinCatalogDefinitions();

      setCatalogDefinitions(refreshed);

    } catch (error) {

      if (import.meta.env.DEV) {

        console.warn('[vault] Custom service registry upsert failed:', error);

      }

    }

  }



  async function handleVaultStateChange(state: VaultState) {

    setVaultState(state);

    await saveVaultState(state);

  }



  if (!isUnlocked) {

    return <UnlockScreen onUnlock={handleUnlock} />;

  }



  if (catalogLoading) {

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

      setCatalogDefinitions(definitions);

    } catch (error) {

      setCatalogError(formatErrorChain(error));

    } finally {

      setCatalogLoading(false);

    }

  }



  if (catalogError) {

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

            onAddMore={() => {

              setManageIsFirstRun(false);

              setScreen('manage');

            }}

          />

        )}

      </ProfileResolution>

    );

  }



  return (

    <ManageServices

      allServices={allServices}

      selectedIds={selectedIds}

      isFirstRun={manageIsFirstRun}

      vaultState={vaultState}

      onToggle={toggleService}

      onAddCustom={(definition) => {

        void addCustomService(definition);

      }}

      onVaultStateChange={handleVaultStateChange}

      onContinue={() => {

        void saveVaultState(vaultState);

        setShowMagicMomentHint(manageIsFirstRun);

        setScreen('dashboard');

      }}

    />

  );

}



export default App;

