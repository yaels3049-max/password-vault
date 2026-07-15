import { useEffect, useMemo, useRef, useState } from 'react';
import type { Credential } from './credentials';
import { hasCompleteCredentials } from './credentials';
import { copyCredentialField } from './loginAssistance/copyField';
import { IconClose, IconCopy, IconEye, IconEyeOff } from './loginAssistance/icons';
import type { AccessProfile } from './profile/accessProfileModel';
import type { LoginField, Service } from './mockServices';
import { runtimeCategoryLabels } from './mockServices';
import {
  HubCredentialInput,
  isFirstTimeSecurityTipDismissed,
  TRUST_COPY,
  VaultStateBadge,
} from './trust';
import { useServiceLogos } from './useServiceLogos';

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
  onDeleteProfile: (profileId: string) => void | Promise<void>;
  onClose: () => void;
  onLockVault?: () => void;
  error?: string | null;
  vaultUnlocked?: boolean;
}

type DiscardKind = 'close' | { switchTo: string } | null;
type ConfirmDeleteKind = 'credentials' | 'profile' | null;

const MSG_SAVE_OK = 'פרטי הכניסה נשמרו';
const MSG_SAVE_FAIL =
  'לא הצלחנו לשמור את השינויים. הפרטים שהזנת נשארו במסך.';
const MSG_EMPTY_PROFILE = 'עדיין לא נשמרו פרטי כניסה לפרופיל זה';
const MSG_COPY_PASSWORD = 'הסיסמה הועתקה';
const MSG_COPY_FIELD = 'הערך הועתק';
const MSG_COPY_FAIL = 'ההעתקה נכשלה. נסו שוב.';
const MSG_DIRTY_TITLE = 'השינויים עדיין לא נשמרו';
const MSG_DELETE_CREDS_TITLE = 'למחוק את פרטי הכניסה?';
const MSG_DELETE_CREDS_BODY =
  'פרטי הכניסה של הפרופיל הנבחר יימחקו מהכספת. אפשר יהיה להזין אותם מחדש בכל עת.';
const MSG_DELETE_PROFILE_TITLE = 'למחוק את הפרופיל?';
const MSG_DELETE_PROFILE_BODY =
  'הפרופיל ופרטי הכניסה שלו יימחקו. פעולה זו אינה ניתנת לביטול.';

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

function valuesEqual(
  fields: LoginField[],
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  return fields.every((field) => (a[field.id] ?? '') === (b[field.id] ?? ''));
}

function copyAriaLabel(field: LoginField): string {
  if (field.type === 'password') return 'העתקת סיסמה';
  return `העתקת ${field.label}`;
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
  const logoServices = useMemo(() => [service], [service]);
  const logos = useServiceLogos(logoServices);
  const logoSrc = logos[service.id];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName, 'he')),
    [profiles],
  );

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    () =>
      sortedProfiles.find((profile) => profile.isDefault)?.id ??
      sortedProfiles[0]?.id ??
      null,
  );
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>(
    {},
  );
  const [baselineValues, setBaselineValues] = useState<Record<string, string>>({});
  const [newProfileName, setNewProfileName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'ok' | 'err' | 'info'>('info');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DiscardKind>(null);
  const [deletePrompt, setDeletePrompt] = useState<ConfirmDeleteKind>(null);
  const [showCompactSecurity, setShowCompactSecurity] = useState(
    () => !isFirstTimeSecurityTipDismissed(),
  );
  const dirtyRef = useRef(false);

  const isMultiProfile = sortedProfiles.length > 1;
  const selectedProfile =
    sortedProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const dirty =
    selectedProfile != null &&
    !valuesEqual(loginFields, credentialValues, baselineValues);
  dirtyRef.current = dirty;
  const selectedHasCredentials = selectedProfile
    ? hasCompleteCredentials(credentials[selectedProfile.id], loginFields)
    : false;
  const canDeleteProfile = sortedProfiles.length > 1;
  const fieldsComplete = loginFields.every(
    (field) => credentialValues[field.id]?.trim(),
  );
  const categoryLabel =
    runtimeCategoryLabels[service.category] ?? service.category ?? '';

  function loadProfile(profile: AccessProfile | null) {
    if (!profile) {
      setCredentialValues(emptyValues(loginFields));
      setBaselineValues(emptyValues(loginFields));
      return;
    }
    const next = emptyValues(loginFields, credentials[profile.id]);
    setCredentialValues(next);
    setBaselineValues(next);
    setRenameValue(profile.displayName);
    setIsRenaming(false);
    setPasswordVisible(false);
    setStatusMessage(null);
  }

  useEffect(() => {
    if (sortedProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }
    if (
      !selectedProfileId ||
      !sortedProfiles.some((profile) => profile.id === selectedProfileId)
    ) {
      const fallback =
        sortedProfiles.find((profile) => profile.isDefault)?.id ??
        sortedProfiles[0]?.id ??
        null;
      setSelectedProfileId(fallback);
    }
  }, [sortedProfiles, selectedProfileId]);

  // Load credentials only when the selected profile changes — not on every parent
  // credentials/loginFields identity (that caused freeze / wiped typing).
  useEffect(() => {
    const profile =
      sortedProfiles.find((item) => item.id === selectedProfileId) ?? null;
    loadProfile(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profile isolation
  }, [selectedProfileId]);

  // Sync from vault when stored credentials for this profile change and the form is clean.
  const storedCredentialKey = selectedProfileId
    ? JSON.stringify(credentials[selectedProfileId] ?? null)
    : '';
  const loginFieldKey = loginFields.map((field) => field.id).join('|');

  useEffect(() => {
    if (!selectedProfileId || dirtyRef.current || saving) return;
    const next = emptyValues(loginFields, credentials[selectedProfileId]);
    setCredentialValues((prev) =>
      valuesEqual(loginFields, prev, next) ? prev : next,
    );
    setBaselineValues((prev) =>
      valuesEqual(loginFields, prev, next) ? prev : next,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by credential/field snapshots
  }, [storedCredentialKey, loginFieldKey, selectedProfileId, saving]);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  function handleCredentialChange(id: string, value: string) {
    setCredentialValues((prev) => ({ ...prev, [id]: value }));
    if (statusMessage) setStatusMessage(null);
  }

  function requestClose() {
    if (dirtyRef.current) {
      setDiscardPrompt('close');
      return;
    }
    onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (deletePrompt) {
          setDeletePrompt(null);
          return;
        }
        if (discardPrompt) {
          setDiscardPrompt(null);
          return;
        }
        requestClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deletePrompt, discardPrompt]);

  function requestSwitchProfile(nextId: string) {
    if (nextId === selectedProfileId) return;
    if (dirty) {
      setDiscardPrompt({ switchTo: nextId });
      return;
    }
    setSelectedProfileId(nextId);
  }

  function confirmDiscard() {
    if (discardPrompt === 'close') {
      setDiscardPrompt(null);
      onClose();
      return;
    }
    if (discardPrompt && typeof discardPrompt === 'object') {
      const next = discardPrompt.switchTo;
      setDiscardPrompt(null);
      setSelectedProfileId(next);
    }
  }

  async function handleSaveCredentials() {
    if (!selectedProfile || saving || !dirty || !fieldsComplete) return;

    const credential: Credential = {};
    for (const field of loginFields) {
      credential[field.id] =
        field.type === 'password'
          ? credentialValues[field.id]
          : credentialValues[field.id].trim();
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      await onSaveCredential(selectedProfile.id, credential);
      setBaselineValues({ ...credentialValues });
      setStatusTone('ok');
      setStatusMessage(MSG_SAVE_OK);
    } catch {
      setStatusTone('err');
      setStatusMessage(MSG_SAVE_FAIL);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCredentials() {
    if (!selectedProfile || saving) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      await onDeleteCredential(selectedProfile.id);
      const cleared = emptyValues(loginFields);
      setCredentialValues(cleared);
      setBaselineValues(cleared);
      setStatusTone('ok');
      setStatusMessage(TRUST_COPY.deleteSuccess);
    } catch {
      setStatusTone('err');
      setStatusMessage(MSG_SAVE_FAIL);
    } finally {
      setSaving(false);
      setDeletePrompt(null);
    }
  }

  async function handleDeleteProfile() {
    if (!selectedProfile || !canDeleteProfile) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      await onDeleteProfile(selectedProfile.id);
      setDeletePrompt(null);
    } catch {
      setStatusTone('err');
      setStatusMessage(MSG_SAVE_FAIL);
      setDeletePrompt(null);
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
    setShowAddProfile(false);
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRenameProfile(selectedProfile.id, trimmed);
    setIsRenaming(false);
  }

  async function handleCopy(field: LoginField) {
    const value = credentialValues[field.id] ?? '';
    if (!value) return;
    const result = await copyCredentialField(value);
    setCopiedFieldId(field.id);
    setStatusTone(result === 'ok' ? 'ok' : 'err');
    setStatusMessage(
      result === 'ok'
        ? field.type === 'password'
          ? MSG_COPY_PASSWORD
          : MSG_COPY_FIELD
        : MSG_COPY_FAIL,
    );
    window.setTimeout(() => {
      setCopiedFieldId((current) => (current === field.id ? null : current));
    }, 1600);
  }

  const surfaceError = error || (statusTone === 'err' ? statusMessage : null);
  const surfaceOk =
    !error && statusTone === 'ok' ? statusMessage : null;

  return (
    <div
      className="modal-overlay cd-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog cd-dialog"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cd-header">
          {/* RTL grid: title column (right), start cluster (left). Cluster DOM = badge then X → physical X | badge. */}
          <div className="cd-header-text">
            <h2 id="cd-title" className="cd-title">
              פרטי כניסה
            </h2>
          </div>
          <div className="cd-header-start">
            <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
            <button
              ref={closeBtnRef}
              type="button"
              className="cd-close"
              aria-label="סגירה"
              onClick={requestClose}
            >
              <IconClose />
            </button>
          </div>
        </header>

        <div className="cd-body">
          <div className="cd-identity">
            {logoSrc ? (
              <img
                className="cd-identity-icon"
                src={logoSrc}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="cd-identity-icon cd-identity-icon--letter" aria-hidden>
                {service.name.slice(0, 1)}
              </span>
            )}
            <div className="cd-identity-meta">
              <span className="cd-identity-name">{service.name}</span>
              {categoryLabel ? (
                <span className="cd-identity-category">{categoryLabel}</span>
              ) : null}
            </div>
          </div>

          {showCompactSecurity && (
            <div className="cd-security" role="note">
              <p>המידע שלכם מוגן — פרטי הכניסה נשמרים מוצפנים בכספת.</p>
              <button
                type="button"
                className="cd-security-dismiss"
                onClick={() => setShowCompactSecurity(false)}
              >
                הבנתי
              </button>
            </div>
          )}

          {selectedProfile && (
            <div className="cd-profiles" role="tablist" aria-label="פרופילים">
              {isMultiProfile ? (
                sortedProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    role="tab"
                    aria-selected={profile.id === selectedProfileId}
                    className={`cd-chip${
                      profile.id === selectedProfileId ? ' cd-chip--active' : ''
                    }`}
                    onClick={() => requestSwitchProfile(profile.id)}
                  >
                    {profile.displayName}
                    {profile.isDefault ? ' · ברירת מחדל' : ''}
                  </button>
                ))
              ) : (
                <span className="cd-chip cd-chip--active cd-chip--static">
                  {selectedProfile.displayName}
                </span>
              )}
            </div>
          )}

          {selectedProfile && isRenaming && (
            <form className="cd-rename" onSubmit={handleRenameSubmit} autoComplete="off">
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

          {surfaceError && (
            <p className="cd-banner cd-banner--err" role="alert">
              {surfaceError}
            </p>
          )}
          {surfaceOk && (
            <p className="cd-banner cd-banner--ok" role="status">
              {surfaceOk}
            </p>
          )}
          {saving && (
            <p className="cd-banner cd-banner--info" role="status">
              {TRUST_COPY.savingEncrypted}
            </p>
          )}

          {selectedProfile && (
            <div className="cd-fields">
              {!selectedHasCredentials && !dirty && (
                <p className="cd-empty">{MSG_EMPTY_PROFILE}</p>
              )}

              {loginFields.map((field) => {
                const isPassword = field.type === 'password';
                return (
                  <label key={field.id} className="cd-field">
                    <span className="cd-field-label">{field.label}</span>
                    <div className="cd-field-row">
                      <HubCredentialInput
                        serviceId={service.id}
                        fieldId={field.id}
                        fieldType={field.type}
                        revealAsText={isPassword && passwordVisible}
                        value={credentialValues[field.id] ?? ''}
                        onChange={(e) =>
                          handleCredentialChange(field.id, e.target.value)
                        }
                        disabled={saving}
                        className="cd-field-input"
                      />
                      {isPassword && (
                        <button
                          type="button"
                          className="cd-icon-btn"
                          aria-label={
                            passwordVisible ? 'הסתרת סיסמה' : 'הצגת סיסמה'
                          }
                          aria-pressed={passwordVisible}
                          onClick={() => setPasswordVisible((v) => !v)}
                          disabled={saving}
                        >
                          {passwordVisible ? (
                            <IconEyeOff />
                          ) : (
                            <IconEye open={false} />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="cd-icon-btn"
                        aria-label={copyAriaLabel(field)}
                        onClick={() => void handleCopy(field)}
                        disabled={saving || !(credentialValues[field.id] ?? '').trim()}
                      >
                        <IconCopy copied={copiedFieldId === field.id} />
                      </button>
                    </div>
                  </label>
                );
              })}

              <button
                type="button"
                className="cd-save"
                onClick={() => void handleSaveCredentials()}
                disabled={saving || !dirty || !fieldsComplete}
              >
                {saving ? 'שומר…' : 'שמירת שינויים'}
              </button>

              <div className="cd-secondary-actions">
                {selectedProfile && !selectedProfile.isDefault && (
                  <button
                    type="button"
                    className="cd-secondary-btn"
                    onClick={() => onSetDefaultProfile(selectedProfile.id)}
                    disabled={saving}
                  >
                    קבע כברירת מחדל
                  </button>
                )}
                {selectedProfile && !isRenaming && (
                  <button
                    type="button"
                    className="cd-secondary-btn"
                    onClick={() => setIsRenaming(true)}
                    disabled={saving}
                  >
                    שינוי שם פרופיל
                  </button>
                )}
                {selectedHasCredentials && (
                  <button
                    type="button"
                    className="cd-secondary-btn cd-secondary-btn--danger"
                    onClick={() => setDeletePrompt('credentials')}
                    disabled={saving}
                  >
                    מחיקת פרטי כניסה
                  </button>
                )}
                {canDeleteProfile && selectedProfile && (
                  <button
                    type="button"
                    className="cd-secondary-btn cd-secondary-btn--danger"
                    onClick={() => setDeletePrompt('profile')}
                    disabled={saving}
                  >
                    מחיקת פרופיל
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="cd-add">
            {!showAddProfile ? (
              <button
                type="button"
                className="cd-add-toggle"
                onClick={() => setShowAddProfile(true)}
              >
                + הוספת פרופיל נוסף
              </button>
            ) : (
              <form
                className="cd-add-form"
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
                  הוספה
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={() => {
                    setShowAddProfile(false);
                    setNewProfileName('');
                  }}
                >
                  ביטול
                </button>
              </form>
            )}
          </div>
        </div>

        {discardPrompt && (
          <div className="cd-confirm" role="alertdialog" aria-labelledby="cd-dirty-title">
            <h3 id="cd-dirty-title">{MSG_DIRTY_TITLE}</h3>
            <p>לצאת בלי לשמור את השינויים?</p>
            <div className="cd-confirm-actions">
              <button
                type="button"
                className="modal-btn modal-btn-primary"
                onClick={() => setDiscardPrompt(null)}
              >
                המשך עריכה
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={confirmDiscard}
              >
                יציאה ללא שמירה
              </button>
            </div>
          </div>
        )}

        {deletePrompt && (
          <div className="cd-confirm" role="alertdialog" aria-labelledby="cd-del-title">
            <h3 id="cd-del-title">
              {deletePrompt === 'credentials'
                ? MSG_DELETE_CREDS_TITLE
                : MSG_DELETE_PROFILE_TITLE}
            </h3>
            <p>
              {deletePrompt === 'credentials'
                ? MSG_DELETE_CREDS_BODY
                : MSG_DELETE_PROFILE_BODY}
            </p>
            <div className="cd-confirm-actions">
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={() => setDeletePrompt(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="cd-delete-confirm"
                onClick={() => {
                  if (deletePrompt === 'credentials') {
                    void handleDeleteCredentials();
                  } else {
                    void handleDeleteProfile();
                  }
                }}
              >
                מחיקה
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
