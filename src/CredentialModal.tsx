import { useEffect, useState } from 'react';
import type { Credential } from './credentials';
import type { LoginField } from './mockServices';

interface CredentialModalProps {
  serviceName: string;
  loginFields: LoginField[];
  initial?: Credential;
  hasExisting: boolean;
  onSave: (credential: Credential) => void;
  onDelete: () => void;
  onCancel: () => void;
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
  loginFields,
  initial,
  hasExisting,
  onSave,
  onDelete,
  onCancel,
}: CredentialModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    emptyValues(loginFields, initial),
  );

  useEffect(() => {
    setValues(emptyValues(loginFields, initial));
  }, [initial, loginFields, serviceName]);

  function handleChange(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const complete = loginFields.every((field) => values[field.id]?.trim());
    if (!complete) return;

    const credential: Credential = {};
    for (const field of loginFields) {
      credential[field.id] =
        field.type === 'password'
          ? values[field.id]
          : values[field.id].trim();
    }
    onSave(credential);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">פרטי כניסה</h2>
        <p className="modal-subtitle">{serviceName}</p>
        <form onSubmit={handleSubmit}>
          {loginFields.map((field, index) => (
            <label key={field.id} className="modal-field">
              <span>{field.label}</span>
              <input
                type={field.type}
                value={values[field.id] ?? ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                autoFocus={index === 0}
                autoComplete={field.type === 'password' ? 'current-password' : 'username'}
              />
            </label>
          ))}
          <div className="modal-actions">
            <button type="submit" className="modal-btn modal-btn-primary">
              שמור
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onCancel}
            >
              ביטול
            </button>
          </div>
          {hasExisting && (
            <button
              type="button"
              className="modal-delete-btn"
              onClick={onDelete}
            >
              מחק פרטי כניסה
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
