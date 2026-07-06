import { useState } from 'react';
import type { Credential } from './credentials';
import { hasCompleteCredentials } from './credentials';
import { executeServiceFromTile } from './execution/serviceExecution';
import {
  categories,
  categoryLabels,
  getLoginFields,
  type Service,
} from './mockServices';
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
}

const MISSING_CREDENTIALS_MESSAGE =
  'הגדירו פרטי כניסה במסך «ניהול השירותים» — לחצו «הוסף שירותים נוספים».';

export default function Dashboard({
  services,
  credentials,
  credentialsByProfileId,
  resolveProfile,
  showMagicMomentHint,
  onDismissMagicMomentHint,
  onAddMore,
}: DashboardProps) {
  const logos = useServiceLogos(services);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const showPocControls = isPocControlsVisible();
  const extensionAvailable = isExtensionAvailable();
  const showExtensionBanner = !extensionAvailable && showMagicMomentHint;

  function clearStatusSoon(message: string) {
    setStatusMessage(message);
    window.setTimeout(() => {
      setStatusMessage((current) => (current === message ? null : current));
    }, 8000);
  }

  function promptMissingCredentials() {
    clearStatusSoon(MISSING_CREDENTIALS_MESSAGE);
  }

  async function resolveProfileForOpen(serviceId: string): Promise<string | null> {
    const result = await resolveProfile(serviceId);
    if (result === 'cancelled') {
      return null;
    }
    if (result === 'unavailable') {
      promptMissingCredentials();
      return null;
    }
    return result;
  }

  async function handleServiceOpen(service: Service) {
    onDismissMagicMomentHint();

    const profileId = await resolveProfileForOpen(service.id);
    if (!profileId) {
      return;
    }

    const loginFields = getLoginFields(service);
    const credential = credentialsByProfileId[profileId];

    const result = executeServiceFromTile(service, credential, loginFields);

    if (result.status === 'credentials_missing') {
      promptMissingCredentials();
      return;
    }

    if (result.userMessage) {
      clearStatusSoon(result.userMessage);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>המרכז הדיגיטלי שלי</h1>
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
            ➕ הוסף שירותים נוספים
          </button>
        </div>
      </header>

      {showExtensionBanner && (
        <div className="dashboard-banner dashboard-banner--info" role="status">
          <p>
            מילוי אוטומטי של פרטי הכניסה מתאפשר באמצעות תוסף הדפדפן של המרכז הדיגיטלי.
            התקינו את התוסף כדי שהשדות ימולאו בעצמם לאחר הפתיחה.
          </p>
        </div>
      )}

      {showMagicMomentHint && (
        <div className="dashboard-banner dashboard-banner--hint">
          <p>
            הגדירו פרטי כניסה ב<strong>ניהול השירותים</strong>, ואז לחצו על האייקון
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

      {statusMessage && (
        <div className="dashboard-banner dashboard-banner--success" role="status">
          <p>{statusMessage}</p>
        </div>
      )}

      {categories.map((category) => {
        const categoryServices = services.filter((s) => s.category === category);
        if (categoryServices.length === 0) return null;

        return (
          <section key={category} className="app-section">
            <h2 className="app-section-title">{categoryLabels[category]}</h2>
            <div className="app-grid">
              {categoryServices.map((service) => (
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
              ))}
            </div>
          </section>
        );
      })}

      {services.length === 0 && (
        <p className="dashboard-empty">לא נבחרו שירותים עדיין.</p>
      )}
    </div>
  );
}
