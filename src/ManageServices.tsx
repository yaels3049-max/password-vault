import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AddSiteModal from './AddSiteModal';
import ServiceProfileManagementModal from './ServiceProfileManagementModal';
import ServiceCard from './components/ServiceCard';
import { createCustomServiceDefinition } from './catalog';
import type { CustomServiceDiscoveryResult } from './catalog';
import { groupSelectedServicesByCategory } from './digitalHome/homeLayout';
import {
  runtimeCategoryLabels,
  runtimeCategoryOrder,
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
import { deleteCloudEncryptedCredentialByLocalProfileId } from './supabase/persistence';
import { toFriendlySecurityError, VaultStateBadge } from './trust';

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
  onAddCustom: (definition: ServiceDefinition) => Promise<CustomServiceDiscoveryResult>;
  onVaultStateChange: (state: VaultState) => Promise<void>;
  onRetryCatalog: () => void;
  onContinue: () => void;
  onLockVault?: () => void;
  vaultUnlocked?: boolean;
}

function userFacingCategories(): ServiceCategory[] {
  // Live registry order — a module-level snapshot freezes the built-in 3 cats.
  return runtimeCategoryOrder.filter((category) => category !== 'practice');
}

function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event?: React.FormEvent) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <form className="sm-search-form" onSubmit={onSubmit}>
      <input
        type="search"
        className="sm-search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="rtl"
        aria-label={ariaLabel}
      />
      <button type="submit" className="sm-search-submit" aria-label="חיפוש">
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
  );
}

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
  const manageOpenerRef = useRef<HTMLButtonElement | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mineSearchDraft, setMineSearchDraft] = useState('');
  const [mineSearchQuery, setMineSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const addInFlightRef = useRef(false);

  function closeRowMenu() {
    setMenuOpenId(null);
    setMenuPos(null);
  }

  function openRowMenu(serviceId: string, anchor: HTMLElement) {
    if (menuOpenId === serviceId) {
      closeRowMenu();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 148;
    const menuHeight = 48;
    // Anchor under the ⋮ and open inward (rightward from the left-side kebab in RTL).
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.right - menuWidth);
    }
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 4);
    }
    setMenuPos({ top, left });
    setMenuOpenId(serviceId);
  }

  const logos = useServiceLogos(allServices);

  const selectedServices = useMemo(
    () => allServices.filter((service) => selectedIds.has(service.id)),
    [allServices, selectedIds],
  );

  const filteredMineServices = useMemo(
    () =>
      filterDiscoveryServices(selectedServices, {
        query: mineSearchQuery,
        category: null,
      }),
    [selectedServices, mineSearchQuery],
  );

  const mineCategoryGroups = useMemo(
    () => groupSelectedServicesByCategory(filteredMineServices),
    [filteredMineServices],
  );

  useEffect(() => {
    if (!mineSearchQuery.trim()) {
      return;
    }
    setExpandedCategories(new Set(mineCategoryGroups.map((group) => group.category)));
  }, [mineSearchQuery, mineCategoryGroups]);

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
    if (!value.trim()) {
      setSearchQuery('');
    }
  }

  function commitMineSearch(event?: React.FormEvent) {
    event?.preventDefault();
    setMineSearchQuery(mineSearchDraft.trim());
  }

  function handleMineSearchDraftChange(value: string) {
    setMineSearchDraft(value);
    if (!value.trim()) {
      setMineSearchQuery('');
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
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

      // Phase 108: App.addCustomService creates the registry row then runs the shared
      // Login Discovery pipeline (same as admin). Do not discover before persistence.
      const { outcome } = await onAddCustom(definition);
      setDiscoveryMessage(outcome.message);
      setDiscoveryOutcome(outcome.status);
      setIsDiscovering(false);

      window.setTimeout(() => {
        dismissAddModal();
      }, 1800);
    } catch (error) {
      setIsDiscovering(false);
      setAddError(toFriendlySecurityError(error));
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

  async function openProfileManagement(
    service: Service,
    opener?: HTMLButtonElement | null,
  ) {
    manageOpenerRef.current = opener ?? null;
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
    const opener = manageOpenerRef.current;
    manageOpenerRef.current = null;
    if (opener) {
      window.requestAnimationFrame(() => opener.focus());
    }
  }

  const managingProfiles = managingService
    ? getProfilesForService(vaultState, managingService.id)
    : [];

  return (
    <div className="service-management">
      <header className="service-management-header">
        <div className="shell-lock-row" aria-label="מצב כספת">
          <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
        </div>
        <h1>ניהול אתרים</h1>
        <div className="dashboard-manage-bar sm-home-nav">
          <button
            type="button"
            className="sm-action sm-action--secondary sm-footer-nav dashboard-manage-cta"
            onClick={onContinue}
          >
            לבית הדיגיטלי
          </button>
        </div>
        {isFirstRun ? (
          <p>
            בחרו אתר אחד להתחלה מתוך «הוספת אתרים», ולאחר מכן הגדירו פרטי כניסה.
            אפשר להוסיף עוד אתרים בכל עת.
          </p>
        ) : null}
      </header>

      {selectionError && (
        <div className="sm-banner sm-banner--error" role="alert">
          <p>{selectionError}</p>
        </div>
      )}

      <section className="sm-section" aria-labelledby="sm-selected-title">
        <h2 id="sm-selected-title" className="sm-section-title">
          האתרים שלי
        </h2>

        {selectedServices.length === 0 ? (
          <p className="sm-empty">
            עדיין לא נבחרו אתרים. הוסיפו אתר מתוך «הוספת אתרים» למטה.
          </p>
        ) : (
          <>
            <div className="sm-add-toolbar sm-mine-toolbar">
              <SearchField
                value={mineSearchDraft}
                onChange={handleMineSearchDraftChange}
                onSubmit={commitMineSearch}
                placeholder="חפש באתרים שלי..."
                ariaLabel="חפש באתרים שלי"
              />
            </div>

            {mineCategoryGroups.length === 0 ? (
              <p className="sm-empty">לא נמצאו אתרים תואמים ב«האתרים שלי».</p>
            ) : (
              <div className="sm-accordion" role="list">
                {mineCategoryGroups.map((group) => {
                  const open = expandedCategories.has(group.category);
                  const panelId = `sm-mine-panel-${group.category}`;
                  return (
                    <div
                      key={group.category}
                      className="sm-accordion-item"
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="sm-accordion-trigger"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleCategory(group.category)}
                      >
                        <span
                          className={`sm-accordion-chevron${open ? ' sm-accordion-chevron--open' : ''}`}
                          aria-hidden="true"
                        >
                          ▸
                        </span>
                        <span className="sm-accordion-label">{group.label}</span>
                        <span className="sm-accordion-count">{group.services.length}</span>
                      </button>
                      {open && (
                        <div id={panelId} className="sm-accordion-panel">
                          <div className="sm-grid sm-grid--rows">
                            {group.services.map((service) => {
                              const pending = pendingIds.has(service.id);
                              const profileCount = getProfilesForService(
                                vaultState,
                                service.id,
                              ).length;
                              return (
                                <ServiceCard
                                  key={service.id}
                                  name={service.name}
                                  categoryLabel={
                                    runtimeCategoryLabels[service.category] ??
                                    service.category
                                  }
                                  logoSrc={logos[service.id]}
                                  state={deriveServiceManagementState(
                                    service,
                                    managementContext,
                                  )}
                                  profileCount={profileCount}
                                  pending={pending}
                                  layout="row"
                                  manageSlot={
                                    <button
                                      type="button"
                                      className="sm-action sm-action--primary"
                                      onClick={(event) =>
                                        void openProfileManagement(
                                          service,
                                          event.currentTarget,
                                        )
                                      }
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
                                        onClick={(event) =>
                                          openRowMenu(service.id, event.currentTarget)
                                        }
                                      >
                                        ⋮
                                      </button>
                                    </div>
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="sm-section" aria-labelledby="sm-add-title">
        <h2 id="sm-add-title" className="sm-section-title">
          הוספת אתרים
        </h2>

        {catalogError ? (
          <div className="sm-discover-error">
            <p>לא ניתן לטעון את קטלוג האתרים כרגע. האתרים שלכם עדיין זמינים לניהול.</p>
            <button type="button" className="sm-action" onClick={onRetryCatalog}>
              נסו שוב
            </button>
          </div>
        ) : (
          <>
            <div className="sm-add-toolbar">
              <SearchField
                value={searchDraft}
                onChange={handleSearchDraftChange}
                onSubmit={commitSearch}
                placeholder="חפש אתר..."
                ariaLabel="חפש אתר"
              />
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
                {userFacingCategories().map((category) => (
                    <button
                    key={category}
                    type="button"
                    className={`sm-chip${
                      categoryFilter === category ? ' sm-chip--active' : ''
                    }`}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {runtimeCategoryLabels[category] ?? category}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm-add-results" aria-live="polite">
              {discoveryServices.length === 0 ? (
                <p className="sm-empty">לא נמצאו אתרים תואמים. נסו חיפוש אחר או הוסיפו אתר חדש.</p>
              ) : (
                <div className="sm-grid sm-grid--compact">
                  {discoveryServices.map((service) => {
                    const isSelected = selectedIds.has(service.id);
                    const pending = pendingIds.has(service.id);
                    return (
                      <ServiceCard
                        key={service.id}
                        name={service.name}
                        categoryLabel={runtimeCategoryLabels[service.category] ?? service.category}
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

      {showAddModal && (
        <AddSiteModal
          onAdd={handleAddCustomSite}
          onCancel={closeAddModal}
          categoryOptions={userFacingCategories()}
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
      )}

      {menuOpenId &&
        menuPos &&
        createPortal(
          <>
            <div className="sm-menu-backdrop" onClick={closeRowMenu} />
            <div
              className="sm-menu sm-menu--portal"
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                role="menuitem"
                className="sm-menu-item sm-menu-item--action"
                disabled={pendingIds.has(menuOpenId)}
                onClick={() => {
                  const id = menuOpenId;
                  closeRowMenu();
                  void onRemoveService(id);
                }}
              >
                {pendingIds.has(menuOpenId) ? 'מסיר…' : 'הסר אתר'}
              </button>
            </div>
          </>,
          document.body,
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
    return 'לא ניתן למחוק את הפרופיל האחרון לאתר';
  }
  if (/marked default; exactly one is required/.test(message)) {
    return 'מצב הפרופילים תוקן. סגרו את החלון, פתחו שוב ונסו להוסיף פרופיל.';
  }
  return message;
}
