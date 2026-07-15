import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminCategories,
  fetchPendingSubmissions,
  promoteUserSubmissionWithDiscovery,
  rejectUserSubmission,
  type AdminCategory,
  type AdminRegistryRow,
} from './adminRegistryApi';
import { formatAdminDate, statusLabelHe } from './adminPresentation';
import { adminRowToLogoService } from './adminLogoService';
import IntegrationStatusPanel from './IntegrationStatusPanel';
import { useServiceLogos } from '../useServiceLogos';

function PreviewIcon({
  row,
  logoSrc,
}: {
  row: AdminRegistryRow;
  logoSrc?: string | null;
}) {
  if (logoSrc) {
    return (
      <img className="admin-site-card-icon" src={logoSrc} alt="" width={40} height={40} />
    );
  }
  // Prefer letter/initial over stored emoji (🔗) — same as Digital Home fallback.
  const emoji =
    row.icon &&
    row.icon.trim() &&
    !/^https?:/i.test(row.icon) &&
    row.icon.trim() !== '🔗'
      ? row.icon.trim()
      : null;
  return (
    <span className="admin-site-card-icon admin-site-card-icon--letter" aria-hidden>
      {emoji ?? row.display_name.slice(0, 1)}
    </span>
  );
}

export default function ApprovalQueue() {
  const [rows, setRows] = useState<AdminRegistryRow[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [globalIdOverride, setGlobalIdOverride] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const logoServices = useMemo(() => rows.map(adminRowToLogoService), [rows]);
  const logos = useServiceLogos(logoServices);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [pending, cats] = await Promise.all([
        fetchPendingSubmissions(),
        fetchAdminCategories(),
      ]);
      setRows(pending);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת תור ההגשות נכשלה.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function categoryLabel(categoryId: string | null | undefined): string {
    if (!categoryId) return 'ללא קטגוריה';
    return categories.find((c) => c.id === categoryId)?.display_name ?? categoryId;
  }

  function submittedByLabel(row: AdminRegistryRow): string {
    if (row.owner_user_id) return `משתמש ${row.owner_user_id.slice(0, 8)}…`;
    return 'משתמש';
  }

  async function handleApprove() {
    if (!selected) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setDiscovering(true);
      setSuccess('מאשר אתר ומחפש דף כניסה…');

      const result = await promoteUserSubmissionWithDiscovery(
        selected.id,
        globalIdOverride.trim() || undefined,
      );

      if (result.discoverySucceeded && result.loginUrl) {
        setSuccess(
          `אושר כאתר מובנה (${result.globalId}). דף כניסה: ${result.loginUrl}`,
        );
      } else {
        setSuccess(
          `אושר כאתר מובנה (${result.globalId}). ${result.discoveryMessage}`,
        );
      }

      setSelectedId(null);
      setGlobalIdOverride('');
      setShowMoreDetails(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אישור נכשל.');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleReject() {
    if (!selected) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await rejectUserSubmission(selected.id, rejectReason);
      setSuccess('ההגשה נדחתה.');
      setSelectedId(null);
      setRejectReason('');
      setShowMoreDetails(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'דחייה נכשלה.');
    }
  }

  return (
    <section className="admin-section admin-section--approvals">
      <header className="admin-section-header">
        <h2>אתרים בהוספה ע&quot;י משתמשים</h2>
        <p>
          סקירת אתרים שהוגשו על ידי משתמשים. אישור הופך את האתר לאתר מובנה
          בקטלוג — זמין לכל המשתמשים.
        </p>
      </header>

      {loading && <p className="admin-muted">טוען…</p>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {discovering && (
        <p className="admin-muted" role="status">
          מאשר ומחפש דף כניסה… (דורש הרחבת דפדפן)
        </p>
      )}
      {success && !discovering && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}

      <div
        className="admin-scroll-panel admin-approvals-scroll"
        aria-label="הגשות ממתינות"
      >
      <ul className="admin-pending-grid">
        {rows.length === 0 && !loading && (
          <li className="admin-muted">אין הגשות ממתינות כרגע.</li>
        )}
        {rows.map((row) => {
          const isSelected = selectedId === row.id;
          return (
            <li
              key={row.id}
              className={`admin-pending-card${isSelected ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="admin-site-card-head"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  textAlign: 'start',
                }}
                onClick={() => {
                  setSelectedId(row.id);
                  setShowMoreDetails(false);
                }}
              >
                <PreviewIcon row={row} logoSrc={logos[row.id]} />
                <div>
                  <div className="admin-site-card-name">{row.display_name}</div>
                  <div className="admin-site-card-meta">
                    <span className="admin-badge">{categoryLabel(row.category_id)}</span>
                    <span className="admin-badge admin-badge--warn">
                      {statusLabelHe(row.service_status)}
                    </span>
                  </div>
                </div>
              </button>

              <p className="admin-site-card-line">
                <strong>תאריך הגשה:</strong>{' '}
                {formatAdminDate(row.created_at ?? row.updated_at)}
              </p>
              <p className="admin-site-card-line">
                <strong>הוגש על ידי:</strong> {submittedByLabel(row)}
              </p>
              {row.primary_url ? (
                <p className="admin-site-card-line">
                  <strong>כתובת הבית:</strong> {row.primary_url}
                </p>
              ) : null}

              {isSelected && (
                <>
                  <label className="admin-field">
                    <span>מזהה גלובלי (אופציונלי)</span>
                    <input
                      value={globalIdOverride}
                      onChange={(e) => setGlobalIdOverride(e.target.value)}
                      placeholder={row.id}
                    />
                  </label>
                  <label className="admin-field">
                    <span>סיבת דחייה (אופציונלי)</span>
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="סיבה קצרה"
                    />
                  </label>
                  <div className="admin-actions-row">
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      disabled={discovering}
                      onClick={() => void handleApprove()}
                    >
                      אשר
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() => void handleReject()}
                    >
                      דחה
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => setShowMoreDetails(true)}
                    >
                      פרטים נוספים
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      </div>

      {showMoreDetails && selected && (
        <div
          className="admin-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMoreDetails(false);
          }}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pending-details-title"
            dir="rtl"
          >
            <div className="admin-modal-header">
              <h3 id="admin-pending-details-title">פרטים נוספים</h3>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="סגירה"
                onClick={() => setShowMoreDetails(false)}
              >
                ✕
              </button>
            </div>
            <dl className="admin-status-grid">
              <div>
                <dt>מזהה</dt>
                <dd>{selected.id}</dd>
              </div>
              <div>
                <dt>source_type</dt>
                <dd>{selected.source_type}</dd>
              </div>
              <div>
                <dt>owner_user_id</dt>
                <dd>{selected.owner_user_id ?? '—'}</dd>
              </div>
            </dl>
            <details className="admin-details" style={{ marginTop: '0.75rem' }}>
              <summary>מטא-דאטה (JSON)</summary>
              <pre className="admin-pre">{JSON.stringify(selected.metadata ?? {}, null, 2)}</pre>
            </details>
            <IntegrationStatusPanel row={selected} />
          </div>
        </div>
      )}
    </section>
  );
}
