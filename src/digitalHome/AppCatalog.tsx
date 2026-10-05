import { useMemo, useRef, useState } from 'react';
import AddSiteModal, { type AddSiteFormValues } from '../AddSiteModal';
import ServiceCard from '../components/ServiceCard';
import { isShownInUserCatalog } from '../catalog/catalogVisibility';
import { runtimeCategoryLabels, type Service, type ServiceCategory } from '../mockServices';
import type { ServiceDefinition } from '../service/serviceModel';
import {
  CATALOG_SERVICE_ADD_HOME_LABEL,
  CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL,
  catalogServiceAlreadyInHomeMessage,
  CATALOG_SERVICE_AVAILABLE_PROMPT,
  catalogServiceAvailableTitle,
  CATALOG_SERVICE_NOT_NOW_LABEL,
  type AddCustomServiceResult,
} from '../supabase/registryPersistence';
import { toFriendlySecurityError } from '../trust';
import { useServiceLogos } from '../useServiceLogos';
import { catalogItemState, filterCatalog, type AddOutcome } from './catalogModel';
import { buildCustomSiteDefinition } from './customSiteForm';
import { useBackdropDismiss, useEscapeToClose } from './dialogDismiss';

export const LABEL_ADD_CUSTOM_SITE = '+ הוספת אתר מותאם אישית';
export const MSG_CATALOG_LOAD_FAILED =
  'לא ניתן לטעון את קטלוג האתרים כרגע. האתרים שלכם עדיין זמינים.';
export const MSG_CATALOG_NO_MATCH = 'לא נמצאו אתרים תואמים. נסו חיפוש אחר או הוסיפו אתר מותאם אישית.';

export function customSiteAddedMessage(displayName: string): string {
  return `«${displayName}» נוסף לבית הדיגיטלי.`;
}

export interface AppCatalogProps {
  services: Service[];
  categories: ServiceCategory[];
  selectedIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  catalogError: string | null;
  onRetryCatalog: () => void;
  onAddApp: (serviceId: string) => Promise<AddOutcome>;
  onAddCustom: (definition: ServiceDefinition) => Promise<AddCustomServiceResult>;
  searchInputRef?: React.Ref<HTMLInputElement>;
}

type CatalogOffer =
  | { kind: 'already_in_user_home'; serviceId: string; displayName: string }
  | { kind: 'catalog_service_available'; serviceId: string; displayName: string };

function SearchField({
  value,
  onChange,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event?: React.FormEvent) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <form className="sm-search-form" onSubmit={onSubmit}>
      <input
        ref={inputRef}
        type="search"
        className="sm-search"
        placeholder="חפש אתר..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="rtl"
        aria-label="חפש אתר"
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

/** AD-123-8 — container-agnostic catalog body (hosted by the Digital Home catalog modal). */
export default function AppCatalog({
  services,
  categories,
  selectedIds,
  pendingIds,
  catalogError,
  onRetryCatalog,
  onAddApp,
  onAddCustom,
  searchInputRef,
}: AppCatalogProps) {
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [catalogOffer, setCatalogOffer] = useState<CatalogOffer | null>(null);
  const [catalogOfferBusy, setCatalogOfferBusy] = useState(false);
  const [addFailure, setAddFailure] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const addInFlightRef = useRef(false);

  // AD-123-19: listing only — the host's home tiles come from its own unfiltered list.
  const listed = useMemo(
    () => services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id))),
    [services, selectedIds],
  );
  const logos = useServiceLogos(listed);

  const results = useMemo(
    () => filterCatalog(listed, { query: searchQuery, category: categoryFilter }),
    [listed, searchQuery, categoryFilter],
  );

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

  async function addApp(serviceId: string) {
    setAddFailure(null);
    setStatusMessage(null);
    const outcome = await onAddApp(serviceId);
    if (outcome.status === 'failed') {
      setAddFailure(outcome.message);
    }
    return outcome;
  }

  function dismissCatalogOffer() {
    setCatalogOffer(null);
    setCatalogOfferBusy(false);
  }

  const offerBackdrop = useBackdropDismiss(dismissCatalogOffer, {
    containsForm: false,
    disabled: catalogOfferBusy,
  });
  useEscapeToClose(() => {
    if (!catalogOfferBusy) dismissCatalogOffer();
  }, catalogOffer !== null);

  async function confirmAddCatalogToHome() {
    if (!catalogOffer || catalogOffer.kind !== 'catalog_service_available') {
      return;
    }
    if (catalogOfferBusy) return;
    setCatalogOfferBusy(true);
    const outcome = await addApp(catalogOffer.serviceId);
    if (outcome.status === 'failed') {
      setCatalogOfferBusy(false);
      return;
    }
    dismissCatalogOffer();
  }

  function openAddModal() {
    setAddError(null);
    setIsSavingCustom(false);
    setStatusMessage(null);
    setShowAddModal(true);
  }

  function dismissAddModal() {
    setShowAddModal(false);
    setAddError(null);
    setIsSavingCustom(false);
    addInFlightRef.current = false;
  }

  function closeAddModal() {
    if (isSavingCustom) {
      return;
    }
    dismissAddModal();
  }

  async function handleAddCustomSite(values: AddSiteFormValues) {
    if (addInFlightRef.current || isSavingCustom) return;
    addInFlightRef.current = true;

    try {
      const definition = buildCustomSiteDefinition(values);
      setAddError(null);
      setIsSavingCustom(true);

      const result = await onAddCustom(definition);
      if (result.status === 'already_in_user_home') {
        dismissAddModal();
        setCatalogOffer({
          kind: 'already_in_user_home',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      if (result.status === 'catalog_service_available') {
        dismissAddModal();
        setCatalogOffer({
          kind: 'catalog_service_available',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      if (result.status === 'same_user_custom_duplicate') {
        dismissAddModal();
        setCatalogOffer({
          kind: 'already_in_user_home',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      dismissAddModal();
      setStatusMessage(customSiteAddedMessage(definition.displayName));
    } catch (error) {
      setIsSavingCustom(false);
      setAddError(toFriendlySecurityError(error));
    } finally {
      addInFlightRef.current = false;
    }
  }

  return (
    <div className="app-catalog" data-app-catalog="true">
      {catalogError ? (
        <div className="sm-discover-error" role="alert">
          <p>{MSG_CATALOG_LOAD_FAILED}</p>
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
              inputRef={searchInputRef}
            />
            <button
              type="button"
              className="sm-action sm-action--secondary sm-add-site-btn"
              data-action="add-custom-site"
              onClick={openAddModal}
            >
              {LABEL_ADD_CUSTOM_SITE}
            </button>
          </div>

          <div className="sm-controls">
            <span className="sm-chips-label" id="sm-category-filter-label">
              סינון לפי קטגוריה
            </span>
            <div className="sm-chips" role="group" aria-labelledby="sm-category-filter-label">
              <button
                type="button"
                className={`sm-chip${categoryFilter === null ? ' sm-chip--active' : ''}`}
                aria-pressed={categoryFilter === null}
                onClick={() => setCategoryFilter(null)}
              >
                הכל
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`sm-chip${categoryFilter === category ? ' sm-chip--active' : ''}`}
                  aria-pressed={categoryFilter === category}
                  data-category={category}
                  onClick={() => setCategoryFilter(category)}
                >
                  {runtimeCategoryLabels[category] ?? category}
                </button>
              ))}
            </div>
          </div>

          {addFailure && (
            <p className="sm-banner sm-banner--error" role="alert">
              {addFailure}
            </p>
          )}
          {statusMessage && (
            <p className="app-catalog-status" role="status">
              {statusMessage}
            </p>
          )}

          <div className="sm-add-results" aria-live="polite" aria-label="קטלוג אתרים להוספה">
            {results.length === 0 ? (
              <p className="sm-empty">{MSG_CATALOG_NO_MATCH}</p>
            ) : (
              <div className="sm-grid sm-grid--compact">
                {results.map((service) => {
                  const itemState = catalogItemState(service.id, selectedIds, pendingIds);
                  return (
                    <div
                      key={service.id}
                      className="app-catalog-item"
                      data-catalog-item={service.id}
                      data-catalog-state={itemState}
                    >
                      <ServiceCard
                        name={service.name}
                        categoryLabel={runtimeCategoryLabels[service.category] ?? service.category}
                        logoSrc={logos[service.id]}
                        state={itemState === 'added' ? 'added' : 'not_added'}
                        showBadge={false}
                        pending={itemState === 'pending'}
                        layout="compact"
                        actions={
                          itemState === 'added' ? (
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
                              onClick={() => void addApp(service.id)}
                              disabled={itemState === 'pending'}
                            >
                              {itemState === 'pending' ? 'מוסיף…' : 'הוספה'}
                            </button>
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <AddSiteModal
          mode="create"
          onAdd={handleAddCustomSite}
          onCancel={closeAddModal}
          categoryOptions={categories}
          error={addError}
          isSaving={isSavingCustom}
        />
      )}

      {catalogOffer && (
        <div className="modal-overlay" {...offerBackdrop}>
          <div
            className="modal-dialog sm-catalog-offer"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-catalog-offer-title"
          >
            {catalogOffer.kind === 'already_in_user_home' ? (
              <>
                <h2 id="sm-catalog-offer-title" className="modal-title sm-catalog-offer-title">
                  {catalogServiceAlreadyInHomeMessage(catalogOffer.displayName)}
                </h2>
                <div className="modal-actions sm-catalog-offer-dismiss">
                  <button
                    type="button"
                    className="modal-btn modal-btn-primary"
                    onClick={dismissCatalogOffer}
                  >
                    {CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="sm-catalog-offer-title" className="modal-title sm-catalog-offer-title">
                  {catalogServiceAvailableTitle(catalogOffer.displayName)}
                </h2>
                <p className="sm-catalog-offer-prompt">{CATALOG_SERVICE_AVAILABLE_PROMPT}</p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn modal-btn-primary"
                    disabled={catalogOfferBusy}
                    onClick={() => void confirmAddCatalogToHome()}
                  >
                    {catalogOfferBusy ? 'מוסיף…' : CATALOG_SERVICE_ADD_HOME_LABEL}
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-secondary"
                    disabled={catalogOfferBusy}
                    onClick={dismissCatalogOffer}
                  >
                    {CATALOG_SERVICE_NOT_NOW_LABEL}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
