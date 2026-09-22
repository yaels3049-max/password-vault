import { useEffect, useMemo, useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import { updateGlobalRegistryRow } from './adminRegistryApi';
import {
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  originFromHttpsLoginEntry,
  readAutofillProfileFromMetadata,
  validateAutofillProfileStructural,
  type AutofillFieldMapping,
  type AutofillProfileAction,
  type AutofillSupportState,
} from '../autofill/validatedProfile';
import { runManagedReadinessProbe } from '../autofill/managedReadinessProbe';
import { classifyStoredLoginFields } from '../service/credentialSchema';
import {
  analyzeLoginPageForMapping,
  ANALYZE_LOGIN_PAGE_LABEL_HE,
  ANALYZING_LOGIN_PAGE_LABEL_HE,
  NOT_CONFIDENTLY_MAPPED_LABEL_HE,
  startVisualMappingForField,
  VISUAL_MAPPING_IN_PROGRESS_LABEL_HE,
  VISUAL_MAPPING_LABEL_HE,
  IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE,
  LOCATOR_NOT_DETERMINISTIC_LABEL_HE,
  type FieldAuthoringEntry,
  visualTargetsEquivalent,
  applyVisualMappingAuthoring,
  markManualEdit,
  stampAdminTestPassed,
  adminTestSuccessVisible,
  upsertFieldAuthoring,
  CONFIDENCE_HIGH_LABEL_HE,
  CONFIDENCE_MEDIUM_LABEL_HE,
  CONFIDENCE_MEDIUM_REVIEW_HINT_HE,
  VISUAL_VERIFIED_LABEL_HE,
  MANUAL_EDITED_LABEL_HE,
  ADMIN_TEST_PASSED_LABEL_HE,
} from '../assistedMapping';
import {
  executeAdminManagedAutofillTest,
  formatAdminManagedTestResultSummary,
  type ManagedAutofillStructuredOutcome,
} from '../execution/managedAutofill';

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
  const [identifiedIneligibleFieldIds, setIdentifiedIneligibleFieldIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [visualMappingFieldId, setVisualMappingFieldId] = useState<string | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  /** Phase 120.5 — temp Admin test values; component memory only (retention B). */
  const [tempTestValues, setTempTestValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<ManagedAutofillStructuredOutcome | null>(null);
  /** Phase 120.8 — draft authoring facts; persist on Save (and Admin Test success stamp). */
  const [fieldAuthoring, setFieldAuthoring] = useState<FieldAuthoringEntry[]>(
    () => existing?.fieldAuthoring ?? [],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    const profile = readAutofillProfileFromMetadata(row.metadata);
    for (const mapping of profile?.fieldMappings ?? []) {
      next[mapping.fieldId] = mapping.locator;
    }
    setLocators(next);
    setUnmappedFieldIds([]);
    setIdentifiedIneligibleFieldIds([]);
    setFieldAuthoring(profile?.fieldAuthoring ?? []);
    // Remount / row change clears temp test values (retention B).
    setTempTestValues({});
    setTestOutcome(null);
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
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    fields.length > 0 &&
    Boolean(originFromHttpsLoginEntry(loginEntryUrl));
  const canVisualMap =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    Boolean(originFromHttpsLoginEntry(loginEntryUrl));
  const canSave =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    hasUnsavedChanges &&
    (structural.ok || (formIsEmpty && Boolean(existing)));
  const canApprove =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    operatorFunctionalActivateAllowed &&
    Boolean(existing) &&
    structural.ok &&
    !hasUnsavedChanges &&
    existing!.supportState !== 'validated';
  /** Clears form locators only (S0→S1). Persist requires Save → clear_managed_mappings. */
  const canClear =
    !saving && !analyzing && !probing && !testing && !visualMappingFieldId && formHasAnyLocator;
  const canMarkUnsupported =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    Boolean(existing) &&
    (existing!.supportState === 'validated' || existing!.supportState === 'unsupported');

  const savedProfileReady =
    Boolean(existing) &&
    existing!.fieldMappings.some((m) => m.fieldId.trim() && m.locator.trim()) &&
    Boolean(existing!.loginEntryUrl.trim()) &&
    Boolean(existing!.allowedOrigin.trim());

  const allTempValuesFilled =
    fields.length > 0 &&
    fields.every((field) => Boolean((tempTestValues[field.id] ?? '').trim()));

  /** AC-120.5-1/3: saved mapping (not necessarily validated); all temps filled; not dirty. */
  const canRunManagedTest =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    savedProfileReady &&
    !hasUnsavedChanges &&
    allTempValuesFilled;

  async function requestManagedTest(): Promise<void> {
    if (!canRunManagedTest || !existing) {
      return;
    }
    setError(null);
    setSuccess(null);
    setTestOutcome(null);
    setTesting(true);
    try {
      const outcome = await executeAdminManagedAutofillTest({
        serviceId: row.id,
        savedProfile: existing,
        loginFields: fields,
        tempCredentials: tempTestValues,
      });
      setTestOutcome(outcome);
      if (outcome.ok) {
        setSuccess(outcome.userMessage);
        // Phase 120.8 — persist Admin Test success fact only (no MEDIUM→HIGH, no validate).
        const configVersion = existing.configVersion;
        const mappedIds = existing.fieldMappings
          .filter((m) => m.fieldId.trim() && m.locator.trim())
          .map((m) => m.fieldId);
        const stamped = stampAdminTestPassed(fieldAuthoring, mappedIds, configVersion);
        setFieldAuthoring(stamped);
        await updateGlobalRegistryRow(row.id, {
          metadata: {
            ...(row.metadata ?? {}),
            autofillProfile: {
              fieldMappings: existing.fieldMappings,
              loginEntryUrl: existing.loginEntryUrl,
              allowedOrigin: existing.allowedOrigin,
              fieldAuthoring: stamped,
            },
            [AUTOFILL_PROFILE_ACTION_KEY]: 'save',
            [AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: false,
            [AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY]: false,
          },
        });
        await onSaved();
      } else {
        setError(formatAdminManagedTestResultSummary(outcome));
      }
    } catch {
      setError('בדיקת המילוי המנוהל נכשלה. נסו שוב.');
    } finally {
      setTesting(false);
    }
  }

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
          description: field.description,
        })),
        loginEntryUrl,
        currentLocators: locators,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.proposal) {
          setUnmappedFieldIds(result.proposal.unmappedFieldIds);
          setIdentifiedIneligibleFieldIds(
            (result.proposal.identifiedButManagedIneligible ?? []).map((row) => row.fieldId),
          );
        }
        return;
      }
      setLocators(result.prefill.next);
      setUnmappedFieldIds(result.proposal.unmappedFieldIds);
      const ineligibleIds = (result.proposal.identifiedButManagedIneligible ?? []).map(
        (row) => row.fieldId,
      );
      setIdentifiedIneligibleFieldIds(ineligibleIds);
      setFieldAuthoring((current) => {
        let next = [...current];
        for (const row of result.proposal.proposals) {
          if (row.confidence !== 'high' && row.confidence !== 'medium') continue;
          if (!result.prefill.appliedFieldIds.includes(row.fieldId)) continue;
          next = upsertFieldAuthoring(next, {
            fieldId: row.fieldId,
            source: 'analyze',
            confidence: row.confidence,
            observedInputId: row.observedInputId,
            visualMappingVerified: false,
            adminTestPassedAtConfigVersion: null,
          });
        }
        return next;
      });
      const appliedHigh = result.proposal.proposals.some(
        (p) => p.confidence === 'high' && result.prefill.appliedFieldIds.includes(p.fieldId),
      );
      const appliedMedium = result.proposal.proposals.some(
        (p) => p.confidence === 'medium' && result.prefill.appliedFieldIds.includes(p.fieldId),
      );
      const nondeterministicIds = result.proposal.proposals
        .filter(
          (p) =>
            (p.confidence === 'high' || p.confidence === 'medium') &&
            p.locatorDeterministic === false,
        )
        .map((p) => p.fieldId);
      if (result.prefill.appliedFieldIds.length > 0) {
        setSuccess(
          ineligibleIds.length > 0
            ? `הוצעו מיפויים לטיוטה. חלק מהשדות: ${IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE}.`
            : nondeterministicIds.length > 0
              ? `הוצעו מיפויים לטיוטה. חלק מהשדות: ${LOCATOR_NOT_DETERMINISTIC_LABEL_HE}.`
              : appliedHigh && appliedMedium
                ? 'הוצעו מיפויים (ביטחון גבוה / בינוני). בדקו ושמרו ידנית — הצעה בלבד, לא אישור.'
                : appliedMedium
                  ? 'הוצעו מיפויים בביטחון בינוני. בדקו ושמרו ידנית — הצעה בלבד, לא אישור.'
                  : 'הוצעו מיפויים בביטחון גבוה. בדקו ושמרו ידנית — הצעה בלבד, לא אישור.',
        );
      } else if (nondeterministicIds.length > 0) {
        setSuccess(LOCATOR_NOT_DETERMINISTIC_LABEL_HE);
      } else if (ineligibleIds.length > 0) {
        setSuccess(IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE);
      } else {
        setSuccess('לא נמצאו מיפויים להצעה. השדות נותרו ריקים.');
      }
    } catch {
      setError('לא ניתן לנתח את דף הכניסה כרגע. נסו שוב.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function requestVisualMapping(fieldId: string): Promise<void> {
    if (!canVisualMap) {
      return;
    }
    setError(null);
    setSuccess(null);
    setVisualMappingFieldId(fieldId);
    try {
      const result = await startVisualMappingForField({
        fieldId,
        loginEntryUrl,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.state === 'IDENTIFIED_BUT_MANAGED_INELIGIBLE') {
          setIdentifiedIneligibleFieldIds((current) =>
            current.includes(fieldId) ? current : [...current, fieldId],
          );
        }
        return;
      }
      const previousAuth = fieldAuthoring.find((row) => row.fieldId === fieldId);
      const currentLocator = (locators[fieldId] ?? '').trim();
      const sameTarget = visualTargetsEquivalent({
        currentLocator,
        currentObservedInputId: previousAuth?.observedInputId,
        visualLocator: result.locator,
        visualObservedInputId: result.observedInputId,
        visualLocatorCandidates: result.locatorCandidates,
      });
      // 120.9: ALWAYS persist Visual's verified unique locator (never preserve Analyze via E2).
      setLocators((current) => ({
        ...current,
        [result.fieldId]: result.locator,
      }));
      setFieldAuthoring((current) =>
        applyVisualMappingAuthoring({
          current,
          fieldId: result.fieldId,
          sameTarget,
          previous: previousAuth,
          visualObservedInputId: result.observedInputId,
        }),
      );
      setUnmappedFieldIds((current) => current.filter((id) => id !== result.fieldId));
      setIdentifiedIneligibleFieldIds((current) =>
        current.filter((id) => id !== result.fieldId),
      );
      setSuccess(result.message);
    } catch {
      setError('לא ניתן להשלים מיפוי חזותי כרגע. נסו שוב.');
    } finally {
      setVisualMappingFieldId(null);
    }
  }

  function requestClearMapping(): void {
    if (!canClear) {
      return;
    }
    const isValidated = existing?.supportState === 'validated';
    const confirmMessage = isValidated
      ? 'לנקות את מיפוי המילוי האוטומטי המאומת?\n\nרק בוררי המיפוי יוסרו מהגדרת השירות — סיסמאות ופרטי כניסה לא יימחקו.\nמילוי מנוהל בבית הדיגיטלי יופסק עד מיפוי ואישור מחדש.\n\nלאחר הניקוי יש ללחוץ «שמור מיפוי» כדי להסיר מהשרת.'
      : 'לנקות את שדות המיפוי במסך?\n\nרק בוררי המיפוי יוסרו — סיסמאות ופרטי כניסה לא יימחקו.\nיש ללחוץ «שמור מיפוי» כדי להסיר את המיפוי מהשרת.';
    if (!window.confirm(confirmMessage)) {
      return;
    }
    const cleared: Record<string, string> = {};
    for (const field of fields) {
      cleared[field.id] = '';
    }
    setLocators(cleared);
    setUnmappedFieldIds(fields.map((field) => field.id));
    setIdentifiedIneligibleFieldIds([]);
    setFieldAuthoring([]);
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
    void (async () => {
      setError(null);
      setSuccess(null);
      setProbing(true);
      try {
        const probe = await runManagedReadinessProbe({
          loginEntryUrl,
          fieldMappings,
        });
        if (!probe.ok) {
          setError(probe.message);
          return;
        }
        await persist('activate_validated', {
          liveValidationApproved: true,
          managedReadinessProbePassed: true,
        });
      } catch {
        setError('בדיקת מוכנות מנוהלת נכשלה. נסו שוב.');
      } finally {
        setProbing(false);
      }
    })();
  }

  function requestSaveMapping(): void {
    if (!canSave) {
      return;
    }
    if (formIsEmpty) {
      if (!existing) {
        return;
      }
      // Phase 120.7 — persist clear (S1→S2). Structural empty no longer blocks this action.
      void persist('clear_managed_mappings');
      return;
    }
    void persist('save');
  }

  async function persist(
    action: AutofillProfileAction,
    options?: { liveValidationApproved?: boolean; managedReadinessProbePassed?: boolean },
  ) {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const liveValidationApproved =
        action === 'activate_validated' && options?.liveValidationApproved === true;
      const managedReadinessProbePassed =
        action === 'activate_validated' && options?.managedReadinessProbePassed === true;
      const profilePayload =
        action === 'clear_managed_mappings'
          ? {
              fieldMappings: [] as AutofillFieldMapping[],
              loginEntryUrl,
              allowedOrigin,
            }
          : {
              fieldMappings,
              loginEntryUrl,
              allowedOrigin,
              fieldAuthoring,
            };
      await updateGlobalRegistryRow(row.id, {
        metadata: {
          ...(row.metadata ?? {}),
          autofillProfile: profilePayload,
          [AUTOFILL_PROFILE_ACTION_KEY]: action,
          [AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: liveValidationApproved,
          [AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY]: managedReadinessProbePassed,
        },
      });
      await onSaved();
      setUnmappedFieldIds([]);
      if (action === 'clear_managed_mappings') {
        setFieldAuthoring([]);
      }
      setSuccess(
        action === 'clear_managed_mappings'
          ? 'מיפויי המילוי האוטומטי הוסרו מהגדרת השירות. פרטי הכניסה נשמרו.'
          : action === 'reset_not_configured'
            ? 'המיפוי נוקה.'
            : action === 'disable_unsupported'
              ? 'המילוי האוטומטי המנוהל הוגדר כלא נתמך.'
              : action === 'activate_validated'
                ? 'המיפוי אושר'
                : 'המיפוי נשמר בהצלחה',
      );
    } catch (err) {
      // C4: never claim clear success when persist fails.
      setError(err instanceof Error ? err.message : 'שמירת המיפוי נכשלה.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel admin-autofill-profile">
      <h3 className="admin-panel-title">מילוי אוטומטי מנוהל</h3>
      <p className="admin-panel-hint">
        מיפוי חזותי: בחרו שדה ולחצו על הבקרה בדף הכניסה האמיתי (ללא הקלדת CSS). ניתוח דף
        כניסה מציע מיפויים בביטחון גבוה או בינוני (הצעה בלבד — לא אישור). שמירה מבצעת בדיקה
        מבנית בלבד ואינה מסמנת את האתר כמאומת — ללא שמירה אוטומטית.
      </p>
      <p className="admin-autofill-state">
        מצב תמיכה: <strong>{supportLabel(existing?.supportState ?? null)}</strong>
        {analyzing ? (
          <>
            {' '}
            · <span role="status">{ANALYZING_LOGIN_PAGE_LABEL_HE}</span>
          </>
        ) : null}
        {probing ? (
          <>
            {' '}
            · <span role="status">בודק מוכנות מנוהלת…</span>
          </>
        ) : null}
        {visualMappingFieldId ? (
          <>
            {' '}
            · <span role="status">{VISUAL_MAPPING_IN_PROGRESS_LABEL_HE}</span>
          </>
        ) : null}
      </p>
      <div className="admin-autofill-fields">
        {fields.map((field) => {
          const emptyAndUnmapped =
            !(locators[field.id] ?? '').trim() && unmappedFieldIds.includes(field.id);
          const identifiedIneligible = identifiedIneligibleFieldIds.includes(field.id);
          const fieldBusy = visualMappingFieldId === field.id;
          const authoring = fieldAuthoring.find((row) => row.fieldId === field.id);
          const configVersion = existing?.configVersion ?? 0;
          return (
            <div key={field.id} className="admin-autofill-field-row">
              <label className="admin-field">
                <span>
                  {field.label} <code>{field.id}</code>
                  {identifiedIneligible ? (
                    <span className="admin-muted">
                      {' '}
                      · {IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE}
                    </span>
                  ) : emptyAndUnmapped ? (
                    <span className="admin-muted"> · {NOT_CONFIDENTLY_MAPPED_LABEL_HE}</span>
                  ) : null}
                </span>
                <input
                  value={locators[field.id] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLocators((current) => ({ ...current, [field.id]: value }));
                    setFieldAuthoring((current) => markManualEdit(current, field.id));
                  }}
                  placeholder="נגזר ממיפוי חזותי או ניתוח"
                  dir="ltr"
                  disabled={analyzing || testing || Boolean(visualMappingFieldId)}
                  aria-label={`בורר CSS ל-${field.label}`}
                />
                <span className="admin-autofill-provenance" aria-live="polite">
                  {authoring?.source === 'analyze' && authoring.confidence === 'high' ? (
                    <span className="admin-autofill-chip admin-autofill-chip-high">
                      {CONFIDENCE_HIGH_LABEL_HE}
                    </span>
                  ) : null}
                  {authoring?.source === 'analyze' && authoring.confidence === 'medium' ? (
                    <span className="admin-autofill-chip admin-autofill-chip-medium">
                      {CONFIDENCE_MEDIUM_LABEL_HE}
                      <span className="admin-autofill-chip-hint">
                        {' '}
                        · {CONFIDENCE_MEDIUM_REVIEW_HINT_HE}
                      </span>
                    </span>
                  ) : null}
                  {authoring?.source === 'manual' ? (
                    <span className="admin-autofill-chip admin-autofill-chip-manual">
                      {MANUAL_EDITED_LABEL_HE}
                    </span>
                  ) : null}
                  {authoring?.source === 'visual_mapping' ? (
                    <span className="admin-autofill-chip admin-autofill-chip-visual">
                      {VISUAL_MAPPING_LABEL_HE}
                    </span>
                  ) : null}
                  {authoring?.visualMappingVerified ? (
                    <span className="admin-autofill-chip admin-autofill-chip-verified">
                      {VISUAL_VERIFIED_LABEL_HE}
                    </span>
                  ) : null}
                  {adminTestSuccessVisible(authoring, configVersion) ? (
                    <span className="admin-autofill-chip admin-autofill-chip-tested">
                      {ADMIN_TEST_PASSED_LABEL_HE}
                    </span>
                  ) : null}
                </span>
              </label>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={!canVisualMap}
                data-action="visual-mapping"
                data-field-id={field.id}
                data-enabled={canVisualMap ? 'true' : 'false'}
                aria-disabled={!canVisualMap}
                onClick={() => {
                  void requestVisualMapping(field.id);
                }}
              >
                {fieldBusy ? VISUAL_MAPPING_IN_PROGRESS_LABEL_HE : VISUAL_MAPPING_LABEL_HE}
              </button>
            </div>
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

      {savedProfileReady ? (
        <div className="admin-autofill-test" data-section="managed-test-harness">
          <h4 className="admin-panel-subtitle">בדיקת מילוי מנוהל</h4>
          <p className="admin-panel-hint">
            ערכים זמניים לבדיקה בלבד (בזיכרון המסך). הבדיקה רצה מול המיפוי{' '}
            <strong>השמור</strong> בלבד — ללא שינוי מצב תמיכה או אימות. אין צורך ב«מאומת».
          </p>
          {hasUnsavedChanges ? (
            <p className="admin-muted" role="status">
              יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.
            </p>
          ) : null}
          <div className="admin-autofill-test-fields">
            {fields.map((field) => (
              <label key={`test-${field.id}`} className="admin-field">
                <span>
                  {field.label} <code>{field.id}</code>
                </span>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={tempTestValues[field.id] ?? ''}
                  onChange={(event) =>
                    setTempTestValues((current) => ({
                      ...current,
                      [field.id]: event.target.value,
                    }))
                  }
                  autoComplete="off"
                  data-temp-test-field={field.id}
                  disabled={testing || analyzing || probing}
                  aria-label={`ערך בדיקה זמני ל-${field.label}`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={!canRunManagedTest}
            data-action="managed-test"
            data-enabled={canRunManagedTest ? 'true' : 'false'}
            aria-disabled={!canRunManagedTest}
            onClick={() => {
              void requestManagedTest();
            }}
          >
            {testing ? 'ממלא…' : 'כניסה לאתר ומילוי שדות'}
          </button>
          {testOutcome && !testOutcome.ok ? (
            <p className="admin-muted" data-testid="managed-test-structure" role="status">
              {[testOutcome.reason, testOutcome.fieldId, testOutcome.detail, testOutcome.locator]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="admin-muted" data-section="managed-test-unavailable">
          בדיקת מילוי מנוהל זמינה לאחר שמירת מיפוי עם כתובת כניסה.
        </p>
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
              {`לאחר האישור תבוצע בדיקת מוכנות מנוהלת בדף הכניסה. רק אם כל המיפויים מזהים יעד יחיד ובטוח, המערכת תוכל להשתמש במיפוי למילוי פרטי הכניסה ל${serviceDisplayName}.`}
            </p>
            <div className="admin-actions-row admin-autofill-confirm-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={saving || probing}
                onClick={cancelApproveMapping}
              >
                ביטול
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={saving || probing}
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
