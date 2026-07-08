import { useEffect, useMemo, useState } from 'react';
import type { Credential } from './credentials';
import type { AccessProfile } from './profile/accessProfileModel';
import { hasCompleteCredentials } from './credentials';
import type { LoginField, Service } from './mockServices';
import {
  HubCredentialInput,
  isFirstTimeSecurityTipDismissed,
  SecurityExplanationBanner,
  TRUST_COPY,
  TrustIndicator,
  VaultStateBadge,
} from './trust';

interface ServiceProfileManagementModalProps {
  service: Service;
  loginFields: LoginField[];
  profiles: AccessProfile[];
  credentials: Record<string, Credential>;
  onSaveCredential: (profileId: string, credential: Credential) => Promise<void>;
  onDeleteCredential: (profileId: string) => Promise<void>;
  onAddProfile: (displayName: string) => void;
  onRenameProfile: (profileId: string, displayName: string) => void;
  onSetDefaultProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onClose: () => void;
  onLockVault?: () => void;
  error?: string | null;
  /** True when credential existed before this edit (updates vs first save). */
  vaultUnlocked?: boolean;
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
  onLockVault,
  error = null,
  vaultUnlocked = true,
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
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSecurityTip, setShowSecurityTip] = useState(
    () => !isFirstTimeSecurityTipDismissed(),
  );

  const isMultiProfile = sortedProfiles.length > 1;

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
    setSuccessMessage(null);
  }, [selectedProfile, loginFields, credentials]);

  function handleCredentialChange(id: string, value: string) {
    setCredentialValues((prev) => ({ ...prev, [id]: value }));
    if (successMessage) setSuccessMessage(null);
  }

  async function handleSaveCredentials() {
    if (!selectedProfile || saving) return;

    const complete = loginFields.every((field) => credentialValues[field.id]?.trim());
    if (!complete) return;

    const hadExisting = hasCompleteCredentials(
      credentials[selectedProfile.id],
      loginFields,
    );

    const credential: Credential = {};
    for (const field of loginFields) {
      credential[field.id] =
        field.type === 'password'
          ? credentialValues[field.id]
          : credentialValues[field.id].trim();
    }

    setSaving(true);
    setSuccessMessage(null);
    try {
      await onSaveCredential(selectedProfile.id, credential);
      setSuccessMessage(hadExisting ? TRUST_COPY.updateSuccess : TRUST_COPY.saveSuccess);
    } catch {
      // Friendly error is surfaced via `error` prop from ManageServices.
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCredentials() {
    if (!selectedProfile || saving) return;
    setSaving(true);
    setSuccessMessage(null);
    try {
      await onDeleteCredential(selectedProfile.id);
      setSuccessMessage(TRUST_COPY.deleteSuccess);
    } catch {
      // Friendly error via `error` prop.
    } finally {
      setSaving(false);
    }
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
        <div className="profile-management-trust-bar">
          <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
          <TrustIndicator />
        </div>

        <h2 className="modal-title">
          {isMultiProfile ? 'פרופילים ופרטי כניסה' : 'פרטי כניסה'}
        </h2>
        <p className="modal-subtitle">{service.name}</p>

        {showSecurityTip && (
          <SecurityExplanationBanner onDismiss={() => setShowSecurityTip(false)} />
        )}

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

        {isMultiProfile && (
          <section className="profile-management-section">
            <h3 className="profile-management-heading">ניהול פרופילים</h3>
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

            <form className="profile-management-add" onSubmit={handleAddProfile} autoComplete="off">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="שם פרופיל חדש"
                aria-label="שם פרופיל חדש"
                autoComplete="off"
              />
              <button type="submit" className="modal-btn modal-btn-secondary">
                הוספת פרופיל נוסף
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
                  <form
                    className="profile-management-rename"
                    onSubmit={handleRenameSubmit}
                    autoComplete="off"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      aria-label="שם פרופיל"
                      autoComplete="off"
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
        )}

        {selectedProfile && (
          <section className="profile-management-section">
            <h3 className="profile-management-heading">
              {isMultiProfile ? `פרטי כניסה — ${selectedProfile.displayName}` : 'פרטי כניסה'}
            </h3>
            {/* D-106-5: per-field assist — email/username browser help; password PM-hardened. */}
            <form onSubmit={(e) => e.preventDefault()}>
              {loginFields.map((field, index) => (
                <label key={field.id} className="modal-field">
                  <span>{field.label}</span>
                  <HubCredentialInput
                    serviceId={service.id}
                    fieldId={field.id}
                    fieldType={field.type}
                    value={credentialValues[field.id] ?? ''}
                    onChange={(e) => handleCredentialChange(field.id, e.target.value)}
                    autoFocus={index === 0}
                    disabled={saving}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSaveCredentials();
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
                  onClick={() => void handleSaveCredentials()}
                >
                  שמור פרטי כניסה
                </button>
              </div>
              {selectedHasCredentials && (
                <button
                  type="button"
                  className="modal-delete-btn"
                  onClick={() => void handleDeleteCredentials()}
                  disabled={saving}
                >
                  מחק פרטי כניסה
                </button>
              )}
            </form>
          </section>
        )}

        {!isMultiProfile && (
          <section className="profile-management-section profile-management-advanced">
            {!showAddProfile ? (
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={() => setShowAddProfile(true)}
              >
                הוספת פרופיל נוסף
              </button>
            ) : (
              <form
                className="profile-management-add"
                onSubmit={handleAddProfile}
                autoComplete="off"
              >
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="שם פרופיל חדש"
                  aria-label="שם פרופיל חדש"
                  autoComplete="off"
                />
                <button type="submit" className="modal-btn modal-btn-secondary">
                  הוספת פרופיל נוסף
                </button>
              </form>
            )}
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
