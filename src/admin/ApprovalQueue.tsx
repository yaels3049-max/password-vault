import { useCallback, useEffect, useState } from 'react';
import {
  fetchPendingSubmissions,
  promoteUserSubmissionWithDiscovery,
  rejectUserSubmission,
  type AdminRegistryRow,
} from './adminRegistryApi';
import IntegrationStatusPanel from './IntegrationStatusPanel';

export default function ApprovalQueue() {
  const [rows, setRows] = useState<AdminRegistryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [globalIdOverride, setGlobalIdOverride] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [discovering, setDiscovering] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pending = await fetchPendingSubmissions();
      setRows(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת תור אישורים נכשלה.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function handleApprove() {
    if (!selected) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setDiscovering(true);
      setSuccess('מאשר שירות ומחפש דף כניסה…');

      const result = await promoteUserSubmissionWithDiscovery(
        selected.id,
        globalIdOverride.trim() || undefined,
      );

      if (result.discoverySucceeded && result.loginUrl) {
        setSuccess(
          `אושר כשירות מובנה (${result.globalId}). דף כניסה: ${result.loginUrl}`,
        );
      } else {
        setSuccess(
          `אושר כשירות מובנה (${result.globalId}). ${result.discoveryMessage}`,
        );
      }

      setSelectedId(null);
      setGlobalIdOverride('');
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'דחייה נכשלה.');
    }
  }

  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <h2>תור אישורים</h2>
        <p>
          סקירת שירותים שהוגשו על ידי משתמשים. אישור הופך את השירות לשירות מובנה
          (built_in) בקטלוג הגלובלי — זמין לכל המשתמשים.
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

      <div className="admin-split">
        <ul className="admin-list admin-list--compact admin-split-main">
          {rows.length === 0 && !loading && (
            <li className="admin-muted">אין הגשות ממתינות כרגע.</li>
          )}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`admin-list-button ${selectedId === row.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(row.id)}
              >
                <span className="admin-list-button-title">{row.display_name}</span>
                <span className="admin-list-button-meta">
                  {row.id} · {row.service_status} · משתמש {row.owner_user_id?.slice(0, 8)}…
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="admin-split-detail">
          {selected ? (
            <>
              <section className="admin-panel">
                <h3 className="admin-panel-title">פרטי הגשה</h3>
                <dl className="admin-status-grid">
                  <div>
                    <dt>מזהה</dt>
                    <dd>{selected.id}</dd>
                  </div>
                  <div>
                    <dt>שם</dt>
                    <dd>{selected.display_name}</dd>
                  </div>
                  <div>
                    <dt>כתובת</dt>
                    <dd>{selected.primary_url}</dd>
                  </div>
                  <div>
                    <dt>סטטוס</dt>
                    <dd>{selected.service_status}</dd>
                  </div>
                </dl>

                <label className="admin-field">
                  <span>מזהה גלובלי (אופציונלי — ברירת מחדל: מזהה ההגשה)</span>
                  <input
                    value={globalIdOverride}
                    onChange={(e) => setGlobalIdOverride(e.target.value)}
                    placeholder={selected.id}
                  />
                </label>

                <label className="admin-field">
                  <span>סיבת דחייה (אופציונלי)</span>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="סיבה קצרה למשתמש הפנימי"
                  />
                </label>

                <div className="admin-actions-row">
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={discovering}
                    onClick={() => void handleApprove()}
                  >
                    אשר כשירות מובנה
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => void handleReject()}
                  >
                    דחה
                  </button>
                </div>
              </section>

              <IntegrationStatusPanel row={selected} />
            </>
          ) : (
            <p className="admin-muted">בחרו הגשה לסקירה.</p>
          )}
        </div>
      </div>
    </section>
  );
}
