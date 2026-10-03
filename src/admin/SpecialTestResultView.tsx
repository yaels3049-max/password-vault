import { formatManagedFillDiagnosticsForOperator } from '../execution/managedAutofill';
import { formatSpecialRunDetail, type SpecialRunOutcome } from '../execution/specialLoginFlow';
import { specialAdminPresentation } from '../execution/specialLoginFlowMessages';
import { FILL_TEST_GRID_HE } from './fillTestContext';

/**
 * Phase 121 D-121-40 — SPECIAL Admin Test result: plain-Hebrew outcome + the run time
 * (D-121-43: no plan-kind label); version, detail line, snapshot id and A2 diagnostics sit in a collapsed
 * «פרטים טכניים» section (closed by default). Never shows credential values.
 */
export default function SpecialTestResultView({ outcome, at }: { outcome: SpecialRunOutcome; at: string }) {
  const presentation = specialAdminPresentation({
    ok: outcome.ok,
    reason: outcome.reason,
    liveOrigin: outcome.liveOrigin,
    detailMessage: outcome.detailMessage,
    stepNumber: outcome.stepNumber,
    userGestureDuringRun: outcome.userGestureDuringRun,
  });
  const diagText = formatManagedFillDiagnosticsForOperator({
    ok: outcome.ok,
    tabOpened: outcome.tabOpened,
    extensionUsed: outcome.extensionUsed,
    userMessage: '',
    fillDiagnostics: outcome.fillDiagnostics,
  });
  const detailLine = formatSpecialRunDetail(outcome);
  const hasTechnical = Boolean(detailLine || outcome.snapshotId || diagText || outcome.planVersion);

  return (
    <div
      className="admin-special-test-result"
      data-section="special-test-result"
      data-result-kind={presentation.kind}
    >
      <p className={presentation.kind === 'success' ? 'admin-success' : 'admin-error'} role="status">
        {presentation.message}
      </p>
      <p className="admin-muted" data-testid="special-test-context">
        {new Date(at).toLocaleString('he-IL')}
      </p>
      {hasTechnical ? (
        <details className="admin-special-test-details" data-section="special-test-technical">
          <summary>{FILL_TEST_GRID_HE.specialTechnicalDetails}</summary>
          {outcome.planVersion ? (
            <p className="admin-muted" data-testid="special-test-plan-version">
              {`גרסה ${outcome.planVersion}`}
            </p>
          ) : null}
          {detailLine ? (
            <p className="admin-muted" data-testid="special-test-structure">
              {detailLine}
            </p>
          ) : null}
          {outcome.snapshotId ? (
            <p className="admin-muted" data-testid="special-test-snapshot">
              {`צילום ${outcome.snapshotId}`}
            </p>
          ) : null}
          {diagText ? (
            <pre className="admin-muted" data-testid="special-test-diagnostics">
              {diagText}
            </pre>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
