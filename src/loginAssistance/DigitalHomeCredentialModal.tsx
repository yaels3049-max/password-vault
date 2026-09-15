import { useEffect, useRef, useState } from 'react';
import type { Credential } from '../credentials';
import type { Service } from '../mockServices';
import ServiceProfileManagementModal from '../ServiceProfileManagementModal';
import {
  deleteAccessProfileFromCloud,
  deleteCloudEncryptedCredentialByLocalProfileId,
} from '../supabase/persistence';
import {
  offersCredentialManagementPanel,
  resolveCredentialEntry,
} from '../service/credentialSchema';
import {
  addAccessProfile,
  deleteAccessProfile,
  deleteCredentialForProfile,
  ensureDefaultProfileForService,
  getProfilesForService,
  ProfileManagementError,
  PROFILE_DELETE_CLOUD_FAILED_MESSAGE,
  renameAccessProfile,
  saveCredentialForProfile,
  setDefaultAccessProfile,
} from '../vault/profileManagement';
import { toFriendlySecurityError } from '../trust';
import type { VaultState } from '../vault/vault';

function toHebrewProfileError(message: string): string {
  if (message === 'Profile display name is required') {
    return 'יש להזין שם פרופיל';
  }
  if (message === 'Profile not found') {
    return 'הפרופיל לא נמצא';
  }
  if (message === 'Cannot delete the last profile for a service') {
    return 'לא ניתן למחוק את הפרופיל האחרון לאתר';
  }
  if (/marked default; exactly one is required/.test(message)) {
    return 'מצב הפרופילים תוקן. סגרו את החלון, פתחו שוב ונסו להוסיף פרופיל.';
  }
  return message;
}

interface DigitalHomeCredentialModalProps {
  service: Service;
  vaultState: VaultState;
  vaultUnlocked?: boolean;
  onLockVault?: () => void;
  onVaultStateChange: (state: VaultState) => Promise<void>;
  onClose: () => void;
}

/** Reuses ServiceProfileManagementModal — no new credential editor. */
export default function DigitalHomeCredentialModal({
  service,
  vaultState,
  vaultUnlocked = true,
  onLockVault,
  onVaultStateChange,
  onClose,
}: DigitalHomeCredentialModalProps) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const ensuredServiceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (ensuredServiceIdRef.current === service.id) {
      return;
    }
    if (!offersCredentialManagementPanel(service)) {
      return;
    }
    const entry = resolveCredentialEntry(service);
    if (entry.kind !== 'form') {
      return;
    }
    ensuredServiceIdRef.current = service.id;
    const ensured = ensureDefaultProfileForService(vaultState, service.id);
    if (ensured !== vaultState) {
      void onVaultStateChange(ensured);
    }
  }, [service, vaultState, onVaultStateChange]);

  if (!offersCredentialManagementPanel(service)) {
    return null;
  }

  async function applyVaultUpdate(updater: (state: VaultState) => VaultState) {
    try {
      setProfileError(null);
      const nextState = updater(vaultState);
      await onVaultStateChange(nextState);
    } catch (error) {
      if (error instanceof ProfileManagementError) {
        const friendly = toHebrewProfileError(error.message);
        setProfileError(friendly);
        throw new Error(friendly);
      }
      const friendly = toFriendlySecurityError(error);
      setProfileError(friendly);
      throw new Error(friendly);
    }
  }

  const profiles = getProfilesForService(vaultState, service.id);

  return (
    <ServiceProfileManagementModal
      service={service}
      profiles={profiles}
      credentials={vaultState.credentials}
      error={profileError}
      vaultUnlocked={vaultUnlocked}
      onLockVault={onLockVault}
      onClose={onClose}
      onAddProfile={(displayName) =>
        void applyVaultUpdate((state) => addAccessProfile(state, service.id, displayName))
      }
      onRenameProfile={(profileId, displayName) =>
        void applyVaultUpdate((state) => renameAccessProfile(state, profileId, displayName))
      }
      onSetDefaultProfile={(profileId) =>
        void applyVaultUpdate((state) => setDefaultAccessProfile(state, profileId))
      }
      onDeleteProfile={async (profileId) => {
        try {
          await deleteAccessProfileFromCloud(profileId);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[vault] cloud delete-profile failed:', error);
          }
          setProfileError(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);
          throw new Error(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);
        }
        await applyVaultUpdate((state) => deleteAccessProfile(state, profileId));
      }}
      onSaveCredential={(profileId, credential: Credential) =>
        applyVaultUpdate((state) => saveCredentialForProfile(state, profileId, credential))
      }
      onDeleteCredential={async (profileId) => {
        await applyVaultUpdate((state) => deleteCredentialForProfile(state, profileId));
        try {
          await deleteCloudEncryptedCredentialByLocalProfileId(profileId);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[vault] cloud credential delete failed:', error);
          }
        }
      }}
    />
  );
}
