import { useState } from 'react';
import AddSiteModal from './AddSiteModal';
import { createCustomServiceDefinition, discoverLoginForCustomService } from './catalog';
import {
  categories,
  categoryLabels,
  categoryQuestions,
  type Service,
  type ServiceCategory,
} from './mockServices';
import type { ServiceDefinition } from './service/serviceModel';

interface ManageServicesProps {
  allServices: Service[];
  selectedIds: Set<string>;
  isFirstRun: boolean;
  onToggle: (id: string) => void;
  onAddCustom: (definition: ServiceDefinition) => void;
  onContinue: () => void;
}

export default function ManageServices({
  allServices,
  selectedIds,
  isFirstRun,
  onToggle,
  onAddCustom,
  onContinue,
}: ManageServicesProps) {
  const [modalCategory, setModalCategory] = useState<ServiceCategory | null>(
    null,
  );
  const [addError, setAddError] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [discoveryOutcome, setDiscoveryOutcome] = useState<'success' | 'failure' | null>(
    null,
  );

  function openAddModal(category: ServiceCategory) {
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
    setModalCategory(category);
  }

  function dismissAddModal() {
    setModalCategory(null);
    setAddError(null);
    setDiscoveryMessage(null);
    setDiscoveryOutcome(null);
    setIsDiscovering(false);
  }

  function closeAddModal() {
    if (isDiscovering) {
      return;
    }

    dismissAddModal();
  }

  async function handleAddCustomSite(displayName: string, primaryUrl: string) {
    if (!modalCategory || isDiscovering) return;

    try {
      const definition = createCustomServiceDefinition({
        displayName,
        primaryUrl,
        category: modalCategory,
      });

      setAddError(null);
      setDiscoveryMessage(null);
      setDiscoveryOutcome(null);
      setIsDiscovering(true);

      const { definition: finalDefinition, outcome } =
        await discoverLoginForCustomService(definition, { primaryUrl });

      onAddCustom(finalDefinition);
      setDiscoveryMessage(outcome.message);
      setDiscoveryOutcome(outcome.status);
      setIsDiscovering(false);

      window.setTimeout(() => {
        dismissAddModal();
      }, 1800);
    } catch (error) {
      setIsDiscovering(false);
      setAddError(error instanceof Error ? error.message : 'לא ניתן להוסיף את האתר');
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        {isFirstRun ? (
          <>
            <h1>בואו נתחיל עם שירות אחד</h1>
            <p>
              בחרו שירות אחד להתחלה — מספיק לבחור מאחת הקטגוריות למטה.
              אפשר להוסיף עוד שירותים בכל עת מהלוח הבקרה.
            </p>
          </>
        ) : (
          <>
            <h1>ניהול השירותים שלי</h1>
            <p>בחרו את השירותים שאתם משתמשים בהם</p>
          </>
        )}
      </header>

        {isFirstRun && (
        <p className="onboarding-first-run-note">
          אין צורך לבחור מכל הקטגוריות. שירות אחד מספיק כדי להתחיל.
          <strong>תרגול התחברות</strong> כבר נבחר — אפשר להמשיך או לבחור שירות אחר.
        </p>
      )}

      {categories.map((category) => {
        const services = allServices.filter((s) => s.category === category);

        return (
          <section key={category} className="category-card">
            <h2>{categoryLabels[category]}</h2>
            <p className="category-question">{categoryQuestions[category]}</p>
            <ul className="checkbox-list">
              {services.map((service) => (
                <li key={service.id}>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(service.id)}
                      onChange={() => onToggle(service.id)}
                    />
                    <span>{service.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {category !== 'practice' && (
              <button
                type="button"
                className="add-custom-btn"
                onClick={() => openAddModal(category)}
              >
                ➕ הוסף אתר משלי
              </button>
            )}
          </section>
        );
      })}

      <footer className="onboarding-footer">
        {isFirstRun && selectedCount === 1 && (
          <p className="onboarding-footer-hint">נבחר שירות אחד — אפשר להמשיך.</p>
        )}
        {isFirstRun && selectedCount > 1 && (
          <p className="onboarding-footer-hint">
            נבחרו {selectedCount} שירותים — אפשר להמשיך או להוסיף עוד מאוחר יותר.
          </p>
        )}
        <button type="button" className="finish-btn" onClick={onContinue}>
          המשך
        </button>
      </footer>

      {modalCategory && (
        <AddSiteModal
          onAdd={handleAddCustomSite}
          onCancel={closeAddModal}
          error={addError}
          isDiscovering={isDiscovering}
          discoveryMessage={discoveryMessage}
          discoveryOutcome={discoveryOutcome}
        />
      )}
    </div>
  );
}
