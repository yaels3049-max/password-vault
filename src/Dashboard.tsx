import { useState } from 'react';
import type { Credential } from './credentials';
import { hasCompleteCredentials } from './credentials';
import {
  groupSelectedServicesByCategory,
  shouldUseCategoryLayout,
} from './digitalHome/homeLayout';
import NotificationsSection from './digitalHome/NotificationsSection';
import UsefulServicesSection from './digitalHome/UsefulServicesSection';
import { openServiceWithProfile } from './serviceManagement/openWithProfile';
import { getLoginFields, type Service } from './mockServices';
import type { ResolveProfileFn } from './profile';
import Tile from './Tile';
import { useServiceLogos } from './useServiceLogos';
import {
  isExtensionAvailable,
  isPocControlsVisible,
  openDemo3FieldsAndFill,
  openDemoAndFill,
  openIsraeliSiteAutofillTest,
} from './pocAutofill';

interface DashboardProps {
  services: Service[];
  /** Default-profile credentials for tile badges (execution-only display). */
  credentials: Record<string, Credential>;
  credentialsByProfileId: Record<string, Credential>;
  resolveProfile: ResolveProfileFn;
  showMagicMomentHint: boolean;
  onDismissMagicMomentHint: () => void;
  onAddMore: () => void;
  /** Soft catalog load indicator — reserved shells, no full-screen jump (AC-105-13). */
  catalogLoading?: boolean;
  /** Soft catalog/network error — Hebrew friendly copy (AC-105-14). */
  catalogError?: string | null;
}

const MISSING_CREDENTIALS_MESSAGE =
  'האתר נפתח. להשלמת המילוי האוטומטי הגדירו פרטי כניסה ב«ניהול שירותים».';

const STATUS_TIMEOUT_MS = 8000;

export default function Dashboard({
  services,
  credentials,
  credentialsByProfileId,
  resolveProfile,
  showMagicMomentHint,
  onDismissMagicMomentHint,
  onAddMore,
  catalogLoading = false,
  catalogError = null,
}: DashboardProps) {
  const logos = useServiceLogos(services);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'warn' | 'success'>('info');
  const showPocControls = isPocControlsVisible();
  const extensionAvailable = isExtensionAvailable();
  const showExtensionBanner = !extensionAvailable && showMagicMomentHint;

  // Count selected services only — Useful/Notifications never contribute.
  const useCategoryLayout = shouldUseCategoryLayout(services.length);
  const categoryGroups = useCategoryLayout
    ? groupSelectedServicesByCategory(services)
    : [];

  function clearStatusSoon(message: string, tone: 'info' | 'warn' | 'success' = 'info') {
    setStatusTone(tone);
    setStatusMessage(message);
    window.setTimeout(() => {
      setStatusMessage((current) => (current === message ? null : current));
    }, STATUS_TIMEOUT_MS);
  }

  async function handleServiceOpen(service: Service) {
    onDismissMagicMomentHint();

    const outcome = await openServiceWithProfile(service, {
      resolveProfile,
      credentialsByProfileId,
    });

    if (outcome.status === 'cancelled') {
      return;
    }

    // AC-105-7: credentials_missing may still have opened the site (loginUrl/primaryUrl).
    // Always surface friendly guidance — never a silent no-op.
    if (outcome.status === 'credentials_missing') {
      clearStatusSoon(outcome.userMessage ?? MISSING_CREDENTIALS_MESSAGE, 'warn');
      return;
    }

    if (outcome.status === 'ok' && outcome.metadataHealth === 'fill_failed') {
      clearStatusSoon(
        outcome.userMessage ??
          'האתר נפתח. מילוי אוטומטי לא זמין כרגע — ניתן למלא ידנית.',
        'info',
      );
      return;
    }

    if (outcome.userMessage) {
      clearStatusSoon(
        outcome.userMessage,
        outcome.status === 'open_only' ? 'info' : 'success',
      );
    }
  }

  function renderTile(service: Service) {
    return (
      <Tile
        key={service.id}
        name={service.name}
        logoSrc={logos[service.id]}
        hasCredentials={hasCompleteCredentials(
          credentials[service.id],
          getLoginFields(service),
        )}
        onOpen={() => void handleServiceOpen(service)}
      />
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-text">
          <h1>הבית הדיגיטלי</h1>
          <p className="dashboard-subtitle">
            פתחו את השירותים שלכם ממקום אחד — במהירות ובביטחון.
          </p>
        </div>
        <div className="dashboard-header-actions">
          {showPocControls && (
            <>
              <div className="poc-fill-wrap">
                <div className="poc-fill-buttons">
                  <button type="button" className="poc-fill-btn" onClick={openDemoAndFill}>
                    פתח ומלא
                  </button>
                  <button
                    type="button"
                    className="poc-fill-btn"
                    onClick={openDemo3FieldsAndFill}
                  >
                    פתח ומלא - 3 שדות
                  </button>
                </div>
                <p className="poc-fill-note">בדיקת מילוי אוטומטי - דמו מקומי בלבד</p>
              </div>
              <div className="poc-fill-wrap">
                <button
                  type="button"
                  className="poc-fill-btn poc-fill-btn--il"
                  onClick={openIsraeliSiteAutofillTest}
                >
                  בדיקת מילוי באתר ישראלי
                </button>
                <p className="poc-fill-note">הייטקזון - mock בלבד, ללא שליחת טופס</p>
              </div>
            </>
          )}
          <button type="button" className="add-more-btn" onClick={onAddMore}>
            ניהול שירותים
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
            הגדירו פרטי כניסה ב<strong>ניהול שירותים</strong>, ואז לחצו על האייקון
            לפתיחת השירות.
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
            חלק מקטלוג השירותים אינו זמין כרגע. השירותים שבחרתם עדיין זמינים לפתיחה.
          </p>
        </div>
      )}

      {statusMessage && (
        <div
          className={`dashboard-banner dashboard-banner--${
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

      {/* Foundations stay wired for future enablement; empty → render nothing (no space). */}
      <UsefulServicesSection />
      <NotificationsSection />

      {catalogLoading && services.length === 0 && (
        <div className="dh-loading-shell" aria-busy="true" aria-live="polite">
          <p className="dh-loading-text">טוען שירותים…</p>
        </div>
      )}

      {!catalogLoading && services.length === 0 && (
        <div className="dashboard-empty-state">
          <p className="dashboard-empty">עדיין לא נבחרו שירותים לבית הדיגיטלי.</p>
          <button type="button" className="add-more-btn add-more-btn--cta" onClick={onAddMore}>
            הוספת שירותים
          </button>
        </div>
      )}

      {/*
        Adaptive layout (selected services only):
        <= 12 → flat app-launcher grid
        >= 13 → category-grouped sections (empty categories hidden)
      */}
      {services.length > 0 && !useCategoryLayout && (
        <section className="app-section app-section--home" aria-label="השירותים שלי">
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
  );
}
