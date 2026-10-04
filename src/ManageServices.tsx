import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ServiceCard from './components/ServiceCard';
import AppCatalog from './digitalHome/AppCatalog';
import EditSiteDetailsModal from './digitalHome/EditSiteDetailsModal';
import { userFacingCategories, type AddOutcome } from './digitalHome/catalogModel';
import { groupSelectedServicesByCategory } from './digitalHome/homeLayout';
import { runtimeCategoryLabels, type Service } from './mockServices';
import type { ServiceDefinition } from './service/serviceModel';
import type { ProfileManagementRequest } from './digitalHome/appContext';
import type { VaultState } from './vault/vault';
import { useServiceLogos } from './useServiceLogos';
import { deriveServiceManagementState } from './serviceManagement/serviceManagementState';
import { filterDiscoveryServices } from './serviceManagement/discoveryFilter';
import { getProfilesForService } from './vault/profileManagement';
import type { AddCustomServiceResult } from './supabase/registryPersistence';
import { VaultStateBadge } from './trust';
import {
  NO_STORED_CREDENTIALS_LIST_LABEL,
  isNoStoredCredentialsMode,
  offersCredentialManagementPanel,
} from './service/credentialSchema';

interface ManageServicesProps {
  allServices: Service[];
  selectedIds: Set<string>;
  isFirstRun: boolean;
  vaultState: VaultState;
  pendingIds: Set<string>;
  selectionError: string | null;
  catalogError: string | null;
  /** AD-123-8 — shared catalog body; add = App addService (no profile). */
  onAddApp: (id: string) => Promise<AddOutcome>;
  onRemoveService: (id: string) => Promise<void>;
  onAddCustom: (definition: ServiceDefinition) => Promise<AddCustomServiceResult>;
  onUpdateCustom: (definition: ServiceDefinition) => Promise<void>;
  /** AD-123-3 — profiles are managed in the single App-level host. */
  onOpenProfileManagement: (request: ProfileManagementRequest) => void;
  profileManagementOpen?: boolean;
  onRetryCatalog: () => void;
  onContinue: () => void;
  onLockVault?: () => void;
  vaultUnlocked?: boolean;
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
  onAddApp,
  onRemoveService,
  onAddCustom,
  onUpdateCustom,
  onOpenProfileManagement,
  profileManagementOpen = false,
  onRetryCatalog,
  onContinue,
  onLockVault,
  vaultUnlocked = true,
}: ManageServicesProps) {
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [mineSearchDraft, setMineSearchDraft] = useState('');
  const [mineSearchQuery, setMineSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const manageOpenerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (profileManagementOpen) {
      return;
    }
    const opener = manageOpenerRef.current;
    manageOpenerRef.current = null;
    if (opener) {
      window.requestAnimationFrame(() => opener.focus());
    }
  }, [profileManagementOpen]);

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
    const menuHeight = 88;
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

  const managementContext = {
    selectedIds,
    accessProfiles: vaultState.accessProfiles,
    credentials: vaultState.credentials,
  };

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

  function openEditLoginEntry(serviceId: string) {
    closeRowMenu();
    setEditingServiceId(serviceId);
  }

  const editingService = editingServiceId
    ? allServices.find((service) => service.id === editingServiceId) ?? null
    : null;

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
            עדיין לא נבחרו אתרים.
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
                                    isNoStoredCredentialsMode(service) ? (
                                      <span className="sm-manage-status">
                                        {NO_STORED_CREDENTIALS_LIST_LABEL}
                                      </span>
                                    ) : offersCredentialManagementPanel(service) ? (
                                      <button
                                        type="button"
                                        className="sm-action sm-action--primary"
                                        onClick={(event) => {
                                          manageOpenerRef.current = event.currentTarget;
                                          onOpenProfileManagement({
                                            serviceId: service.id,
                                            mode: 'edit',
                                          });
                                        }}
                                      >
                                        ניהול
                                      </button>
                                    ) : null
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

        <AppCatalog
          services={allServices}
          categories={userFacingCategories()}
          selectedIds={selectedIds}
          pendingIds={pendingIds}
          catalogError={catalogError}
          onRetryCatalog={onRetryCatalog}
          onAddApp={onAddApp}
          onAddCustom={onAddCustom}
        />
      </section>

      {editingService && (
        <EditSiteDetailsModal
          service={editingService}
          definition={vaultState.customServices.find((service) => service.id === editingService.id)}
          categories={userFacingCategories()}
          onSave={onUpdateCustom}
          onClose={() => setEditingServiceId(null)}
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
              {allServices.find((service) => service.id === menuOpenId)?.source ===
                'user-created' && (
                <button
                  type="button"
                  role="menuitem"
                  className="sm-menu-item sm-menu-item--action"
                  disabled={pendingIds.has(menuOpenId)}
                  onClick={() => openEditLoginEntry(menuOpenId)}
                >
                  עריכת פרטי האתר
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}