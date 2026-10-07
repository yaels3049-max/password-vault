import { useState } from 'react';
import type { Credential } from '../credentials';
import type { Service } from '../mockServices';
import ServiceProfileManagementModal from '../ServiceProfileManagementModal';
import {
  addProfileWithCredential,
  type ProfileManagementRequest,
} from '../digitalHome/appContext';
import {
  bumpDualWriteGeneration,
  deleteAccessProfileFromCloud,
  deleteCloudEncryptedCredentialByLocalProfileId,
  PROFILE_DELETE_UNCONFIRMED,
} from '../supabase/persistence';
import { outboxOf } from '../vault/syncOutbox';
import { offersCredentialManagementPanel } from '../service/credentialSchema';
import {
  deleteAccessProfile,
  deleteCredentialForProfile,
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
  if (message === 'Choose a new default profile') {
    return 'יש לבחור פרופיל ברירת מחדל חדש לפני המחיקה';
  }
  if (/marked default; exactly one is required/.test(message)) {
    return 'מצב הפרופילים תוקן. סגרו את החלון, פתחו שוב ונסו להוסיף פרופיל.';
  }
  return message;
}

interface DigitalHomeCredentialModalProps {
  service: Service;
  request: Omit<ProfileManagementRequest, 'serviceId'>;
  vaultState: VaultState;
  vaultUnlocked?: boolean;
  onLockVault?: () => void;
  onVaultStateChange: (state: VaultState) => Promise<void>;
  onClose: () => void;
}

/**
 * AD-123-3 — the one profile-management host for the user app. Reuses
 * ServiceProfileManagementModal; writes only through profileManagement reducers + the caller's
 * persist, and the existing cloud delete functions.
 */
export default function DigitalHomeCredentialModal({
  service,
  request,
  vaultState,
  vaultUnlocked = true,
  onLockVault,
  onVaultStateChange,
  onClose,
}: DigitalHomeCredentialModalProps) {
  const [profileError, setProfileError] = useState<string | null>(null);

  if (!offersCredentialManagementPanel(service)) {
    return null;
  }

  function toFriendly(error: unknown): string {
    return error instanceof ProfileManagementError
      ? toHebrewProfileError(error.message)
      : toFriendlySecurityError(error);
  }

  async function applyVaultUpdate(updater: (state: VaultState) => VaultState) {
    try {
      setProfileError(null);
      const nextState = updater(vaultState);
      await onVaultStateChange(nextState);
    } catch (error) {
      const friendly = toFriendly(error);
      setProfileError(friendly);
      throw new Error(friendly);
    }
  }

  const profiles = getProfilesForService(vaultState, service.id);

  return (
    <ServiceProfileManagementModal
      key={`${service.id}:${request.mode}:${request.profileId ?? ''}`}
      service={service}
      profiles={profiles}
      credentials={vaultState.credentials}
      error={profileError}
      vaultUnlocked={vaultUnlocked}
      onLockVault={onLockVault}
      onClose={onClose}
      initialProfileId={request.profileId ?? null}
      initialMode={request.mode}
      onCreateProfile={async (displayName, credential) => {
        let createdId = '';
        await applyVaultUpdate((state) => {
          const created = addProfileWithCredential(state, service.id, displayName, credential);
          createdId = created.profileId;
          return created.state;
        });
        return createdId;
      }}
      onRenameProfile={(profileId, displayName) =>
        void applyVaultUpdate((state) => renameAccessProfile(state, profileId, displayName))
      }
      onSetDefaultProfile={(profileId) =>
        void applyVaultUpdate((state) => setDefaultAccessProfile(state, profileId))
      }
      onDeleteProfile={async (profileId, replacementDefaultId) => {
        setProfileError(null);
        // Fail-closed: an invalid local delete must not reach the cloud first.
        try {
          deleteAccessProfile(vaultState, profileId, replacementDefaultId);
        } catch (error) {
          const friendly = toFriendly(error);
          setProfileError(friendly);
          throw new Error(friendly);
        }
        // O-123-17: only a profile still waiting for its first cloud insert may have no row to remove.
        const neverInCloud = outboxOf(vaultState).profileIds.includes(profileId);
        try {
          // AD-123-18 (4): an in-flight background save must not write the row back.
          bumpDualWriteGeneration();
          await deleteAccessProfileFromCloud(profileId);
        } catch (error) {
          const noRow = (error as { code?: unknown } | null)?.code === PROFILE_DELETE_UNCONFIRMED;
          if (!(noRow && neverInCloud)) {
            if (import.meta.env.DEV) {
              console.warn('[vault] cloud delete-profile failed:', error);
            }
            setProfileError(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);
            throw new Error(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);
          }
        }
        await applyVaultUpdate((state) =>
          deleteAccessProfile(state, profileId, replacementDefaultId),
        );
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
