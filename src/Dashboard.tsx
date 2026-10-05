import { useEffect, useRef, useState } from 'react';
import type { Credential } from './credentials';
import { appHasProfile, type ProfileManagementRequest } from './digitalHome/appContext';
import { MSG_REMOVED_ELSEWHERE } from './digitalHome/cloudReconcile';
import { LABEL_ADD_APP } from './digitalHome/AppCatalogModal';
import {
  groupSelectedServicesByCategory,
  shouldUseCategoryLayout,
} from './digitalHome/homeLayout';
import NotificationsSection from './digitalHome/NotificationsSection';
import UsefulServicesSection from './digitalHome/UsefulServicesSection';
import {
  LoginAssistancePanel,
  MSG_REMOVED_ELSEWHERE_PLAIN,
  shouldOpenLoginAssistancePanel,
} from './loginAssistance';
import type { Service } from './mockServices';
import type { AccessProfile, ResolveProfileFn } from './profile';
import Tile from './Tile';
import { VaultStateBadge } from './trust';
import { useServiceLogos } from './useServiceLogos';
import { isExtensionAvailable } from './pocAutofill';

interface DashboardProps {
  services: Service[];
  credentialsByProfileId: Record<string, Credential>;
  /** All access profiles — Login Assistance panel (Phase 113). */
  accessProfiles: AccessProfile[];
  resolveProfile: ResolveProfileFn;
  /** Authenticated user display name (users/session) — AC-113-26. */
  userDisplayName?: string;
  showMagicMomentHint: boolean;
  onDismissMagicMomentHint: () => void;
  /** Soft catalog load indicator — reserved shells, no full-screen jump (AC-105-13). */
  catalogLoading?: boolean;
  /** Soft catalog/network error — Hebrew friendly copy (AC-105-14). */
  catalogError?: string | null;
  /** Lock control rendered inside the Home shell (D-113-23 / AC-113-35). */
  vaultUnlocked?: boolean;
  onLockVault?: () => void;
  /** Ids of apps in the vault `customServices` (AD-123-14). */
  customServiceIds?: ReadonlySet<string>;
  /** D-123-8 — own sites currently following their approved registry entry. */
  approvedOwnSiteIds?: ReadonlySet<string>;
  /** AD-123-3 — open the single profile-management host. */
  onOpenProfileManagement?: (request: ProfileManagementRequest) => void;
  /** AD-123-8 — «+ הוספת אפליקציה» opens the catalog modal hosted in App. */
  onOpenCatalog?: () => void;
  /** AD-123-14 — app-actions menu «עריכת פרטי האתר» (custom sites). */
  onEditSiteDetails?: (service: Service) => void;
  /** AD-123-11 — app-actions menu «הסרת אפליקציה» (every app); App owns confirm + Undo. */
  onRemoveApp?: (service: Service) => void;
  /** AD-123-18 (3) — apps changed by a cloud reconcile (deleted in another window). */
  cloudReconcile?: {
    seq: number;
    affectedServiceIds: string[];
    closedOtherSurface: boolean;
  } | null;
}

interface AssistanceState {
  service: Service;
  anchorRect: DOMRect;
}

const STATUS_TIMEOUT_MS = 8000;

function digitalHomeTitle(userDisplayName?: string): string {
  const name = userDisplayName?.trim();
  return name ? `הבית הדיגיטלי של ${name}` : 'הבית הדיגיטלי';
}

export default function Dashboard({
  services,
  credentialsByProfileId,
  accessProfiles,
  resolveProfile: _resolveProfile,
  userDisplayName = '',
  showMagicMomentHint,
  onDismissMagicMomentHint,
  catalogLoading = false,
  catalogError = null,
  vaultUnlocked = true,
  onLockVault,
  customServiceIds,
  approvedOwnSiteIds,
  onOpenProfileManagement,
  onOpenCatalog,
  onEditSiteDetails,
  onRemoveApp,
  cloudReconcile = null,
}: DashboardProps) {
  const logos = useServiceLogos(services);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'warn' | 'success'>('info');
  const [assistance, setAssistance] = useState<AssistanceState | null>(null);
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);
  const extensionAvailable = isExtensionAvailable();
  // The first-login hint is about opening an app, so it waits for the first app.
  const showHint = showMagicMomentHint && services.length > 0;
  const showExtensionBanner = !extensionAvailable && showHint;

  const useCategoryLayout = shouldUseCategoryLayout(services.length);
  const categoryGroups = useCategoryLayout
    ? groupSelectedServicesByCategory(services)
    : [];

  function clearStatusSoon(
    message: string,
    tone: 'info' | 'warn' | 'success' = 'info',
  ) {
    setStatusTone(tone);
    setStatusMessage(message);
    window.setTimeout(() => {
      setStatusMessage((current) => (current === message ? null : current));
    }, STATUS_TIMEOUT_MS);
  }

  const handledReconcileSeq = useRef(cloudReconcile?.seq ?? 0);
  useEffect(() => {
    if (!cloudReconcile || cloudReconcile.seq === handledReconcileSeq.current) {
      return;
    }
    handledReconcileSeq.current = cloudReconcile.seq;
    const closesPanel =
      assistance !== null && cloudReconcile.affectedServiceIds.includes(assistance.service.id);
    if (closesPanel) {
      setAssistance(null);
    }
    // Fixed above the catalog modal and the floating window, so it is seen wherever the user is.
    const message =
      closesPanel || cloudReconcile.closedOtherSurface
        ? MSG_REMOVED_ELSEWHERE
        : MSG_REMOVED_ELSEWHERE_PLAIN;
    setReconcileNotice(message);
    window.setTimeout(() => {
      setReconcileNotice((current) => (current === message ? null : current));
    }, STATUS_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReconcile]);

  function handleServiceOpen(service: Service, anchorRect: DOMRect) {
    onDismissMagicMomentHint();

    if (assistance?.service.id === service.id) {
      setAssistance(null);
      return;
    }

    // Every launch kind uses the floating Launch Card — never a page-level banner.
    shouldOpenLoginAssistancePanel(
      service,
      accessProfiles,
      credentialsByProfileId,
    );
    setStatusMessage(null);
    setAssistance({ service, anchorRect });
  }

  function renderTile(service: Service) {
    return (
      <Tile
        key={service.id}
        serviceId={service.id}
        name={service.name}
        logoSrc={logos[service.id]}
        hasCredentials={appHasProfile({ accessProfiles }, service.id)}
        assisted={assistance?.service.id === service.id}
        onOpen={(anchorRect) => handleServiceOpen(service, anchorRect)}
      />
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="shell-lock-row" aria-label="מצב כספת">
          <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
        </div>
        <h1>{digitalHomeTitle(userDisplayName)}</h1>
        <div className="dashboard-manage-bar">
          {onOpenCatalog && (
            <button
              type="button"
              className="sm-action sm-action--primary sm-footer-nav dashboard-add-app-cta"
              data-action="open-catalog"
              onClick={onOpenCatalog}
            >
              {LABEL_ADD_APP}
            </button>
          )}
        </div>
      </header>

      {showExtensionBanner && (
        <div className="dashboard-banner dashboard-banner--info" role="status">
          <p>
            מילוי אוטומטי של פרטי הכניסה מתאפשר באמצעות תוסף הדפדפן של הבית הדיגיטלי.
            התקינו את התוסף כדי שהשדות ימולאו בעצמם לאחר הפתיחה.
          </p>
        </div>
      )}

      {showHint && (
        <div className="dashboard-banner dashboard-banner--hint">
          <p>
            לחצו על האייקון של אפליקציה כדי לפתוח אותה. בחלון שנפתח אפשר להוסיף
            פרופיל עם פרטי הכניסה.
          </p>
          <button
            type="button"
            className="dashboard-banner-dismiss"
            onClick={onDismissMagicMomentHint}
          >
            הבנתי
          </button>
        </div>
      )}

      {catalogError && (
        <div className="dashboard-banner dashboard-banner--warn" role="status">
          <p>
            {services.length > 0
              ? 'חלק מקטלוג האתרים אינו זמין כרגע. האתרים שבחרתם עדיין זמינים לפתיחה.'
              : `קטלוג האפליקציות אינו זמין כרגע. אפשר לנסות שוב מתוך «${LABEL_ADD_APP}».`}
          </p>
        </div>
      )}

      {statusMessage && (
        <div
          className={`dashboard-banner la-home-notice dashboard-banner--${
            statusTone === 'warn'
              ? 'warn'
              : statusTone === 'success'
                ? 'success'
                : 'info'
          }`}
          role="status"
        >
          <p>{statusMessage}</p>
        </div>
      )}

      <div className="dashboard-launcher">
        <UsefulServicesSection />
        <NotificationsSection />

        {catalogLoading && services.length === 0 && (
          <div className="dh-loading-shell" aria-busy="true" aria-live="polite">
            <p className="dh-loading-text">טוען אתרים…</p>
          </div>
        )}

        {!catalogLoading && services.length === 0 && (
          <div className="dashboard-empty-state" data-home-empty="true">
            <p className="dashboard-empty">
              עדיין אין אפליקציות בבית הדיגיטלי. הוסיפו את האפליקציה הראשונה כדי להתחיל.
            </p>
            {onOpenCatalog && (
              <button
                type="button"
                className="sm-action sm-action--primary dashboard-empty-cta"
                data-action="open-catalog-empty"
                onClick={onOpenCatalog}
              >
                {LABEL_ADD_APP}
              </button>
            )}
          </div>
        )}

        {services.length > 0 && !useCategoryLayout && (
          <section className="app-section app-section--home" aria-label="האתרים שלי">
            <div className="app-grid">{services.map(renderTile)}</div>
          </section>
        )}

        {services.length > 0 &&
          useCategoryLayout &&
          categoryGroups.map((group) => (
            <section key={group.category} className="app-section">
              <h2 className="app-section-title">{group.label}</h2>
              <div className="app-grid">{group.services.map(renderTile)}</div>
            </section>
          ))}
      </div>

      {assistance && (
        <LoginAssistancePanel
          service={assistance.service}
          accessProfiles={accessProfiles}
          credentialsByProfileId={credentialsByProfileId}
          anchorRect={assistance.anchorRect}
          logoSrc={logos[assistance.service.id]}
          onClose={() => setAssistance(null)}
          onStatus={clearStatusSoon}
          isCustom={customServiceIds?.has(assistance.service.id) ?? false}
          ownSiteApproved={approvedOwnSiteIds?.has(assistance.service.id) ?? false}
          onEditProfile={
            onOpenProfileManagement
              ? (service, profileId) => {
                  onOpenProfileManagement({ serviceId: service.id, profileId, mode: 'edit' });
                  setAssistance(null);
                }
              : undefined
          }
          onAddProfile={
            onOpenProfileManagement
              ? (service) => {
                  onOpenProfileManagement({ serviceId: service.id, mode: 'add' });
                  setAssistance(null);
                }
              : undefined
          }
          onEditSiteDetails={
            onEditSiteDetails
              ? (service) => {
                  onEditSiteDetails(service);
                  setAssistance(null);
                }
              : undefined
          }
          onRemoveApp={
            onRemoveApp
              ? (service) => {
                  setAssistance(null);
                  onRemoveApp(service);
                }
              : undefined
          }
        />
      )}

      {reconcileNotice && (
        <div className="dh-reconcile-notice" role="status" dir="rtl" data-reconcile-notice="true">
          <span>{reconcileNotice}</span>
          <button
            type="button"
            className="la-icon-btn"
            aria-label="סגירה"
            onClick={() => setReconcileNotice(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
