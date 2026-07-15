import { useState } from 'react';
import type { Credential } from './credentials';
import { hasCompleteCredentials } from './credentials';
import {
  groupSelectedServicesByCategory,
  shouldUseCategoryLayout,
} from './digitalHome/homeLayout';
import NotificationsSection from './digitalHome/NotificationsSection';
import UsefulServicesSection from './digitalHome/UsefulServicesSection';
import {
  LoginAssistancePanel,
  MSG_NO_CREDENTIALS,
  serviceHasUsableCredentials,
} from './loginAssistance';
import { getLoginFields, type Service } from './mockServices';
import type { AccessProfile, ResolveProfileFn } from './profile';
import Tile from './Tile';
import { VaultStateBadge } from './trust';
import { useServiceLogos } from './useServiceLogos';
import { isExtensionAvailable } from './pocAutofill';

interface DashboardProps {
  services: Service[];
  /** Default-profile credentials for tile badges (execution-only display). */
  credentials: Record<string, Credential>;
  credentialsByProfileId: Record<string, Credential>;
  /** All access profiles — Login Assistance panel (Phase 113). */
  accessProfiles: AccessProfile[];
  resolveProfile: ResolveProfileFn;
  /** Authenticated user display name (users/session) — AC-113-26. */
  userDisplayName?: string;
  showMagicMomentHint: boolean;
  onDismissMagicMomentHint: () => void;
  onAddMore: () => void;
  /** Soft catalog load indicator — reserved shells, no full-screen jump (AC-105-13). */
  catalogLoading?: boolean;
  /** Soft catalog/network error — Hebrew friendly copy (AC-105-14). */
  catalogError?: string | null;
  /** Lock control rendered inside the Home shell (D-113-23 / AC-113-35). */
  vaultUnlocked?: boolean;
  onLockVault?: () => void;
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
  credentials,
  credentialsByProfileId,
  accessProfiles,
  resolveProfile: _resolveProfile,
  userDisplayName = '',
  showMagicMomentHint,
  onDismissMagicMomentHint,
  onAddMore,
  catalogLoading = false,
  catalogError = null,
  vaultUnlocked = true,
  onLockVault,
}: DashboardProps) {
  const logos = useServiceLogos(services);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'warn' | 'success'>('info');
  const [assistance, setAssistance] = useState<AssistanceState | null>(null);
  const extensionAvailable = isExtensionAvailable();
  const showExtensionBanner = !extensionAvailable && showMagicMomentHint;

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

  function handleServiceOpen(service: Service, anchorRect: DOMRect) {
    onDismissMagicMomentHint();

    if (assistance?.service.id === service.id) {
      setAssistance(null);
      return;
    }

    if (
      !serviceHasUsableCredentials(
        service,
        accessProfiles,
        credentialsByProfileId,
      )
    ) {
      setAssistance(null);
      clearStatusSoon(MSG_NO_CREDENTIALS, 'warn');
      return;
    }

    setAssistance({ service, anchorRect });
  }

  function renderTile(service: Service) {
    return (
      <Tile
        key={service.id}
        serviceId={service.id}
        name={service.name}
        logoSrc={logos[service.id]}
        hasCredentials={hasCompleteCredentials(
          credentials[service.id],
          getLoginFields(service),
        )}
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
          <button
            type="button"
            className="sm-action sm-action--secondary sm-footer-nav dashboard-manage-cta"
            onClick={onAddMore}
          >
            ניהול אתרים
          </button>
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

      {showMagicMomentHint && (
        <div className="dashboard-banner dashboard-banner--hint">
          <p>
            הגדירו פרטי כניסה ב<strong>ניהול אתרים</strong>, ואז לחצו על האייקון
            לפתיחת האתר.
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

      {catalogError && services.length > 0 && (
        <div className="dashboard-banner dashboard-banner--warn" role="status">
          <p>
            חלק מקטלוג האתרים אינו זמין כרגע. האתרים שבחרתם עדיין זמינים לפתיחה.
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
          <div className="dashboard-empty-state">
            <p className="dashboard-empty">עדיין לא נבחרו אתרים</p>
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
        />
      )}
    </div>
  );
}
