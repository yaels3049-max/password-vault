import { useEffect, useState } from 'react';
import type { Credential } from './credentials';
import type { LoginField } from './mockServices';
import { TRUST_COPY, HubCredentialInput, TrustIndicator, VaultStateBadge } from './trust';

interface CredentialModalProps {
  serviceName: string;
  serviceId: string;
  loginFields: LoginField[];
  initial?: Credential;
  hasExisting: boolean;
  onSave: (credential: Credential) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onCancel: () => void;
  onLockVault?: () => void;
  vaultUnlocked?: boolean;
  error?: string | null;
}

function emptyValues(
  fields: LoginField[],
  initial?: Credential,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.id] = initial?.[field.id] ?? '';
  }
  return values;
}

export default function CredentialModal({
  serviceName,
  serviceId,
  loginFields,
  initial,
  hasExisting,
  onSave,
  onDelete,
  onCancel,
  onLockVault,
  vaultUnlocked = true,
  error = null,
}: CredentialModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    emptyValues(loginFields, initial),
  );
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setValues(emptyValues(loginFields, initial));
    setSuccessMessage(null);
  }, [initial, loginFields, serviceName]);

  function handleChange(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (successMessage) setSuccessMessage(null);
  }

  async function handleSubmit() {
    if (saving) return;
    const complete = loginFields.every((field) => values[field.id]?.trim());
    if (!complete) return;

    const credential: Credential = {};
    for (const field of loginFields) {
      credential[field.id] =
        field.type === 'password'
          ? values[field.id]
          : values[field.id].trim();
    }

    setSaving(true);
    setSuccessMessage(null);
    try {
      await onSave(credential);
      setSuccessMessage(
        hasExisting ? TRUST_COPY.updateSuccess : TRUST_COPY.saveSuccess,
      );
    } catch {
      // Caller may surface friendly error via `error` prop.
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving) return;
    setSaving(true);
    setSuccessMessage(null);
    try {
      await onDelete();
      setSuccessMessage(TRUST_COPY.deleteSuccess);
    } catch {
      // Caller may surface friendly error via `error` prop.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-management-trust-bar">
          <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
          <TrustIndicator />
        </div>
        <h2 className="modal-title">פרטי כניסה</h2>
        <p className="modal-subtitle">{serviceName}</p>
        {error && (
          <p className="modal-field-error" role="alert">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="modal-field-success" role="status">
            {successMessage}
          </p>
        )}
        {saving && (
          <p className="modal-field-progress" role="status">
            {TRUST_COPY.savingEncrypted}
          </p>
        )}
        {/* D-106-5: per-field assist — email/username browser help; password PM-hardened */}
        <form onSubmit={(e) => e.preventDefault()}>
          {loginFields.map((field, index) => (
            <label key={field.id} className="modal-field">
              <span>{field.label}</span>
              <HubCredentialInput
                serviceId={serviceId}
                fieldId={field.id}
                fieldType={field.type}
                value={values[field.id] ?? ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                autoFocus={index === 0}
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
            </label>
          ))}
          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-primary"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              שמור
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              ביטול
            </button>
          </div>
          {hasExisting && (
            <button
              type="button"
              className="modal-delete-btn"
              onClick={() => void handleDelete()}
              disabled={saving}
            >
              מחק פרטי כניסה
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
