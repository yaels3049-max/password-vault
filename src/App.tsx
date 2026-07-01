import { useEffect, useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import ManageServices from './ManageServices';
import UnlockScreen from './UnlockScreen';
import { definitionsToLegacyServices } from './catalog';
import { preloadServiceLogos } from './logoCache';
import { mockServices, HUB_PRACTICE_LOGIN_ID } from './mockServices';
import type { ServiceDefinition } from './service/serviceModel';
import { credentialsByServiceId } from './vault/credentialAccess';
import { persistVault, unlockVault, type VaultState } from './vault/vault';
import { ProfileResolution } from './profile';
import './App.css';

type Screen = 'manage' | 'dashboard';

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>('manage');
  const [manageIsFirstRun, setManageIsFirstRun] = useState(false);
  const [showMagicMomentHint, setShowMagicMomentHint] = useState(false);
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

  const legacyCustomServices = definitionsToLegacyServices(customServices);
  const allServices = [...mockServices, ...legacyCustomServices];
  const selectedServices = allServices.filter((s) => selectedIds.has(s.id));
  const serviceNameById = useMemo(() => {
    const names: Record<string, string> = {};
    for (const service of selectedServices) {
      names[service.id] = service.name;
    }
    return names;
  }, [selectedServices]);

  useEffect(() => {
    preloadServiceLogos(selectedServices);
  }, [selectedServices]);

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
      const initialIds = [HUB_PRACTICE_LOGIN_ID];
      const nextState: VaultState = {
        ...loaded,
        selectedIds: initialIds,
      };
      setVaultState(nextState);
      setManageIsFirstRun(true);
      setScreen('manage');
      void saveVaultState(nextState);
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

  function addCustomService(definition: ServiceDefinition) {
    const nextState: VaultState = {
      ...vaultState,
      customServices: [...customServices, definition],
      selectedIds: [...new Set([...selectedIds, definition.id])],
    };
    setVaultState(nextState);
    void saveVaultState(nextState);
  }

  async function handleVaultStateChange(state: VaultState) {
    setVaultState(state);
    await saveVaultState(state);
  }

  if (!isUnlocked) {
    return <UnlockScreen onUnlock={handleUnlock} />;
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
      onAddCustom={addCustomService}
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
