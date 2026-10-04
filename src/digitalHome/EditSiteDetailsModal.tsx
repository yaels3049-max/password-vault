import { useRef, useState } from 'react';
import AddSiteModal, { type AddSiteFormValues } from '../AddSiteModal';
import { defaultSameAsWebsite } from '../catalog/explicitLoginEntry';
import type { Service, ServiceCategory } from '../mockServices';
import type { ServiceDefinition } from '../service/serviceModel';
import { toFriendlySecurityError } from '../trust';
import { buildCustomSiteDefinition } from './customSiteForm';

export interface EditSiteDetailsModalProps {
  /** Runtime service shown on the tile. */
  service: Service;
  /** The user's own definition from vault `customServices` (AD-123-14). */
  definition?: ServiceDefinition;
  categories: ServiceCategory[];
  onSave: (definition: ServiceDefinition) => Promise<void>;
  onClose: () => void;
}

/** AD-123-14 — «עריכת פרטי האתר»: the existing AddSiteModal edit flow. */
export default function EditSiteDetailsModal({
  service,
  definition,
  categories,
  onSave,
  onClose,
}: EditSiteDetailsModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inFlightRef = useRef(false);

  async function handleSave(values: AddSiteFormValues) {
    if (inFlightRef.current || isSaving) return;
    inFlightRef.current = true;
    try {
      const next = buildCustomSiteDefinition(values, {
        id: service.id,
        metadata: definition?.metadata ?? service.metadata,
      });
      setError(null);
      setIsSaving(true);
      await onSave(next);
      onClose();
    } catch (saveError) {
      setIsSaving(false);
      setError(toFriendlySecurityError(saveError));
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <AddSiteModal
      mode="edit"
      onAdd={handleSave}
      onCancel={() => {
        if (!isSaving) onClose();
      }}
      categoryOptions={categories}
      error={error}
      isSaving={isSaving}
      initialDisplayName={service.name}
      initialPrimaryUrl={service.url}
      initialCategory={service.category}
      initialSameAsWebsite={defaultSameAsWebsite(service.loginUrl, service.url)}
      initialLoginUrl={service.loginUrl ?? ''}
    />
  );
}
