import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import { updateGlobalRegistryRow } from './adminRegistryApi';
import { useAdminConfirm } from './AdminConfirmDialog';
import {
  originFromHttpsLoginEntry,
  readAutofillProfileFromMetadata,
  validateAutofillProfileStructural,
  type AutofillFieldMapping,
  type AutofillProfileAction,
} from '../autofill/validatedProfile';
import { runManagedReadinessProbe } from '../autofill/managedReadinessProbe';
import { classifyStoredLoginFields } from '../service/credentialSchema';
import {
  analyzeLoginPageForMapping,
  ANALYZE_LOGIN_PAGE_LABEL_HE,
  ANALYZING_LOGIN_PAGE_LABEL_HE,
  NOT_CONFIDENTLY_MAPPED_LABEL_HE,
  startVisualMappingForField,
  cancelVisualMappingForField,
  VISUAL_MAPPING_IN_PROGRESS_LABEL_HE,
  VISUAL_MAPPING_LABEL_HE,
  IDENTIFIED_BUT_MANAGED_INELIGIBLE_LABEL_HE,
  LOCATOR_NOT_DETERMINISTIC_LABEL_HE,
  type FieldAuthoringEntry,
  visualTargetsEquivalent,
  applyVisualMappingAuthoring,
  markManualEdit,
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
  GRID_SPECIAL_TO_STANDARD_HE,
  buildGridProfileMetadataPatch,
  liveContractIsNotStandard,
} from './specialActionBar';
import type { ManagedGridSharedState } from './fillTestContext';
import { ADMIN_VISUAL_PICK_COPY_HE } from './visualPickCopy';
import { AdminVisualPickSession } from './visualPickSession';
import { ADMIN_GRID_COPY_HE, ADMIN_MAPPING_COPY_HE, approveConfirmTitleHe } from './mappingCopy';

interface AutofillProfileEditorProps {
  row: AdminRegistryRow;
  onSaved: () => Promise<void>;
  /**
   * Live «אופי הכניסה» selection is SPECIAL: this grid is not rendered (D-121-45), and
   * Login-Entry Analyze / Visual stay disabled so no SPECIAL mapping reaches autofillProfile.
   */
  specialPatternSelected?: boolean;
  /** D-121-38 — «בדיקת מילוי» observes dirty / busy / in-memory authoring facts. */
  onSharedStateChange?: (state: ManagedGridSharedState) => void;
  /** D-121-38 — a «בדיקת מילוי» run is in progress (locks this grid, as before the move). */
  fillTestRunning?: boolean;
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

export default function AutofillProfileEditor({
  row,
  onSaved,
  specialPatternSelected = false,
  onSharedStateChange,
  fillTestRunning = false,
}: AutofillProfileEditorProps) {
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
  /** D-121-30 — live contract SPECIAL: grid activation replaces it (confirmed first). */
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const { ask: askConfirm, dialog: confirmDialog } = useAdminConfirm();
  const [switchConfirmed, setSwitchConfirmed] = useState(false);
  const testing = fillTestRunning;
  /** Phase 120.8 — draft authoring facts; persist on Save (and Admin Test success stamp). */
  const [fieldAuthoring, setFieldAuthoring] = useState<FieldAuthoringEntry[]>(
    () => existing?.fieldAuthoring ?? [],
  );

  // D-121-42: same bounded pick / cancel / late-response guard as the SPECIAL editor.
  const pickSessionRef = useRef<AdminVisualPickSession | null>(null);
  if (pickSessionRef.current === null) {
    pickSessionRef.current = new AdminVisualPickSession();
  }
  useEffect(() => {
    const session = pickSessionRef.current;
    return () => {
      session?.cancel();
    };
  }, []);

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

  useEffect(() => {
    onSharedStateChange?.({
      rowId: row.id,
      hasUnsavedChanges,
      busy: saving || analyzing || probing || Boolean(visualMappingFieldId),
      inputsLocked: analyzing || probing,
      fieldAuthoring,
    });
  }, [
    onSharedStateChange,
    row.id,
    hasUnsavedChanges,
    saving,
    analyzing,
    probing,
    visualMappingFieldId,
    fieldAuthoring,
  ]);

  // D-121-45: rendered only while STANDARD is selected (stays mounted → edits kept).
  if (fields.length === 0 || specialPatternSelected) {
    return null;
  }

  const allowedOrigin = originFromHttpsLoginEntry(loginEntryUrl) ?? '';
  const liveNotStandard = liveContractIsNotStandard(row.metadata);
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
    Boolean(originFromHttpsLoginEntry(loginEntryUrl)) &&
    !specialPatternSelected;
  const canVisualMap =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    Boolean(originFromHttpsLoginEntry(loginEntryUrl)) &&
    !specialPatternSelected;
  const canSave =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    hasUnsavedChanges &&
    (structural.ok || (formIsEmpty && Boolean(existing)));
  /** D-121-53: every canSave condition holds except "has unsaved changes". */
  const saveBlockedOnlyByNoChanges =
    !saving &&
    !analyzing &&
    !probing &&
    !testing &&
    !visualMappingFieldId &&
    !hasUnsavedChanges &&
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
    // Live SPECIAL: an already-validated regular mapping must still be activatable (return path).
    (existing!.supportState !== 'validated' || liveNotStandard);
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
    const session = pickSessionRef.current!;
    const pickLoginEntryUrl = loginEntryUrl;
    const outcome = await session.run({
      start: () =>
        startVisualMappingForField({ fieldId, loginEntryUrl: pickLoginEntryUrl }).catch(() => null),
      disarm: () => cancelVisualMappingForField({ loginEntryUrl: pickLoginEntryUrl }),
      onHubTimeout: () => {
        setVisualMappingFieldId(null);
        setError(ADMIN_VISUAL_PICK_COPY_HE.timeoutField);
      },
    });
    // Timed out / cancelled / superseded: the editor was already released; write nothing.
    if (outcome.stale) {
      return;
    }
    setVisualMappingFieldId(null);
    const result = outcome.result;
    if (!result) {
      setError('לא ניתן להשלים מיפוי חזותי כרגע. נסו שוב.');
      return;
    }
    if (!result.ok) {
      if (result.reason === 'visual_pick_timeout') {
        setError(ADMIN_VISUAL_PICK_COPY_HE.timeoutField);
        return;
      }
      if (result.reason === 'visual_pick_cancelled') {
        setSuccess(ADMIN_VISUAL_PICK_COPY_HE.cancelled);
        return;
      }
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
  }

  function cancelVisualMapping(): void {
    if (!pickSessionRef.current?.cancel()) {
      return;
    }
    setVisualMappingFieldId(null);
    setError(null);
    setSuccess(ADMIN_VISUAL_PICK_COPY_HE.cancelled);
  }

  async function requestClearMapping(): Promise<void> {
    if (!canClear) {
      return;
    }
    const isValidated = existing?.supportState === 'validated';
    const confirmed = await askConfirm({
      name: 'clear-mapping',
      title: isValidated ? 'לנקות את מיפוי המילוי האוטומטי המאומת?' : 'לנקות את שדות המיפוי במסך?',
      body: isValidated
        ? 'רק בוררי המיפוי יוסרו מהגדרת השירות — סיסמאות ופרטי כניסה לא יימחקו.\nמילוי מנוהל בבית הדיגיטלי יופסק עד מיפוי ואישור מחדש.\n\nלאחר הניקוי יש ללחוץ «שמור מיפוי» כדי להסיר מהשרת.'
        : 'רק בוררי המיפוי יוסרו — סיסמאות ופרטי כניסה לא יימחקו.\nיש ללחוץ «שמור מיפוי» כדי להסיר את המיפוי מהשרת.',
      confirmLabel: 'ניקוי',
      tone: 'danger',
    });
    if (!confirmed) {
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
    setSwitchConfirmed(false);
    if (liveNotStandard) {
      setSwitchConfirmOpen(true);
      return;
    }
    setApproveConfirmOpen(true);
  }

  function cancelSwitchToStandard(): void {
    setSwitchConfirmOpen(false);
    setSwitchConfirmed(false);
  }

  function confirmSwitchToStandard(): void {
    setSwitchConfirmOpen(false);
    setSwitchConfirmed(true);
    setApproveConfirmOpen(true);
  }

  function cancelApproveMapping(): void {
    setApproveConfirmOpen(false);
    setSwitchConfirmed(false);
  }

  function confirmApproveMapping(): void {
    setApproveConfirmOpen(false);
    if (liveNotStandard && !switchConfirmed) {
      return;
    }
    const specialToStandard = liveNotStandard && switchConfirmed;
    setSwitchConfirmed(false);
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
          specialToStandard,
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
    options?: {
      liveValidationApproved?: boolean;
      managedReadinessProbePassed?: boolean;
      specialToStandard?: boolean;
    },
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
        metadata: buildGridProfileMetadataPatch({
          metadata: row.metadata,
          action,
          profilePayload,
          liveValidationApproved,
          managedReadinessProbePassed,
          specialToStandard:
            action === 'activate_validated' && options?.specialToStandard === true
              ? { previous: existing, loginFields: fields, loginUrl: loginEntryUrl }
              : null,
        }),
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
                ? ADMIN_MAPPING_COPY_HE.approved
                : ADMIN_MAPPING_COPY_HE.saved,
      );
    } catch (err) {
      // C4: never claim clear success when persist fails.
      setError(err instanceof Error ? err.message : ADMIN_MAPPING_COPY_HE.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel admin-autofill-profile">
      <h3 className="admin-panel-title">{ADMIN_GRID_COPY_HE.standardTitle}</h3>
      <p className="admin-panel-hint">
        מיפוי חזותי: בחרו שדה ולחצו על הבקרה בדף הכניסה האמיתי (ללא הקלדת CSS). ניתוח דף
        כניסה מציע מיפויים בביטחון גבוה או בינוני (הצעה בלבד — לא אישור). שמירה מבצעת בדיקה
        מבנית בלבד ואינה מסמנת את האתר כמאומת — ללא שמירה אוטומטית.
      </p>
      {analyzing || probing || visualMappingFieldId ? (
        <p className="admin-autofill-state" data-status="standard-in-progress">
          {[
            analyzing ? ANALYZING_LOGIN_PAGE_LABEL_HE : null,
            probing ? 'בודק מוכנות מנוהלת…' : null,
            visualMappingFieldId ? VISUAL_MAPPING_IN_PROGRESS_LABEL_HE : null,
          ]
            .filter((label): label is string => label !== null)
            .map((label, index) => (
              <span key={label}>
                {index > 0 ? ' · ' : null}
                <span role="status">{label}</span>
              </span>
            ))}
        </p>
      ) : null}
      {visualMappingFieldId ? (
        <div className="admin-special-visual-armed" data-panel="standard-visual-armed">
          <p role="status" data-status="standard-visual-armed">
            {ADMIN_VISUAL_PICK_COPY_HE.waitingField}{' '}
            <strong>
              {fields.find((field) => field.id === visualMappingFieldId)?.label ?? visualMappingFieldId}
            </strong>
            . {ADMIN_VISUAL_PICK_COPY_HE.cancelHint}
          </p>
          <p className="admin-muted" data-status="standard-site-tab">
            {ADMIN_VISUAL_PICK_COPY_HE.siteTabActive}
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            data-action="standard-visual-cancel"
            onClick={cancelVisualMapping}
          >
            ביטול
          </button>
        </div>
      ) : null}
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
        <p className="admin-muted">{ADMIN_MAPPING_COPY_HE.structuralOk}</p>
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
          {ADMIN_MAPPING_COPY_HE.save}
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
          {ADMIN_MAPPING_COPY_HE.approve}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={!canClear}
          data-action="clear"
          data-enabled={canClear ? 'true' : 'false'}
          aria-disabled={!canClear}
          onClick={() => void requestClearMapping()}
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
      {saveBlockedOnlyByNoChanges ? (
        <p className="admin-muted" data-status="no-changes-to-save">
          {ADMIN_MAPPING_COPY_HE.noChangesToSave}
        </p>
      ) : null}

      {switchConfirmOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              cancelSwitchToStandard();
            }
          }}
        >
          <div
            className="admin-modal admin-autofill-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-describedby="admin-autofill-switch-body"
            dir="rtl"
            data-panel="special-to-standard-confirm"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="admin-autofill-switch-body">{GRID_SPECIAL_TO_STANDARD_HE.confirm}</p>
            <div className="admin-actions-row admin-autofill-confirm-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                data-action="cancel-special-to-standard"
                onClick={cancelSwitchToStandard}
              >
                {GRID_SPECIAL_TO_STANDARD_HE.cancel}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                data-action="confirm-special-to-standard"
                onClick={confirmSwitchToStandard}
              >
                {GRID_SPECIAL_TO_STANDARD_HE.confirmYes}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <h3 id="admin-autofill-approve-title">{approveConfirmTitleHe(serviceDisplayName)}</h3>
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
                {ADMIN_MAPPING_COPY_HE.cancel}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={saving || probing}
                onClick={confirmApproveMapping}
              >
                {ADMIN_MAPPING_COPY_HE.approve}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </section>
  );
}
