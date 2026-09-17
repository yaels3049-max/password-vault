import { useEffect, useMemo, useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import { updateGlobalRegistryRow } from './adminRegistryApi';
import {
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  originFromHttpsLoginEntry,
  readAutofillProfileFromMetadata,
  validateAutofillProfileStructural,
  type AutofillFieldMapping,
  type AutofillProfileAction,
  type AutofillSupportState,
} from '../autofill/validatedProfile';
import { classifyStoredLoginFields } from '../service/credentialSchema';
import {
  analyzeLoginPageForMapping,
  ANALYZE_LOGIN_PAGE_LABEL_HE,
  ANALYZING_LOGIN_PAGE_LABEL_HE,
  NOT_CONFIDENTLY_MAPPED_LABEL_HE,
} from '../assistedMapping';

interface AutofillProfileEditorProps {
  row: AdminRegistryRow;
  onSaved: () => Promise<void>;
}

function supportLabel(state: AutofillSupportState | null): string {
  if (!state) {
    return AUTOFILL_SUPPORT_STATE_LABEL_HE.not_configured;
  }
  return AUTOFILL_SUPPORT_STATE_LABEL_HE[state];
}

function serializeMappings(mappings: AutofillFieldMapping[]): string {
  const meaningful = mappings.filter((mapping) => mapping.locator.trim());
  if (meaningful.length === 0) {
    return '';
  }
  return meaningful
    .map((mapping) => `${mapping.fieldId}|${mapping.locatorType}|${mapping.locator}`)
    .sort()
    .join(';');
}

export default function AutofillProfileEditor({ row, onSaved }: AutofillProfileEditorProps) {
  const stored = classifyStoredLoginFields(row.login_fields);
  const fields = stored.status === 'valid' ? stored.fields : [];
  const existing = readAutofillProfileFromMetadata(row.metadata);
  const loginEntryUrl = (row.login_url ?? '').trim();
  const serviceDisplayName = row.display_name.trim() || 'האתר';

  const [locators, setLocators] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const mapping of existing?.fieldMappings ?? []) {
      initial[mapping.fieldId] = mapping.locator;
    }
    return initial;
  });
  const [unmappedFieldIds, setUnmappedFieldIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    const profile = readAutofillProfileFromMetadata(row.metadata);
    for (const mapping of profile?.fieldMappings ?? []) {
      next[mapping.fieldId] = mapping.locator;
    }
    setLocators(next);
    setUnmappedFieldIds([]);
  }, [row.id, row.updated_at]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const fieldMappings: AutofillFieldMapping[] = useMemo(
    () =>
      fields.map((field) => ({
        fieldId: field.id,
        locatorType: 'css' as const,
        locator: (locators[field.id] ?? '').trim(),
      })),
    [fields, locators],
  );

  const savedMappingsSignature = useMemo(
    () => (existing ? serializeMappings(existing.fieldMappings) : ''),
    [existing],
  );
  const currentMappingsSignature = useMemo(
    () => serializeMappings(fieldMappings),
    [fieldMappings],
  );
  const hasUnsavedChanges = currentMappingsSignature !== savedMappingsSignature;
  const formHasAnyLocator = fieldMappings.some((mapping) => mapping.locator.trim());
  const formIsEmpty = !formHasAnyLocator;

  if (fields.length === 0) {
    return null;
  }

  const allowedOrigin = originFromHttpsLoginEntry(loginEntryUrl) ?? '';
  const structural = validateAutofillProfileStructural(
    { fieldMappings, loginEntryUrl, allowedOrigin },
    { loginFields: row.login_fields, loginUrl: row.login_url },
  );

  /** DEV-only Operator M8 path. Production builds keep activate gated. */
  const operatorFunctionalActivateAllowed = import.meta.env.DEV === true;

  const canAnalyze =
    !saving &&
    !analyzing &&
    fields.length > 0 &&
    Boolean(originFromHttpsLoginEntry(loginEntryUrl));
  const canSave =
    !saving &&
    !analyzing &&
    hasUnsavedChanges &&
    (structural.ok || (formIsEmpty && Boolean(existing)));
  const canApprove =
    !saving &&
    !analyzing &&
    operatorFunctionalActivateAllowed &&
    Boolean(existing) &&
    structural.ok &&
    !hasUnsavedChanges &&
    existing!.supportState !== 'validated';
  /** Clears current form inputs only — does not mutate persisted mapping. */
  const canClear = !saving && !analyzing && formHasAnyLocator;
  const canMarkUnsupported =
    !saving &&
    !analyzing &&
    Boolean(existing) &&
    (existing!.supportState === 'validated' || existing!.supportState === 'unsupported');

  async function requestAnalyzeLoginPage(): Promise<void> {
    if (!canAnalyze) {
      return;
    }
    setError(null);
    setSuccess(null);
    setAnalyzing(true);
    try {
      const result = await analyzeLoginPageForMapping({
        serviceId: row.id,
        loginFields: fields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
        })),
        loginEntryUrl,
        currentLocators: locators,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.proposal) {
          setUnmappedFieldIds(result.proposal.unmappedFieldIds);
        }
        return;
      }
      setLocators(result.prefill.next);
      setUnmappedFieldIds(result.proposal.unmappedFieldIds);
      if (result.prefill.appliedFieldIds.length > 0) {
        setSuccess('הוצעו מיפויים בביטחון גבוה. בדקו ושמרו ידנית.');
      } else {
        setSuccess('לא נמצאו מיפויים בביטחון גבוה. השדות נותרו ריקים.');
      }
    } catch {
      setError('לא ניתן לנתח את דף הכניסה כרגע. נסו שוב.');
    } finally {
      setAnalyzing(false);
    }
  }

  function requestClearMapping(): void {
    if (!canClear) {
      return;
    }
    if (!window.confirm('לנקות את שדות המיפוי במסך?')) {
      return;
    }
    const cleared: Record<string, string> = {};
    for (const field of fields) {
      cleared[field.id] = '';
    }
    setLocators(cleared);
    setUnmappedFieldIds(fields.map((field) => field.id));
    setError(null);
    setSuccess(null);
  }

  function requestApproveMapping(): void {
    if (!canApprove) {
      return;
    }
    setApproveConfirmOpen(true);
  }

  function cancelApproveMapping(): void {
    setApproveConfirmOpen(false);
  }

  function confirmApproveMapping(): void {
    setApproveConfirmOpen(false);
    void persist('activate_validated', { liveValidationApproved: true });
  }

  function requestSaveMapping(): void {
    if (!canSave) {
      return;
    }
    if (formIsEmpty) {
      if (!existing) {
        return;
      }
      if (existing.supportState === 'validated') {
        setError(
          'לא ניתן לשמור מיפוי ריק במצב מאומת. יש להגדיר כלא נתמך תחילה, או להחזיר את ערכי המיפוי.',
        );
        return;
      }
      void persist('reset_not_configured');
      return;
    }
    void persist('save');
  }

  async function persist(
    action: AutofillProfileAction,
    options?: { liveValidationApproved?: boolean },
  ) {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const liveValidationApproved =
        action === 'activate_validated' && options?.liveValidationApproved === true;
      await updateGlobalRegistryRow(row.id, {
        metadata: {
          ...(row.metadata ?? {}),
          autofillProfile: {
            fieldMappings,
            loginEntryUrl,
            allowedOrigin,
          },
          [AUTOFILL_PROFILE_ACTION_KEY]: action,
          [AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: liveValidationApproved,
        },
      });
      await onSaved();
      setUnmappedFieldIds([]);
      setSuccess(
        action === 'reset_not_configured'
          ? 'המיפוי נוקה.'
          : action === 'disable_unsupported'
            ? 'המילוי האוטומטי המנוהל הוגדר כלא נתמך.'
            : action === 'activate_validated'
              ? 'המיפוי אושר'
              : 'המיפוי נשמר בהצלחה',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת המיפוי נכשלה.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel admin-autofill-profile">
      <h3 className="admin-panel-title">מילוי אוטומטי מנוהל</h3>
      <p className="admin-panel-hint">
        בורר CSS לכל שדה כניסה פעיל. שמירה מבצעת בדיקה מבנית בלבד ואינה מסמנת את האתר כמאומת.
        ניתוח דף כניסה מציע מיפויים בביטחון גבוה בלבד — ללא שמירה אוטומטית.
      </p>
      <p className="admin-autofill-state">
        מצב תמיכה: <strong>{supportLabel(existing?.supportState ?? null)}</strong>
        {analyzing ? (
          <>
            {' '}
            · <span role="status">{ANALYZING_LOGIN_PAGE_LABEL_HE}</span>
          </>
        ) : null}
      </p>
      <div className="admin-autofill-fields">
        {fields.map((field) => {
          const emptyAndUnmapped =
            !(locators[field.id] ?? '').trim() && unmappedFieldIds.includes(field.id);
          return (
            <label key={field.id} className="admin-field">
              <span>
                {field.label} <code>{field.id}</code>
                {emptyAndUnmapped ? (
                  <span className="admin-muted"> · {NOT_CONFIDENTLY_MAPPED_LABEL_HE}</span>
                ) : null}
              </span>
              <input
                value={locators[field.id] ?? ''}
                onChange={(event) =>
                  setLocators((current) => ({ ...current, [field.id]: event.target.value }))
                }
                placeholder="#field-selector"
                dir="ltr"
                disabled={analyzing}
              />
            </label>
          );
        })}
      </div>
      {!structural.ok ? (
        <p className="admin-error" role="status">
          {structural.issues[0]?.message}
        </p>
      ) : (
        <p className="admin-muted">הבדיקה המבנית תקינה.</p>
      )}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="admin-success admin-autofill-success" role="status">
          <span>{success}</span>
          <button
            type="button"
            className="admin-autofill-success-dismiss"
            onClick={() => setSuccess(null)}
            aria-label="סגירה"
          >
            סגירה
          </button>
        </p>
      ) : null}
      <div className="admin-actions-row admin-autofill-actions" role="group" aria-label="פעולות מיפוי">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={!canAnalyze}
          data-action="analyze"
          data-enabled={canAnalyze ? 'true' : 'false'}
          aria-disabled={!canAnalyze}
          onClick={() => {
            void requestAnalyzeLoginPage();
          }}
        >
          {analyzing ? ANALYZING_LOGIN_PAGE_LABEL_HE : ANALYZE_LOGIN_PAGE_LABEL_HE}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={!canSave}
          data-action="save"
          data-enabled={canSave ? 'true' : 'false'}
          aria-disabled={!canSave}
          onClick={requestSaveMapping}
        >
          שמור מיפוי
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={!canApprove}
          data-action="approve"
          data-enabled={canApprove ? 'true' : 'false'}
          aria-disabled={!canApprove}
          onClick={requestApproveMapping}
        >
          אשר מיפוי
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={!canClear}
          data-action="clear"
          data-enabled={canClear ? 'true' : 'false'}
          aria-disabled={!canClear}
          onClick={requestClearMapping}
        >
          נקה מיפוי
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={!canMarkUnsupported}
          data-action="unsupported"
          data-enabled={canMarkUnsupported ? 'true' : 'false'}
          aria-disabled={!canMarkUnsupported}
          onClick={() => {
            if (!canMarkUnsupported) return;
            void persist('disable_unsupported');
          }}
        >
          הגדר כלא נתמך
        </button>
      </div>

      {approveConfirmOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              cancelApproveMapping();
            }
          }}
        >
          <div
            className="admin-modal admin-autofill-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-autofill-approve-title"
            aria-describedby="admin-autofill-approve-body"
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="admin-autofill-approve-title">{`לאשר את המיפוי ל${serviceDisplayName}?`}</h3>
            <p id="admin-autofill-approve-body">
              {`לאחר האישור, המערכת תוכל להשתמש במיפוי שהוגדר לצורך מילוי פרטי הכניסה ל${serviceDisplayName}.`}
            </p>
            <div className="admin-actions-row admin-autofill-confirm-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={saving}
                onClick={cancelApproveMapping}
              >
                ביטול
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={saving}
                onClick={confirmApproveMapping}
              >
                אשר מיפוי
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
