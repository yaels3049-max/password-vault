import { useEffect, useState } from 'react';
import type { ServiceDeleteImpact, ServiceDeleteResult } from './adminRegistryApi';

export const DELETE_SERVICE_COPY_HE = {
  button: 'מחיקת אתר',
  title: 'מחיקת אתר',
  loadingImpact: 'בודקים אצל כמה משתמשים האתר קיים…',
  noUsers: 'האתר לא נמצא אצל אף משתמש.',
  builtin: 'אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.',
  irreversible: 'המחיקה סופית ואין אפשרות לבטל אותה.',
  typePrompt: 'כדי לאשר, הקלידו את שם האתר:',
  confirm: 'מחק את האתר',
  deleting: 'מוחקים…',
  cancel: 'ביטול',
  close: 'סגור',
  done: 'האתר נמחק.',
  errorFunctionMissing: 'מחיקת אתרים עוד לא הופעלה במסד הנתונים (חסר עדכון מסד נתונים). לא נמחק דבר.',
  errorNotAdmin: 'אין הרשאת מנהל למחיקה.',
  errorNameMismatch: 'השם שהוקלד לא תואם לשם האתר.',
  errorGeneric: 'המחיקה נכשלה. לא נמחק דבר.',
  impactFailedReason: 'אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.',
  technicalDetails: 'פרטים טכניים',
} as const;

/** Impact lines are warnings, not failures: the existing amber notice style; `admin-error` stays for failures only. */
const IMPACT_NOTICE_CLASS = 'admin-gate-login-banner';

export interface DeleteServiceErrorView {
  message: string;
  technical: string;
}

/** One mapping for the impact call and the delete call; the raw text is kept only as technical detail. */
export function deleteServiceErrorView(err: unknown): DeleteServiceErrorView {
  const technical = (err instanceof Error ? err.message : String(err ?? '')).trim();
  let message: string = DELETE_SERVICE_COPY_HE.errorGeneric;
  if (/PGRST202|Could not find the function/i.test(technical)) {
    message = DELETE_SERVICE_COPY_HE.errorFunctionMissing;
  } else if (/Admin access required/i.test(technical)) {
    message = DELETE_SERVICE_COPY_HE.errorNotAdmin;
  } else if (/confirmation name does not match/i.test(technical)) {
    message = DELETE_SERVICE_COPY_HE.errorNameMismatch;
  }
  return { message, technical };
}

function renderErrorBlock(view: DeleteServiceErrorView, status: string) {
  return (
    <div data-status={status}>
      <p className="admin-error" role="alert" data-part="message">
        {view.message}
      </p>
      {view.technical ? (
        <details className="admin-special-test-details" data-part="technical">
          <summary>{DELETE_SERVICE_COPY_HE.technicalDetails}</summary>
          <code dir="ltr">{view.technical}</code>
        </details>
      ) : null}
    </div>
  );
}

export function deleteImpactUsersHe(usersCount: number): string {
  return `האתר קיים אצל ${usersCount} משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.`;
}

export function deleteResultCountsHe(result: ServiceDeleteResult): string {
  return `הוסר אצל ${result.usersCount} משתמשים · ${result.profilesCount} פרופילים · ${result.credentialsCount} פרטי כניסה שמורים · ${result.assetsCount} נכסי אייקון.`;
}

export function deleteStorageFailureHe(reason: string): string {
  return `קבצי האייקון לא נמחקו מהאחסון (האתר עצמו נמחק): ${reason}`;
}

/** Exact match with the site name (surrounding spaces ignored, same rule as the server). */
export function confirmNameMatches(typed: string, displayName: string): boolean {
  const value = typed.trim();
  return value.length > 0 && value === displayName.trim();
}

interface DeleteServiceDialogProps {
  service: { id: string; displayName: string };
  loadImpact: (serviceId: string) => Promise<ServiceDeleteImpact>;
  deleteService: (serviceId: string, confirmDisplayName: string) => Promise<ServiceDeleteResult>;
  onDeleted: (result: ServiceDeleteResult) => void;
  onClose: () => void;
}

export default function DeleteServiceDialog({
  service,
  loadImpact,
  deleteService,
  onDeleted,
  onClose,
}: DeleteServiceDialogProps) {
  const [impact, setImpact] = useState<ServiceDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState<DeleteServiceErrorView | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeleteServiceErrorView | null>(null);
  const [result, setResult] = useState<ServiceDeleteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImpact(null);
    setImpactError(null);
    loadImpact(service.id).then(
      (value) => {
        if (!cancelled) setImpact(value);
      },
      (err: unknown) => {
        if (!cancelled) setImpactError(deleteServiceErrorView(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [service.id, loadImpact]);

  const canConfirm = impact !== null && !busy && result === null && confirmNameMatches(typed, service.displayName);

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const done = await deleteService(service.id, typed.trim());
      setResult(done);
      onDeleted(done);
    } catch (err) {
      setError(deleteServiceErrorView(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-overlay">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-delete-service-title"
        dir="rtl"
        data-dialog="delete-service"
      >
        <div className="admin-modal-header">
          <h3 id="admin-delete-service-title">
            {DELETE_SERVICE_COPY_HE.title}: {service.displayName}
          </h3>
          <button
            type="button"
            className="admin-modal-close"
            aria-label={DELETE_SERVICE_COPY_HE.close}
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        {result ? (
          <>
            <p className="admin-success" role="status" data-status="delete-service-done">
              {DELETE_SERVICE_COPY_HE.done} {deleteResultCountsHe(result)}
            </p>
            {result.storageFailure ? (
              <p className="admin-error" role="alert" data-status="delete-service-storage-failed">
                {deleteStorageFailureHe(result.storageFailure)}
              </p>
            ) : null}
            <div className="admin-actions-row">
              <button type="button" className="admin-btn admin-btn-primary" onClick={onClose}>
                {DELETE_SERVICE_COPY_HE.close}
              </button>
            </div>
          </>
        ) : (
          <>
            {impact === null && impactError === null ? (
              <p className="admin-muted" data-status="delete-service-impact-loading">
                {DELETE_SERVICE_COPY_HE.loadingImpact}
              </p>
            ) : null}
            {impactError ? renderErrorBlock(impactError, 'delete-service-impact-error') : null}
            {impact ? (
              <div data-status="delete-service-impact">
                <p className={IMPACT_NOTICE_CLASS} data-part="impact-users">
                  {impact.usersCount > 0
                    ? deleteImpactUsersHe(impact.usersCount)
                    : DELETE_SERVICE_COPY_HE.noUsers}
                </p>
                {impact.isBuiltin ? (
                  <p className={IMPACT_NOTICE_CLASS} data-status="delete-service-builtin">
                    {DELETE_SERVICE_COPY_HE.builtin}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="admin-field-hint">{DELETE_SERVICE_COPY_HE.irreversible}</p>
            <label className="admin-field">
              <span>
                {DELETE_SERVICE_COPY_HE.typePrompt} <strong>{service.displayName}</strong>
              </span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                disabled={busy}
                autoComplete="off"
                data-action="delete-service-confirm-name"
              />
            </label>
            {impactError ? (
              <p className="admin-field-hint" data-status="delete-service-disabled-reason">
                {DELETE_SERVICE_COPY_HE.impactFailedReason}
              </p>
            ) : null}
            {error ? renderErrorBlock(error, 'delete-service-error') : null}
            <div className="admin-actions-row">
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => void confirm()}
                disabled={!canConfirm}
                data-action="delete-service-confirm"
              >
                {busy ? DELETE_SERVICE_COPY_HE.deleting : DELETE_SERVICE_COPY_HE.confirm}
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose} disabled={busy}>
                {DELETE_SERVICE_COPY_HE.cancel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
