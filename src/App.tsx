import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import ManageServices from './ManageServices';
import UnlockScreen from './UnlockScreen';
import { preloadServiceLogos } from './logoCache';
import { mockServices, type Service } from './mockServices';
import type { Credential } from './credentials';
import { persistVault, unlockVault, type VaultState } from './vault/vault';
import './App.css';

type Screen = 'manage' | 'dashboard';

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>('manage');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [credentials, setCredentials] = useState<Record<string, Credential>>({});

  const allServices = [...mockServices, ...customServices];
  const selectedServices = allServices.filter((s) => selectedIds.has(s.id));

  useEffect(() => {
    preloadServiceLogos(selectedServices);
  }, [selectedServices]);

  async function saveVaultState(state: VaultState) {
    await persistVault(state);
  }

  function buildVaultState(
    creds: Record<string, Credential>,
    ids: Set<string>,
    customs: Service[],
  ): VaultState {
    return {
      credentials: creds,
      selectedIds: [...ids],
      customServices: customs,
    };
  }

  async function handleUnlock(password: string) {
    const loaded = await unlockVault(password);
    setCredentials(loaded.credentials);
    setSelectedIds(new Set(loaded.selectedIds));
    setCustomServices(loaded.customServices);
    setIsUnlocked(true);
    setScreen(loaded.selectedIds.length > 0 ? 'dashboard' : 'manage');
  }

  function toggleService(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    void saveVaultState(buildVaultState(credentials, next, customServices));
  }

  function addCustomService(service: Service) {
    const nextCustom = [...customServices, service];
    const nextIds = new Set([...selectedIds, service.id]);
    setCustomServices(nextCustom);
    setSelectedIds(nextIds);
    void saveVaultState(buildVaultState(credentials, nextIds, nextCustom));
  }

  async function saveCredential(serviceId: string, credential: Credential) {
    const updated = { ...credentials, [serviceId]: credential };
    setCredentials(updated);
    await saveVaultState(buildVaultState(updated, selectedIds, customServices));
  }

  async function deleteCredential(serviceId: string) {
    const updated = { ...credentials };
    delete updated[serviceId];
    setCredentials(updated);
    await saveVaultState(buildVaultState(updated, selectedIds, customServices));
  }

  if (!isUnlocked) {
    return <UnlockScreen onUnlock={handleUnlock} />;
  }

  if (screen === 'dashboard') {
    return (
      <Dashboard
        services={selectedServices}
        credentials={credentials}
        onSaveCredential={saveCredential}
        onDeleteCredential={deleteCredential}
        onAddMore={() => setScreen('manage')}
      />
    );
  }

  return (
    <ManageServices
      allServices={allServices}
      selectedIds={selectedIds}
      onToggle={toggleService}
      onAddCustom={addCustomService}
      onContinue={() => setScreen('dashboard')}
    />
  );
}

export default App;
