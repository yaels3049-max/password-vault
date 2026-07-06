import { useState } from 'react';
import AddSiteModal from './AddSiteModal';
import ServiceProfileManagementModal from './ServiceProfileManagementModal';
import { createCustomServiceDefinition, discoverLoginForCustomService } from './catalog';
import { isDevBuild } from './dev/devMode';
import {
  categories,
  categoryLabels,
  categoryQuestions,
  getLoginFields,
  type Service,
  type ServiceCategory,
} from './mockServices';
import type { Credential } from './credentials';
import type { ServiceDefinition } from './service/serviceModel';
import type { VaultState } from './vault/vault';
import {
  addAccessProfile,
  deleteAccessProfile,
  deleteCredentialForProfile,
  ensureDefaultProfileForService,
  getProfilesForService,
  ProfileManagementError,
  renameAccessProfile,
  saveCredentialForProfile,
  setDefaultAccessProfile,
} from './vault/profileManagement';

interface ManageServicesProps {
  allServices: Service[];
  selectedIds: Set<string>;
  isFirstRun: boolean;
  vaultState: VaultState;
  onToggle: (id: string) => void;
  onAddCustom: (definition: ServiceDefinition) => void;
  onVaultStateChange: (state: VaultState) => Promise<void>;
  onContinue: () => void;
}

export default function ManageServices({
  allServices,
  selectedIds,
  isFirstRun,
  vaultState,
  onToggle,
  onAddCustom,
  onVaultStateChange,
  onContinue,
}: ManageServicesProps) {
  const [modalCategory, setModalCategory] = useState<ServiceCategory | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [discoveryOutcome, setDiscoveryOutcome] = useState<'success' | 'failure' | null>(
    null,
  );
  const [managingService, setManagingService] = useState<Service | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  function openAddModal(category: ServiceCategory) {
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
    setModalCategory(category);
  }

  function dismissAddModal() {
    setModalCategory(null);
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
  }

  function closeAddModal() {
    if (isDiscovering) {
      return;
    }

    dismissAddModal();
  }

  async function handleAddCustomSite(displayName: string, primaryUrl: string) {
    if (!modalCategory || isDiscovering) return;

    try {
      const definition = createCustomServiceDefinition({
        displayName,
        primaryUrl,
        category: modalCategory,
      });

      setAddError(null);
      setDiscoveryMessage(null);
      setDiscoveryOutcome(null);
      setIsDiscovering(true);

      const { definition: finalDefinition, outcome } =
        await discoverLoginForCustomService(definition, { primaryUrl });

      onAddCustom(finalDefinition);
      setDiscoveryMessage(outcome.message);
      setDiscoveryOutcome(outcome.status);
      setIsDiscovering(false);

      window.setTimeout(() => {
        dismissAddModal();
      }, 1800);
    } catch (error) {
      setIsDiscovering(false);
      setAddError(error instanceof Error ? error.message : 'לא ניתן להוסיף את האתר');
    }
  }

  async function applyVaultUpdate(updater: (state: VaultState) => VaultState) {
    try {
      setProfileError(null);
      const nextState = updater(vaultState);
      await onVaultStateChange(nextState);
    } catch (error) {
      if (error instanceof ProfileManagementError) {
        setProfileError(toHebrewProfileError(error.message));
        return;
      }
      setProfileError(error instanceof Error ? error.message : 'שגיאה בלתי צפויה');
    }
  }

  async function openProfileManagement(service: Service) {
    setProfileError(null);
    const ensured = ensureDefaultProfileForService(vaultState, service.id);
    if (ensured !== vaultState) {
      await onVaultStateChange(ensured);
    }
    setManagingService(service);
  }

  function closeProfileManagement() {
    setManagingService(null);
    setProfileError(null);
  }

  const selectedCount = selectedIds.size;
  const managingProfiles = managingService
    ? getProfilesForService(vaultState, managingService.id)
    : [];

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        {isFirstRun ? (
          <>
            <h1>בואו נתחיל עם שירות אחד</h1>
            <p>
              בחרו שירות אחד להתחלה — מספיק לבחור מאחת הקטגוריות למטה.
              אפשר להוסיף עוד שירותים בכל עת מהלוח הבקרה.
            </p>
          </>
        ) : (
          <>
            <h1>ניהול השירותים שלי</h1>
            <p>בחרו את השירותים שאתם משתמשים בהם והגדירו פרופילים ופרטי כניסה</p>
          </>
        )}
      </header>

      {isFirstRun && isDevBuild() && (
        <p className="onboarding-first-run-note">
          אין צורך לבחור מכל הקטגוריות. שירות אחד מספיק כדי להתחיל.
          <strong> תרגול התחברות</strong> כבר נבחר — אפשר להמשיך או לבחור שירות אחר.
          לאחר הבחירה, לחצו <strong>פרופילים ופרטי כניסה</strong> כדי לשמור פרטי כניסה.
        </p>
      )}

      {isFirstRun && !isDevBuild() && (
        <p className="onboarding-first-run-note">
          בחרו שירות אחד לפחות מהרשימה למטה. לאחר הבחירה, לחצו{' '}
          <strong>פרופילים ופרטי כניסה</strong> כדי לשמור פרטי כניסה.
        </p>
      )}

      {categories.map((category) => {
        const services = allServices.filter((s) => s.category === category);

        return (
          <section key={category} className="category-card">
            <h2>{categoryLabels[category]}</h2>
            <p className="category-question">{categoryQuestions[category]}</p>
            <ul className="checkbox-list">
              {services.map((service) => (
                <li key={service.id} className="manage-service-row">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(service.id)}
                      onChange={() => onToggle(service.id)}
                    />
                    <span>{service.name}</span>
                  </label>
                  {selectedIds.has(service.id) && (
                    <button
                      type="button"
                      className="manage-profiles-btn"
                      onClick={() => void openProfileManagement(service)}
                    >
                      פרופילים ופרטי כניסה
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {category !== 'practice' && (
              <button
                type="button"
                className="add-custom-btn"
                onClick={() => openAddModal(category)}
              >
                ➕ הוסף אתר משלי
              </button>
            )}
          </section>
        );
      })}

      <footer className="onboarding-footer">
        {isFirstRun && selectedCount === 1 && (
          <p className="onboarding-footer-hint">נבחר שירות אחד — אפשר להמשיך.</p>
        )}
        {isFirstRun && selectedCount > 1 && (
          <p className="onboarding-footer-hint">
            נבחרו {selectedCount} שירותים — אפשר להמשיך או להוסיף עוד מאוחר יותר.
          </p>
        )}
        <button type="button" className="finish-btn" onClick={onContinue}>
          המשך
        </button>
      </footer>

      {modalCategory && (
        <AddSiteModal
          onAdd={handleAddCustomSite}
          onCancel={closeAddModal}
          error={addError}
          isDiscovering={isDiscovering}
          discoveryMessage={discoveryMessage}
          discoveryOutcome={discoveryOutcome}
        />
      )}

      {managingService && (
        <ServiceProfileManagementModal
          service={managingService}
          loginFields={getLoginFields(managingService)}
          profiles={managingProfiles}
          credentials={vaultState.credentials}
          error={profileError}
          onClose={closeProfileManagement}
          onAddProfile={(displayName) =>
            void applyVaultUpdate((state) => addAccessProfile(state, managingService.id, displayName))
          }
          onRenameProfile={(profileId, displayName) =>
            void applyVaultUpdate((state) =>
              renameAccessProfile(state, profileId, displayName),
            )
          }
          onSetDefaultProfile={(profileId) =>
            void applyVaultUpdate((state) => setDefaultAccessProfile(state, profileId))
          }
          onDeleteProfile={(profileId) =>
            void applyVaultUpdate((state) => deleteAccessProfile(state, profileId))
          }
          onSaveCredential={(profileId, credential: Credential) =>
            void applyVaultUpdate((state) =>
              saveCredentialForProfile(state, profileId, credential),
            )
          }
          onDeleteCredential={(profileId) =>
            void applyVaultUpdate((state) => deleteCredentialForProfile(state, profileId))
          }
        />
      )}
    </div>
  );
}

function toHebrewProfileError(message: string): string {
  if (message === 'Profile display name is required') {
    return 'יש להזין שם פרופיל';
  }
  if (message === 'Profile not found') {
    return 'הפרופיל לא נמצא';
  }
  if (message === 'Cannot delete the last profile for a service') {
    return 'לא ניתן למחוק את הפרופיל האחרון לשירות';
  }
  return message;
}
