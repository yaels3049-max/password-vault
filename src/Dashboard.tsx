import { useState } from 'react';

import CredentialModal from './CredentialModal';

import type { Credential } from './credentials';

import { isCustomServiceId } from './catalog';

import {

  categories,

  categoryLabels,

  getLoginFields,

  getServiceOpenUrl,

  type Service,

} from './mockServices';

import Tile from './Tile';

import { useServiceLogos } from './useServiceLogos';

import {

  HTZONE_SERVICE_ID,

  hasCompleteCredentials,

  isExtensionAvailable,

  isHubPracticeService,

  isPocControlsVisible,

  openDemo3FieldsAndFill,

  openDemoAndFill,

  openHtzoneTile,

  openIsraeliSiteAutofillTest,

  openPracticeLoginFromTile,

  openShufersalLoginFromTile,

  openClalitLoginFromTile,

  CLALIT_SERVICE_ID,

  SHUFERSAL_SERVICE_ID,

} from './pocAutofill';



interface DashboardProps {

  services: Service[];

  credentials: Record<string, Credential>;

  showMagicMomentHint: boolean;

  onDismissMagicMomentHint: () => void;

  onSaveCredential: (serviceId: string, credential: Credential) => void;

  onDeleteCredential: (serviceId: string) => void;

  onAddMore: () => void;

}



export default function Dashboard({

  services,

  credentials,

  showMagicMomentHint,

  onDismissMagicMomentHint,

  onSaveCredential,

  onDeleteCredential,

  onAddMore,

}: DashboardProps) {

  const logos = useServiceLogos(services);

  const [editingService, setEditingService] = useState<Service | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showPocControls = isPocControlsVisible();

  const extensionAvailable = isExtensionAvailable();

  const hasPracticeService = services.some((service) =>

    isHubPracticeService(service),

  );

  const showExtensionBanner =

    !extensionAvailable && (hasPracticeService || showMagicMomentHint);



  function clearStatusSoon(message: string) {

    setStatusMessage(message);

    window.setTimeout(() => {

      setStatusMessage((current) => (current === message ? null : current));

    }, 8000);

  }



  function handleSave(credential: Credential) {

    if (!editingService) return;

    const hadCredentials = hasCompleteCredentials(

      credentials[editingService.id],

      getLoginFields(editingService),

    );

    onSaveCredential(editingService.id, credential);

    setEditingService(null);

    onDismissMagicMomentHint();



    if (!hadCredentials) {

      clearStatusSoon(

        'פרטי הכניסה נשמרו. לחצו על האייקון כדי לפתוח ולמלא — והשלימו את ההתחברות בעצמכם.',

      );

    } else {

      clearStatusSoon('פרטי הכניסה עודכנו.');

    }

  }



  function handleDelete() {

    if (!editingService) return;

    onDeleteCredential(editingService.id);

    setEditingService(null);

  }



  function handleServiceOpen(service: Service) {

    onDismissMagicMomentHint();



    if (service.id === HTZONE_SERVICE_ID) {

      openHtzoneTile(credentials);

      return;

    }



    if (service.id === SHUFERSAL_SERVICE_ID) {

      const loginFields = getLoginFields(service);

      const stored = credentials[service.id];



      if (!hasCompleteCredentials(stored, loginFields)) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      const result = openShufersalLoginFromTile(stored, loginFields);



      if (!result.ok) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      if (!result.extensionUsed) {

        clearStatusSoon(

          'דף ההתחברות נפתח. התקינו את תוסף הדפדפן כדי לאפשר מילוי אוטומטי.',

        );

      }



      return;

    }



    if (service.id === CLALIT_SERVICE_ID) {

      const loginFields = getLoginFields(service);

      const stored = credentials[service.id];



      if (!hasCompleteCredentials(stored, loginFields)) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      const result = openClalitLoginFromTile(stored, loginFields);



      if (!result.ok) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      if (!result.extensionUsed) {

        clearStatusSoon(

          'דף ההתחברות נפתח. התקינו את תוסף הדפדפן כדי לאפשר מילוי אוטומטי.',

        );

      }



      return;

    }



    if (isHubPracticeService(service)) {

      console.log('[Practice] Practice tile clicked');

      const loginFields = getLoginFields(service);

      const stored = credentials[service.id];



      if (!hasCompleteCredentials(stored, loginFields)) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      const result = openPracticeLoginFromTile(stored, loginFields);



      if (!result.ok) {

        setEditingService(service);

        clearStatusSoon('שמרו פרטי כניסה לפני הפתיחה.');

        return;

      }



      if (!result.extensionUsed) {

        clearStatusSoon(

          'דף ההתחברות נפתח. התקינו את תוסף הדפדפן כדי לאפשר מילוי אוטומטי.',

        );

      }



      return;

    }



    if (isCustomServiceId(service.id)) {

      window.open(getServiceOpenUrl(service), '_blank', 'noopener,noreferrer');

      return;

    }



    window.open(getServiceOpenUrl(service), '_blank', 'noopener,noreferrer');

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

                <p className="poc-fill-note">

                  בדיקת מילוי אוטומטי - דמו מקומי בלבד

                </p>

              </div>

              <div className="poc-fill-wrap">

                <button

                  type="button"

                  className="poc-fill-btn poc-fill-btn--il"

                  onClick={openIsraeliSiteAutofillTest}

                >

                  בדיקת מילוי באתר ישראלי

                </button>

                <p className="poc-fill-note">

                  הייטקזון - mock בלבד, ללא שליחת טופס

                </p>

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

            {hasPracticeService ? (

              <>

                לחצו <strong>פרטי כניסה</strong> לשמירת פרטי הכניסה, ואז לחצו על{' '}

                <strong>תרגול התחברות</strong> לפתיחת דף ההתחברות. השלימו את ההתחברות

                בעצמכם.

              </>

            ) : (

              <>

                לחצו <strong>פרטי כניסה</strong> לשמירת פרטי הכניסה, ואז לחצו על האייקון

                לפתיחת השירות.

              </>

            )}

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

                  onOpen={() => handleServiceOpen(service)}

                  onEditCredentials={() => setEditingService(service)}

                />

              ))}

            </div>

          </section>

        );

      })}



      {services.length === 0 && (

        <p className="dashboard-empty">לא נבחרו שירותים עדיין.</p>

      )}



      {editingService && (

        <CredentialModal

          serviceName={editingService.name}

          loginFields={getLoginFields(editingService)}

          initial={credentials[editingService.id]}

          hasExisting={hasCompleteCredentials(

            credentials[editingService.id],

            getLoginFields(editingService),

          )}

          onSave={handleSave}

          onDelete={handleDelete}

          onCancel={() => setEditingService(null)}

        />

      )}

    </div>

  );

}


