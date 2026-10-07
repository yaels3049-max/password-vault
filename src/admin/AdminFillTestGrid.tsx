import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import { updateGlobalRegistryRow } from './adminRegistryApi';
import {
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  readAutofillProfileFromMetadata,
} from '../autofill/validatedProfile';
import { classifyStoredLoginFields } from '../service/credentialSchema';
import { stampAdminTestPassed } from '../assistedMapping';
import {
  executeAdminManagedAutofillTest,
  formatAdminManagedTestResultSummary,
  formatManagedFillDiagnosticsForOperator,
  stopAdminFillTest,
  type ManagedAutofillStructuredOutcome,
} from '../execution/managedAutofill';
import { MSG_ADMIN_FILL_TEST_STOPPED } from '../execution/fillRunControl';
import { withoutLoginContractKeys } from './contractSafeMetadata';
import {
  FILL_TEST_GRID_HE,
  fillTestRoute,
  savedAuthoringPattern,
  standardUnmappedFields,
  type ManagedGridSharedState,
  type SpecialDraftDirtyState,
} from './fillTestContext';
import { executeAdminSpecialLoginFlowTest, type SpecialRunOutcome } from '../execution/specialLoginFlow';
import type { AuthoringLoginPattern } from '../loginContract';
import SpecialTestResultView from './SpecialTestResultView';
import { WORKSPACE_LAYOUT_HE } from './adminWorkspace';
import { AdminEmptyState, IconResult } from './adminIcons';

interface AdminFillTestGridProps {
  row: AdminRegistryRow;
  onSaved: () => Promise<void>;
  /** State reported by «מילוי אוטומטי מנוהל» (null until it reports for this row). */
  managedGrid: ManagedGridSharedState | null;
  /** Unsaved SPECIAL editor changes (null until the editor reports for this row). */
  specialDraftDirty?: SpecialDraftDirtyState | null;
  /** Live «אופי הכניסה» selection; null → as the editor initializes it from the saved row. */
  selectedPattern?: AuthoringLoginPattern | null;
  /** The managed grid locks its controls while a test runs (as before the move). */
  onTestingChange: (testing: boolean) => void;
  /** Phase 122.4 — mapping status line shown in the result card. */
  statusLine?: ReactNode;
  /** 122.8 R2 — «מעבר להגדרת כניסה ומילוי» in the incomplete-mapping notice. */
  onGoToLoginTab?: () => void;
  /** O-123-31 — false while another workspace tab is shown; leaving the tab clears the result. */
  active?: boolean;
}

interface SpecialTestResult {
  outcome: SpecialRunOutcome;
  at: string;
}

/** O-123-31 (b) — the summary's technical tokens after the Hebrew sentence (shown collapsed). */
function technicalTokens(outcome: ManagedAutofillStructuredOutcome): string {
  const summary = formatAdminManagedTestResultSummary(outcome);
  return summary.startsWith(outcome.userMessage)
    ? summary.slice(outcome.userMessage.length).replace(/^ · /, '')
    : summary;
}

/**
 * Phase 121 D-121-38 — unified Admin fill test «בדיקת מילוי».
 * STANDARD route = the Phase 120.5 managed test (moved from the managed grid, unchanged).
 * SPECIAL route (121.2) = the shared SPECIAL engine; result kept in memory only (no stamp, no write).
 * D-121-43: the route follows the selected «אופי הכניסה» and always runs the saved mapping.
 */
export default function AdminFillTestGrid({
  row,
  onSaved,
  managedGrid,
  specialDraftDirty = null,
  selectedPattern = null,
  onTestingChange,
  statusLine = null,
  onGoToLoginTab,
  active = true,
}: AdminFillTestGridProps) {
  const stored = classifyStoredLoginFields(row.login_fields);
  const fields = stored.status === 'valid' ? stored.fields : [];
  const existing = readAutofillProfileFromMetadata(row.metadata);
  const pattern = selectedPattern ?? savedAuthoringPattern(row.metadata);
  const plan = useMemo(() => fillTestRoute(row.metadata, pattern), [row.metadata, pattern]);

  /** Phase 120.5 — temp Admin test values; component memory only (retention B). */
  const [tempTestValues, setTempTestValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<ManagedAutofillStructuredOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [specialResult, setSpecialResult] = useState<SpecialTestResult | null>(null);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    // Remount / row change clears temp test values (retention B).
    setTempTestValues({});
    setTestOutcome(null);
    setSpecialResult(null);
    setStopped(false);
  }, [row.id, row.updated_at]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setTestOutcome(null);
    setSpecialResult(null);
    setStopped(false);
  }, [plan.route]);

  useEffect(() => {
    onTestingChange(testing);
  }, [testing, onTestingChange]);

  useEffect(() => () => onTestingChange(false), [onTestingChange]);

  // O-123-31 — the result stays until the tab is left or the test is run again (no timer).
  useEffect(() => {
    if (active) {
      return;
    }
    setError(null);
    setSuccess(null);
    setTestOutcome(null);
    setSpecialResult(null);
    setStopped(false);
  }, [active]);

  const specialContext = plan.route === 'special';
  const grid = managedGrid && managedGrid.rowId === row.id ? managedGrid : null;
  const hasUnsavedChanges = grid ? grid.hasUnsavedChanges : false;

  const savedProfileReady =
    Boolean(existing) &&
    existing!.fieldMappings.some((m) => m.fieldId.trim() && m.locator.trim()) &&
    Boolean(existing!.loginEntryUrl.trim()) &&
    Boolean(existing!.allowedOrigin.trim());

  const allTempValuesFilled =
    fields.length > 0 &&
    fields.every((field) => Boolean((tempTestValues[field.id] ?? '').trim()));

  const standardMissing = standardUnmappedFields(existing, fields);
  const standardComplete = standardMissing.length === 0;

  /** AC-120.5-1/3 + 122.8 R2: complete saved mapping (not necessarily validated); all temps filled; not dirty. */
  const canRunManagedTest =
    plan.route === 'standard' &&
    grid !== null &&
    !grid.busy &&
    !testing &&
    savedProfileReady &&
    standardComplete &&
    !hasUnsavedChanges &&
    allTempValuesFilled;

  async function requestManagedTest(): Promise<void> {
    if (!canRunManagedTest || !existing || !grid) {
      return;
    }
    setError(null);
    setSuccess(null);
    setTestOutcome(null);
    setStopped(false);
    setTesting(true);
    try {
      const outcome = await executeAdminManagedAutofillTest({
        serviceId: row.id,
        savedProfile: existing,
        loginFields: fields,
        tempCredentials: tempTestValues,
      });
      if (!outcome.ok && outcome.reason === 'cancelled') {
        setStopped(true);
        return;
      }
      setTestOutcome(outcome);
      const diagText = formatManagedFillDiagnosticsForOperator(outcome);
      if (diagText) {
        // A2 — Operator capture (browser console). Never includes credential values.
        console.info('[A2 ManagedFillDiagnostics]', outcome.fillDiagnostics);
      }
      if (outcome.ok) {
        setSuccess(outcome.userMessage);
        // Phase 120.8 — persist Admin Test success fact only (no MEDIUM→HIGH, no validate).
        const configVersion = existing.configVersion;
        const mappedIds = existing.fieldMappings
          .filter((m) => m.fieldId.trim() && m.locator.trim())
          .map((m) => m.fieldId);
        const stamped = stampAdminTestPassed(grid.fieldAuthoring, mappedIds, configVersion);
        await updateGlobalRegistryRow(row.id, {
          metadata: {
            ...withoutLoginContractKeys(row.metadata),
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
        setError(outcome.userMessage);
      }
    } catch {
      setError('בדיקת המילוי המנוהל נכשלה. נסו שוב.');
    } finally {
      setTesting(false);
    }
  }

  const specialRunnable = specialContext && plan.specialRunnable;
  const specialMappedIds = specialContext ? plan.specialMappedFieldIds : [];
  const draftDirty =
    specialContext &&
    specialDraftDirty !== null &&
    specialDraftDirty.rowId === row.id &&
    specialDraftDirty.dirty;
  const specialValuesFilled =
    specialMappedIds.length > 0 &&
    specialMappedIds.every((id) => Boolean((tempTestValues[id] ?? '').trim()));
  const specialComplete = specialContext && plan.specialComplete;
  /** RT-3.4 + 122.8 R2: runnable pattern; complete saved draft; temps for mapped fields only. */
  const canRunSpecialTest =
    specialContext && specialRunnable && specialComplete && !draftDirty && !testing && specialValuesFilled;

  async function requestSpecialTest(): Promise<void> {
    if (!canRunSpecialTest) {
      return;
    }
    setError(null);
    setSuccess(null);
    setTestOutcome(null);
    setSpecialResult(null);
    setStopped(false);
    setTesting(true);
    try {
      const outcome = await executeAdminSpecialLoginFlowTest({
        serviceRow: {
          id: row.id,
          primary_url: row.primary_url,
          login_url: row.login_url,
          metadata: row.metadata,
        },
        contextChoice: 'special_draft',
        tempCredentials: tempTestValues,
        draftHasUnsavedChanges: draftDirty,
      });
      if (outcome.fillDiagnostics) {
        // A2 — Operator capture (browser console). Never includes credential values.
        console.info('[A2 ManagedFillDiagnostics]', outcome.fillDiagnostics);
      }
      if (!outcome.ok && outcome.reason === 'cancelled') {
        setStopped(true);
        return;
      }
      setSpecialResult({ outcome, at: new Date().toISOString() });
    } catch {
      setError('בדיקת המילוי נכשלה. נסו שוב.');
    } finally {
      setTesting(false);
    }
  }

  const showTempInputs = specialContext
    ? specialRunnable && fields.some((field) => specialMappedIds.includes(field.id))
    : fields.length > 0 && savedProfileReady;
  const inputsLocked = testing || Boolean(grid?.inputsLocked);
  const canRun = specialContext ? canRunSpecialTest : canRunManagedTest;

  /** 122.8 R2 — a saved mapping exists but is not complete (partial saves stay allowed). */
  const incompleteDetail: string | null = specialContext
    ? specialRunnable && !specialComplete
      ? plan.specialGapMessage
      : null
    : savedProfileReady && fields.length > 0 && !standardComplete
      ? FILL_TEST_GRID_HE.incompleteMissingFields(standardMissing.map((field) => field.label || field.id))
      : null;
  const incompleteNotice = incompleteDetail !== null ? (
    <div className="admin-fill-test-incomplete" role="status" data-notice="fill-test-incomplete">
      <p className="admin-fill-test-incomplete-title">{FILL_TEST_GRID_HE.incompleteTitle}</p>
      <p className="admin-fill-test-incomplete-detail" data-part="fill-test-incomplete-detail">
        {incompleteDetail}
      </p>
      {onGoToLoginTab ? (
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn--compact"
          data-action="go-to-login-tab"
          onClick={onGoToLoginTab}
        >
          {FILL_TEST_GRID_HE.goToLoginTab}
        </button>
      ) : null}
    </div>
  ) : null;

  const testOutput = showTempInputs ? (
    <>
      {stopped ? (
        <p className="admin-muted" role="status" data-notice="fill-test-stopped">
          {MSG_ADMIN_FILL_TEST_STOPPED}
        </p>
      ) : null}
      {specialResult ? <SpecialTestResultView outcome={specialResult.outcome} at={specialResult.at} /> : null}
    </>
  ) : null;
  const managedTechnical = testOutcome && !testOutcome.ok ? technicalTokens(testOutcome) : '';
  const hasOutput =
    Boolean(error) || Boolean(success) || (showTempInputs && (stopped || specialResult !== null || (testOutcome !== null && !testOutcome.ok)));

  return (
    <section className="admin-fill-test" data-section="fill-test-grid">
      <div className="admin-panel admin-fill-test-run" data-part="fill-test-run">
      <h3 className="admin-panel-title">{FILL_TEST_GRID_HE.title}</h3>

      {plan.specialPatternLater ? (
        <p className="admin-muted" role="status" data-notice="fill-test-special-pattern-later">
          {FILL_TEST_GRID_HE.specialPatternLater}
        </p>
      ) : null}
      {plan.specialInvalid ? (
        <p className="admin-error" role="status" data-notice="fill-test-special-invalid">
          {FILL_TEST_GRID_HE.specialInvalid}
        </p>
      ) : null}
      {incompleteNotice}

      {showTempInputs ? (
        <div className="admin-autofill-test" data-section="managed-test-harness">
          {plan.route === 'standard' ? (
            <p className="admin-panel-hint">
              ערכים זמניים לבדיקה בלבד (בזיכרון המסך). הבדיקה רצה מול המיפוי{' '}
              <strong>השמור</strong> בלבד — ללא שינוי מצב תמיכה או אימות. אין צורך ב«מאומת».
            </p>
          ) : (
            <p className="admin-panel-hint">
              ערכים זמניים לבדיקה בלבד (בזיכרון המסך). הבדיקה רצה מול המיפוי{' '}
              <strong>השמור</strong> בלבד.
            </p>
          )}
          {plan.route === 'standard' && hasUnsavedChanges ? (
            <p className="admin-muted" role="status">
              {FILL_TEST_GRID_HE.dirty}
            </p>
          ) : null}
          {draftDirty ? (
            <p className="admin-muted" role="status" data-notice="fill-test-special-draft-dirty">
              {FILL_TEST_GRID_HE.dirty}
            </p>
          ) : null}
          <div className="admin-autofill-test-fields">
            {fields.map((field) => specialContext && !specialMappedIds.includes(field.id) ? null : (
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
                  disabled={inputsLocked}
                  aria-label={`ערך בדיקה זמני ל-${field.label}`}
                />
              </label>
            ))}
          </div>
          <div className="admin-fill-test-actions" data-part="fill-test-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              disabled={!canRun}
              data-action="managed-test"
              data-route={specialContext ? 'special' : 'standard'}
              data-enabled={canRun ? 'true' : 'false'}
              aria-disabled={!canRun}
              onClick={() => {
                void (specialContext ? requestSpecialTest() : requestManagedTest());
              }}
            >
              {testing ? FILL_TEST_GRID_HE.running : FILL_TEST_GRID_HE.run}
            </button>
            {testing ? (
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                data-action="stop-fill-test"
                onClick={() => {
                  stopAdminFillTest(row.id);
                }}
              >
                {FILL_TEST_GRID_HE.stop}
              </button>
            ) : null}
          </div>
        </div>
      ) : specialContext ? (
        draftDirty ? (
          <p className="admin-muted" role="status" data-notice="fill-test-special-draft-dirty">
            {FILL_TEST_GRID_HE.dirty}
          </p>
        ) : null
      ) : (
        <p className="admin-muted" data-section="managed-test-unavailable">
          {FILL_TEST_GRID_HE.unavailable}
        </p>
      )}
      </div>

      <div className="admin-panel admin-fill-test-result" data-part="fill-test-result">
      <h3 className="admin-panel-title">
        <IconResult />
        {WORKSPACE_LAYOUT_HE.testResultTitle}
      </h3>
      {statusLine}
      {testOutput}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {showTempInputs && testOutcome && !testOutcome.ok ? (
        <details className="admin-special-test-details" data-section="managed-test-technical">
          <summary>{FILL_TEST_GRID_HE.specialTechnicalDetails}</summary>
          {managedTechnical ? (
            <p className="admin-muted" data-part="managed-test-technical-summary">
              {managedTechnical}
            </p>
          ) : null}
          <p className="admin-muted" data-testid="managed-test-structure">
            {[testOutcome.reason, testOutcome.fieldId, testOutcome.detail, testOutcome.locator]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </details>
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
      {hasOutput ? null : (
        <AdminEmptyState icon={<IconResult size={28} />} data-empty="fill-test-result">
          {WORKSPACE_LAYOUT_HE.testResultEmpty}
        </AdminEmptyState>
      )}
      </div>
    </section>
  );
}
