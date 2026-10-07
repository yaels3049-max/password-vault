import { useEffect, useMemo, useRef, useState } from 'react';
import AddSiteModal, { type AddSiteFormValues } from '../AddSiteModal';
import { ServiceCardLogo } from '../components/ServiceCard';
import { isShownInUserCatalog } from '../catalog/catalogVisibility';
import { runtimeCategoryLabels, type Service, type ServiceCategory } from '../mockServices';
import type { ServiceDefinition } from '../service/serviceModel';
import {
  CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL,
  catalogServiceAlreadyInHomeMessage,
  type AddCustomServiceResult,
} from '../supabase/registryPersistence';
import { toFriendlySecurityError } from '../trust';
import { useServiceLogos } from '../useServiceLogos';
import {
  CATALOG_OFFER_ADD_LABEL,
  CATALOG_OFFER_BACK_LABEL,
  catalogOfferFoundTitle,
  catalogOfferSupportedText,
  LABEL_ALL_CATEGORIES,
  LABEL_ALREADY_IN_HOME,
  pickAddedLabel,
  pickAddLabel,
} from './catalogMessages';
import { catalogItemState, filterCatalog, type AddOutcome } from './catalogModel';
import { buildCustomSiteDefinition } from './customSiteForm';
import { useBackdropDismiss, useEscapeToClose } from './dialogDismiss';

export const LABEL_ADD_CUSTOM_SITE = '+ הוספת אתר מותאם אישית';
export const MSG_CATALOG_LOAD_FAILED =
  'לא ניתן לטעון את קטלוג האתרים כרגע. האתרים שלכם עדיין זמינים.';
export const MSG_CATALOG_NO_MATCH = 'לא נמצאו אתרים תואמים. נסו חיפוש אחר או הוסיפו אתר מותאם אישית.';

/** O-123-35 — how long the CTA / offer shows its «✓ נוסף…» label before the catalog closes. */
export const PICK_ADDED_MS = 500;

export interface AppCatalogProps {
  services: Service[];
  categories: ServiceCategory[];
  selectedIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  catalogError: string | null;
  onRetryCatalog: () => void;
  onAddApp: (serviceId: string) => Promise<AddOutcome>;
  /** O-123-35 — the picker's selection, added in one vault update (all-or-nothing). */
  onAddApps: (serviceIds: string[]) => Promise<AddOutcome>;
  onAddCustom: (definition: ServiceDefinition) => Promise<AddCustomServiceResult>;
  /** O-123-35 — the post-add sequence continues in the host (catalog fade → home). */
  onAddSequenceDone?: (serviceIds: string[]) => void;
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
  onAddApps,
  onAddCustom,
  onAddSequenceDone,
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
  const [picks, setPicks] = useState<ReadonlySet<string>>(() => new Set());
  const [picking, setPicking] = useState(false);
  const [pickedCount, setPickedCount] = useState(0);
  const [offerAdded, setOfferAdded] = useState(false);
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(() => new Set());
  const addInFlightRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  function later(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }

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

  // An app that reached the home another way (offer, other window) is no longer a pick.
  useEffect(() => {
    setPicks((current) => {
      if (![...current].some((id) => selectedIds.has(id))) return current;
      return new Set([...current].filter((id) => !selectedIds.has(id)));
    });
  }, [selectedIds]);

  function togglePick(serviceId: string) {
    if (picking || pickedCount > 0) return;
    if (catalogItemState(serviceId, selectedIds, pendingIds) !== 'available') return;
    setAddFailure(null);
    setPicks((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  /** O-123-35: one host call for the whole selection; on failure nothing is added and the picks stay. */
  async function addPicks() {
    if (picking || pickedCount > 0 || picks.size === 0) return;
    const ids = listed.filter((service) => picks.has(service.id)).map((service) => service.id);
    setAddFailure(null);
    setPicking(true);
    const outcome = await onAddApps(ids);
    setPicking(false);
    if (outcome.status === 'failed') {
      setAddFailure(outcome.message);
      return;
    }
    setPickedCount(ids.length);
    setPicks(new Set());
    later(() => {
      if (onAddSequenceDone) onAddSequenceDone(ids);
      else setPickedCount(0);
    }, PICK_ADDED_MS);
  }

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

  function chooseCategory(category: ServiceCategory | null) {
    setCategoryFilter(category);
  }

  async function addApp(serviceId: string) {
    setAddFailure(null);
    const outcome = await onAddApp(serviceId);
    if (outcome.status === 'failed') {
      setAddFailure(outcome.message);
    }
    return outcome;
  }

  function dismissCatalogOffer() {
    setCatalogOffer(null);
    setCatalogOfferBusy(false);
    setOfferAdded(false);
  }

  const offerBackdrop = useBackdropDismiss(dismissCatalogOffer, {
    containsForm: false,
    disabled: catalogOfferBusy,
  });
  // O-123-34: with no ×, Escape on the catalog-available offer is the keyboard «חזרה לחנות האתרים».
  useEscapeToClose(() => {
    if (catalogOfferBusy) return;
    if (catalogOffer?.kind === 'catalog_service_available') closeOfferAndForm();
    else dismissCatalogOffer();
  }, catalogOffer !== null);

  async function confirmAddCatalogToHome() {
    if (!catalogOffer || catalogOffer.kind !== 'catalog_service_available') {
      return;
    }
    if (catalogOfferBusy) return;
    setCatalogOfferBusy(true);
    const serviceId = catalogOffer.serviceId;
    const outcome = await addApp(serviceId);
    if (outcome.status === 'failed') {
      setCatalogOfferBusy(false);
      return;
    }
    // O-123-35: the same post-add sequence as the picker CTA.
    setOfferAdded(true);
    later(() => {
      if (onAddSequenceDone) onAddSequenceDone([serviceId]);
      else closeOfferAndForm();
    }, PICK_ADDED_MS);
  }

  /** O-123-13: «הוספה לבית הדיגיטלי» (after success) and «חזרה לחנות האתרים» end the custom add. */
  function closeOfferAndForm() {
    dismissCatalogOffer();
    dismissAddModal();
  }

  function openAddModal() {
    setAddError(null);
    setIsSavingCustom(false);
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
      // O-123-13/14: the offer opens above the form, which stays open (inert) with the typed values.
      if (result.status === 'already_in_user_home') {
        setIsSavingCustom(false);
        setCatalogOffer({
          kind: 'already_in_user_home',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      if (result.status === 'catalog_service_available') {
        setIsSavingCustom(false);
        setCatalogOffer({
          kind: 'catalog_service_available',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      if (result.status === 'same_user_custom_duplicate') {
        setIsSavingCustom(false);
        setCatalogOffer({
          kind: 'already_in_user_home',
          serviceId: result.existingServiceId,
          displayName: result.displayName,
        });
        return;
      }
      // O-123-39: the store add's post-add path; the form (still «שומר…») leaves with the catalog.
      if (onAddSequenceDone) onAddSequenceDone([definition.id]);
      else dismissAddModal();
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
              className="sm-add-site-link"
              data-action="add-custom-site"
              onClick={openAddModal}
            >
              {LABEL_ADD_CUSTOM_SITE}
            </button>
          </div>

          <div className="sm-controls">
            <div className="sm-chips" role="group" aria-label="סינון לפי קטגוריה">
              <button
                type="button"
                className={`sm-chip${categoryFilter === null ? ' sm-chip--active' : ''}`}
                aria-pressed={categoryFilter === null}
                onClick={() => chooseCategory(null)}
              >
                {LABEL_ALL_CATEGORIES}
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`sm-chip${categoryFilter === category ? ' sm-chip--active' : ''}`}
                  aria-pressed={categoryFilter === category}
                  data-category={category}
                  onClick={() => chooseCategory(category)}
                >
                  {runtimeCategoryLabels[category] ?? category}
                </button>
              ))}
            </div>
          </div>

          {addFailure && picks.size === 0 && (
            <p className="sm-banner sm-banner--error" role="alert">
              {addFailure}
            </p>
          )}
          <div
            className="sm-add-results"
            aria-live="polite"
            aria-label="קטלוג אתרים להוספה"
          >
            {results.length === 0 ? (
              <p className="sm-empty">{MSG_CATALOG_NO_MATCH}</p>
            ) : (
              <div className="sm-pick-grid">
                {results.map((service) => {
                  const itemState = catalogItemState(service.id, selectedIds, pendingIds);
                  const picked = picks.has(service.id);
                  const inHome = itemState === 'added';
                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`app-catalog-item sm-pick${picked ? ' sm-pick--selected' : ''}${inHome ? ' sm-pick--in-home' : ''}`}
                      data-catalog-item={service.id}
                      data-catalog-state={itemState}
                      aria-pressed={picked}
                      aria-disabled={itemState !== 'available' ? true : undefined}
                      onClick={() => togglePick(service.id)}
                    >
                      <span className="sm-pick-icon" aria-hidden="true">
                        <ServiceCardLogo
                          name={service.name}
                          logoSrc={logos[service.id]}
                          imgFailed={failedLogos.has(service.id)}
                          onImgError={() => setFailedLogos((current) => new Set(current).add(service.id))}
                        />
                      </span>
                      <span className="sm-pick-name" title={service.name}>
                        {service.name}
                      </span>
                      {picked && (
                        <span className="sm-pick-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {inHome && <span className="sm-pick-in-home">{LABEL_ALREADY_IN_HOME}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {(picks.size > 0 || pickedCount > 0) && (
            <div className="sm-pick-cta-bar" data-catalog-cta-bar="true">
              {addFailure && picks.size > 0 && (
                <p className="sm-pick-error" role="alert">
                  {addFailure}
                </p>
              )}
              <button
                type="button"
                className={`sm-action sm-action--primary sm-pick-cta${pickedCount > 0 ? ' sm-pick-cta--done' : ''}`}
                data-action="catalog-add-selected"
                aria-busy={picking ? true : undefined}
                aria-disabled={picking || pickedCount > 0 ? true : undefined}
                onClick={() => void addPicks()}
              >
                {pickedCount > 0 ? pickAddedLabel(pickedCount) : pickAddLabel(picks.size)}
              </button>
            </div>
          )}
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
          covered={catalogOffer !== null}
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
                    autoFocus
                    onClick={dismissCatalogOffer}
                  >
                    {CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="sm-catalog-offer-title" className="modal-title sm-catalog-offer-title">
                  {catalogOfferFoundTitle(catalogOffer.displayName)}
                </h2>
                <p className="sm-catalog-offer-prompt">
                  {catalogOfferSupportedText(catalogOffer.displayName)}
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn modal-btn-primary"
                    data-action="catalog-offer-add"
                    autoFocus
                    disabled={catalogOfferBusy}
                    onClick={() => void confirmAddCatalogToHome()}
                  >
                    {offerAdded ? pickAddedLabel(1) : catalogOfferBusy ? 'מוסיף…' : CATALOG_OFFER_ADD_LABEL}
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-secondary"
                    data-action="catalog-offer-back"
                    disabled={catalogOfferBusy}
                    onClick={closeOfferAndForm}
                  >
                    {CATALOG_OFFER_BACK_LABEL}
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
