import { useMemo, useRef, useState } from 'react';
import AddSiteModal from './AddSiteModal';
import ServiceProfileManagementModal from './ServiceProfileManagementModal';
import ServiceCard from './components/ServiceCard';
import { createCustomServiceDefinition, discoverLoginForCustomService } from './catalog';
import {
  categories,
  categoryLabels,
  getLoginFields,
  type Service,
  type ServiceCategory,
} from './mockServices';
import type { Credential } from './credentials';
import type { ServiceDefinition } from './service/serviceModel';
import type { VaultState } from './vault/vault';
import { useServiceLogos } from './useServiceLogos';
import { deriveServiceManagementState } from './serviceManagement/serviceManagementState';
import { filterDiscoveryServices } from './serviceManagement/discoveryFilter';
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
import { toFriendlySecurityError } from './trust';

interface ManageServicesProps {
  allServices: Service[];
  selectedIds: Set<string>;
  isFirstRun: boolean;
  vaultState: VaultState;
  pendingIds: Set<string>;
  selectionError: string | null;
  catalogError: string | null;
  onAddService: (id: string) => Promise<void>;
  onRemoveService: (id: string) => Promise<void>;
  onAddCustom: (definition: ServiceDefinition) => Promise<void>;
  onVaultStateChange: (state: VaultState) => Promise<void>;
  onRetryCatalog: () => void;
  onContinue: () => void;
  onLockVault?: () => void;
  vaultUnlocked?: boolean;
}

const CUSTOM_ADD_CATEGORIES: ServiceCategory[] = categories.filter(
  (category) => category !== 'practice',
);

export default function ManageServices({
  allServices,
  selectedIds,
  isFirstRun,
  vaultState,
  pendingIds,
  selectionError,
  catalogError,
  onAddService,
  onRemoveService,
  onAddCustom,
  onVaultStateChange,
  onRetryCatalog,
  onContinue,
  onLockVault,
  vaultUnlocked = true,
}: ManageServicesProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [discoveryOutcome, setDiscoveryOutcome] = useState<'success' | 'failure' | null>(
    null,
  );
  const [managingService, setManagingService] = useState<Service | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | null>(null);
  // Which selected-row secondary (kebab) menu is open, if any.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Synchronous in-flight lock: guards custom-add against rapid double-submits.
  const addInFlightRef = useRef(false);

  const logos = useServiceLogos(allServices);

  const selectedServices = useMemo(
    () => allServices.filter((service) => selectedIds.has(service.id)),
    [allServices, selectedIds],
  );

  const discoveryServices = useMemo(
    () =>
      filterDiscoveryServices(allServices, {
        query: searchQuery,
        category: categoryFilter,
      }),
    [allServices, searchQuery, categoryFilter],
  );

  const managementContext = {
    selectedIds,
    accessProfiles: vaultState.accessProfiles,
    credentials: vaultState.credentials,
  };

  function commitSearch(event?: React.FormEvent) {
    event?.preventDefault();
    setSearchQuery(searchDraft.trim());
  }

  function handleSearchDraftChange(value: string) {
    setSearchDraft(value);
    // Native clear ("X") on <input type="search"> updates the value but does not
    // submit the form; clear must reset the applied filter immediately.
    if (!value.trim()) {
      setSearchQuery('');
    }
  }

  function openAddModal() {
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
    setShowAddModal(true);
  }

  function dismissAddModal() {
    setShowAddModal(false);
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
    addInFlightRef.current = false;
  }

  function closeAddModal() {
    if (isDiscovering) {
      return;
    }
    dismissAddModal();
  }

  async function handleAddCustomSite(
    displayName: string,
    primaryUrl: string,
    category: ServiceCategory,
  ) {
    // Ignore repeated submits while a request is in progress or already succeeded.
    if (addInFlightRef.current || isDiscovering || discoveryMessage) return;
    addInFlightRef.current = true;

    try {
      const definition = createCustomServiceDefinition({
        displayName,
        primaryUrl,
        category,
      });

      setAddError(null);
      setDiscoveryMessage(null);
      setDiscoveryOutcome(null);
      setIsDiscovering(true);

      const { definition: finalDefinition, outcome } =
        await discoverLoginForCustomService(definition, { primaryUrl });

      await onAddCustom(finalDefinition);
      setDiscoveryMessage(outcome.message);
      setDiscoveryOutcome(outcome.status);
      setIsDiscovering(false);

      window.setTimeout(() => {
        dismissAddModal();
      }, 1800);
    } catch (error) {
      setIsDiscovering(false);
      setAddError(error instanceof Error ? error.message : 'לא ניתן להוסיף את האתר');
    } finally {
      addInFlightRef.current = false;
    }
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

  const managingProfiles = managingService
    ? getProfilesForService(vaultState, managingService.id)
    : [];

  return (
    <div className="service-management">
      <header className="service-management-header">
        <h1>ניהול שירותים</h1>
        {isFirstRun ? (
          <p>
            בחרו שירות אחד להתחלה מתוך «הוספת שירותים», ולאחר מכן הגדירו פרטי כניסה.
            אפשר להוסיף עוד שירותים בכל עת.
          </p>
        ) : (
          <p>הוסיפו, פתחו ונהלו את השירותים שלכם ופרטי הכניסה שלהם.</p>
        )}
      </header>

      {selectionError && (
        <div className="sm-banner sm-banner--error" role="alert">
          <p>{selectionError}</p>
        </div>
      )}

      <section className="sm-section" aria-labelledby="sm-selected-title">
        <h2 id="sm-selected-title" className="sm-section-title">
          השירותים שלי
        </h2>

        {selectedServices.length === 0 ? (
          <p className="sm-empty">
            עדיין לא נבחרו שירותים. הוסיפו שירות מתוך «הוספת שירותים» למטה.
          </p>
        ) : (
          <div className="sm-grid sm-grid--rows">
            {selectedServices.map((service) => {
              const pending = pendingIds.has(service.id);
              const profileCount = getProfilesForService(vaultState, service.id).length;
              return (
                <ServiceCard
                  key={service.id}
                  name={service.name}
                  categoryLabel={categoryLabels[service.category]}
                  logoSrc={logos[service.id]}
                  state={deriveServiceManagementState(service, managementContext)}
                  profileCount={profileCount}
                  pending={pending}
                  layout="row"
                  manageSlot={
                    <button
                      type="button"
                      className="sm-action sm-action--primary"
                      onClick={() => void openProfileManagement(service)}
                    >
                      ניהול
                    </button>
                  }
                  moreSlot={
                    <div className="sm-row-menu">
                      <button
                        type="button"
                        className="sm-kebab"
                        aria-label="פעולות נוספות"
                        aria-haspopup="menu"
                        aria-expanded={menuOpenId === service.id}
                        disabled={pending}
                        onClick={() =>
                          setMenuOpenId((current) =>
                            current === service.id ? null : service.id,
                          )
                        }
                      >
                        ⋮
                      </button>
                      {menuOpenId === service.id && (
                        <>
                          <div
                            className="sm-menu-backdrop"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="sm-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="sm-menu-item sm-menu-item--danger"
                              disabled={pending}
                              onClick={() => {
                                setMenuOpenId(null);
                                void onRemoveService(service.id);
                              }}
                            >
                              {pending ? 'מסיר…' : '🗑 הסר שירות'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="sm-section" aria-labelledby="sm-add-title">
        <h2 id="sm-add-title" className="sm-section-title">
          הוספת שירותים
        </h2>

        {catalogError ? (
          <div className="sm-discover-error">
            <p>לא ניתן לטעון את קטלוג השירותים כרגע. השירותים שלכם עדיין זמינים לניהול.</p>
            <button type="button" className="sm-action" onClick={onRetryCatalog}>
              נסו שוב
            </button>
          </div>
        ) : (
          <>
            <div className="sm-add-toolbar">
              <form className="sm-search-form" onSubmit={commitSearch}>
                <input
                  type="search"
                  className="sm-search"
                  placeholder="חפש שירות או אתר..."
                  value={searchDraft}
                  onChange={(e) => handleSearchDraftChange(e.target.value)}
                  dir="rtl"
                  aria-label="חפש שירות או אתר..."
                />
                <button
                  type="submit"
                  className="sm-search-submit"
                  aria-label="חיפוש"
                >
                  <svg
                    className="sm-search-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </button>
              </form>
              <button
                type="button"
                className="sm-action sm-action--secondary sm-add-site-btn"
                onClick={openAddModal}
              >
                + הוסף אתר
              </button>
            </div>

            <div className="sm-controls">
              <span className="sm-chips-label" id="sm-category-filter-label">
                סינון לפי קטגוריה
              </span>
              <div
                className="sm-chips"
                role="group"
                aria-labelledby="sm-category-filter-label"
              >
                <button
                  type="button"
                  className={`sm-chip${categoryFilter === null ? ' sm-chip--active' : ''}`}
                  onClick={() => setCategoryFilter(null)}
                >
                  הכל
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`sm-chip${
                      categoryFilter === category ? ' sm-chip--active' : ''
                    }`}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {categoryLabels[category]}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm-add-results" aria-live="polite">
              {discoveryServices.length === 0 ? (
                <p className="sm-empty">לא נמצאו שירותים תואמים. נסו חיפוש אחר או הוסיפו אתר חדש.</p>
              ) : (
                <div className="sm-grid sm-grid--compact">
                  {discoveryServices.map((service) => {
                    const isSelected = selectedIds.has(service.id);
                    const pending = pendingIds.has(service.id);
                    return (
                      <ServiceCard
                        key={service.id}
                        name={service.name}
                        categoryLabel={categoryLabels[service.category]}
                        logoSrc={logos[service.id]}
                        state={deriveServiceManagementState(service, managementContext)}
                        showBadge={false}
                        pending={pending}
                        layout="compact"
                        actions={
                          isSelected ? (
                            <button
                              type="button"
                              className="sm-action sm-action--passive"
                              disabled
                              aria-label="כבר בבית הדיגיטלי"
                            >
                              ✓ כבר בבית הדיגיטלי
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="sm-action sm-action--primary"
                              onClick={() => void onAddService(service.id)}
                              disabled={pending}
                            >
                              {pending ? 'מוסיף…' : 'הוספה'}
                            </button>
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <footer className="service-management-footer">
        <button
          type="button"
          className="sm-action sm-action--secondary sm-footer-nav"
          onClick={onContinue}
        >
          לבית הדיגיטלי
        </button>
      </footer>

      {showAddModal && (
        <AddSiteModal
          onAdd={handleAddCustomSite}
          onCancel={closeAddModal}
          categoryOptions={CUSTOM_ADD_CATEGORIES}
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
          vaultUnlocked={vaultUnlocked}
          onLockVault={onLockVault}
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
            applyVaultUpdate((state) =>
              saveCredentialForProfile(state, profileId, credential),
            )
          }
          onDeleteCredential={(profileId) =>
            applyVaultUpdate((state) => deleteCredentialForProfile(state, profileId))
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
