import { useState } from 'react';
import CredentialModal from './CredentialModal';
import type { Credential } from './credentials';
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
  openDemo3FieldsAndFill,
  openDemoAndFill,
} from './pocAutofill';

interface DashboardProps {
  services: Service[];
  credentials: Record<string, Credential>;
  onSaveCredential: (serviceId: string, credential: Credential) => void;
  onDeleteCredential: (serviceId: string) => void;
  onAddMore: () => void;
}

function hasStoredCredentials(
  service: Service,
  credential?: Credential,
): boolean {
  if (!credential) return false;
  return getLoginFields(service).every((field) =>
    Boolean(credential[field.id]?.trim()),
  );
}

export default function Dashboard({
  services,
  credentials,
  onSaveCredential,
  onDeleteCredential,
  onAddMore,
}: DashboardProps) {
  const logos = useServiceLogos(services);
  const [editingService, setEditingService] = useState<Service | null>(null);

  function handleSave(credential: Credential) {
    if (!editingService) return;
    onSaveCredential(editingService.id, credential);
    setEditingService(null);
  }

  function handleDelete() {
    if (!editingService) return;
    onDeleteCredential(editingService.id);
    setEditingService(null);
  }

  function handleServiceOpen(service: Service) {
    window.open(getServiceOpenUrl(service), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>הכספת שלי</h1>
        <div className="dashboard-header-actions">
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
          <button type="button" className="add-more-btn" onClick={onAddMore}>
            ➕ הוסף שירותים נוספים
          </button>
        </div>
      </header>

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
                  hasCredentials={hasStoredCredentials(
                    service,
                    credentials[service.id],
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
          hasExisting={hasStoredCredentials(
            editingService,
            credentials[editingService.id],
          )}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setEditingService(null)}
        />
      )}
    </div>
  );
}
