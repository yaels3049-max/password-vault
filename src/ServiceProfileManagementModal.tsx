import { useEffect, useMemo, useState } from 'react';
import type { Credential } from './credentials';
import type { AccessProfile } from './profile/accessProfileModel';
import { hasCompleteCredentials } from './credentials';
import type { LoginField, Service } from './mockServices';
interface ServiceProfileManagementModalProps {
  service: Service;
  loginFields: LoginField[];
  profiles: AccessProfile[];
  credentials: Record<string, Credential>;
  onSaveCredential: (profileId: string, credential: Credential) => void;
  onDeleteCredential: (profileId: string) => void;
  onAddProfile: (displayName: string) => void;
  onRenameProfile: (profileId: string, displayName: string) => void;
  onSetDefaultProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onClose: () => void;
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

export default function ServiceProfileManagementModal({
  service,
  loginFields,
  profiles,
  credentials,
  onSaveCredential,
  onDeleteCredential,
  onAddProfile,
  onRenameProfile,
  onSetDefaultProfile,
  onDeleteProfile,
  onClose,
  error = null,
}: ServiceProfileManagementModalProps) {
  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName, 'he')),
    [profiles],
  );

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    () => sortedProfiles.find((profile) => profile.isDefault)?.id ?? sortedProfiles[0]?.id ?? null,
  );
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [newProfileName, setNewProfileName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const selectedProfile =
    sortedProfiles.find((profile) => profile.id === selectedProfileId) ?? null;

  useEffect(() => {
    if (sortedProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    if (!selectedProfileId || !sortedProfiles.some((profile) => profile.id === selectedProfileId)) {
      const fallback =
        sortedProfiles.find((profile) => profile.isDefault)?.id ?? sortedProfiles[0]?.id ?? null;
      setSelectedProfileId(fallback);
    }
  }, [sortedProfiles, selectedProfileId]);

  useEffect(() => {
    if (!selectedProfile) {
      setCredentialValues(emptyValues(loginFields));
      return;
    }

    setCredentialValues(emptyValues(loginFields, credentials[selectedProfile.id]));
    setRenameValue(selectedProfile.displayName);
    setIsRenaming(false);
  }, [selectedProfile, loginFields, credentials]);

  function handleCredentialChange(id: string, value: string) {
    setCredentialValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;

    const complete = loginFields.every((field) => credentialValues[field.id]?.trim());
    if (!complete) return;

    const credential: Credential = {};
    for (const field of loginFields) {
      credential[field.id] =
        field.type === 'password'
          ? credentialValues[field.id]
          : credentialValues[field.id].trim();
    }

    onSaveCredential(selectedProfile.id, credential);
  }

  function handleDeleteCredentials() {
    if (!selectedProfile) return;
    onDeleteCredential(selectedProfile.id);
  }

  function handleAddProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    onAddProfile(trimmed);
    setNewProfileName('');
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRenameProfile(selectedProfile.id, trimmed);
    setIsRenaming(false);
  }

  const selectedHasCredentials = selectedProfile
    ? hasCompleteCredentials(credentials[selectedProfile.id], loginFields)
    : false;

  const canDeleteProfile = sortedProfiles.length > 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog profile-management-dialog"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">פרופילים ופרטי כניסה</h2>
        <p className="modal-subtitle">{service.name}</p>

        {error && (
          <p className="modal-field-error" role="alert">
            {error}
          </p>
        )}

        <section className="profile-management-section">
          <h3 className="profile-management-heading">פרופילי גישה</h3>
          <ul className="profile-management-list">
            {sortedProfiles.map((profile) => (
              <li key={profile.id}>
                <label className="profile-management-item">
                  <input
                    type="radio"
                    name={`profile-${service.id}`}
                    checked={selectedProfileId === profile.id}
                    onChange={() => setSelectedProfileId(profile.id)}
                  />
                  <span className="profile-management-item-label">
                    {profile.displayName}
                    {profile.isDefault && (
                      <span className="profile-default-badge">ברירת מחדל</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <form className="profile-management-add" onSubmit={handleAddProfile}>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="שם פרופיל חדש"
              aria-label="שם פרופיל חדש"
            />
            <button type="submit" className="modal-btn modal-btn-secondary">
              הוסף פרופיל
            </button>
          </form>

          {selectedProfile && (
            <div className="profile-management-actions">
              {!isRenaming ? (
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={() => setIsRenaming(true)}
                >
                  שנה שם
                </button>
              ) : (
                <form className="profile-management-rename" onSubmit={handleRenameSubmit}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label="שם פרופיל"
                  />
                  <button type="submit" className="modal-btn modal-btn-secondary">
                    שמור שם
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-secondary"
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameValue(selectedProfile.displayName);
                    }}
                  >
                    ביטול
                  </button>
                </form>
              )}

              {!selectedProfile.isDefault && (
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={() => onSetDefaultProfile(selectedProfile.id)}
                >
                  קבע כברירת מחדל
                </button>
              )}

              {canDeleteProfile && (
                <button
                  type="button"
                  className="modal-delete-btn profile-management-delete"
                  onClick={() => onDeleteProfile(selectedProfile.id)}
                >
                  מחק פרופיל
                </button>
              )}
            </div>
          )}
        </section>

        {selectedProfile && (
          <section className="profile-management-section">
            <h3 className="profile-management-heading">
              פרטי כניסה — {selectedProfile.displayName}
            </h3>
            <form onSubmit={handleSaveCredentials}>
              {loginFields.map((field, index) => (
                <label key={field.id} className="modal-field">
                  <span>{field.label}</span>
                  <input
                    type={field.type}
                    value={credentialValues[field.id] ?? ''}
                    onChange={(e) => handleCredentialChange(field.id, e.target.value)}
                    autoFocus={index === 0}
                    autoComplete={
                      field.type === 'password' ? 'current-password' : 'username'
                    }
                  />
                </label>
              ))}
              <div className="modal-actions">
                <button type="submit" className="modal-btn modal-btn-primary">
                  שמור פרטי כניסה
                </button>
              </div>
              {selectedHasCredentials && (
                <button
                  type="button"
                  className="modal-delete-btn"
                  onClick={handleDeleteCredentials}
                >
                  מחק פרטי כניסה
                </button>
              )}
            </form>
          </section>
        )}

        <div className="modal-actions profile-management-close">
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
