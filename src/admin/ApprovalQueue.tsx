import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminCategories,
  fetchPendingSubmissions,
  promoteUserSubmission,
  rejectUserSubmission,
  updateGlobalRegistryRow,
  type AdminCategory,
  type AdminRegistryRow,
  type SubmitterProfile,
} from './adminRegistryApi';
import {
  dedicatedLoginUrlOrNull,
  formatAdminDateTime,
  httpUrlOrNull,
  submitterLabel,
  UNKNOWN_SUBMITTER_HE,
} from './adminPresentation';
import { loadSubmitterProfiles, type SubmitterProfileMap } from './submitterProfiles';
import { adminRowToLogoService } from './adminLogoService';
import IntegrationStatusPanel from './IntegrationStatusPanel';
import AdminChipRow from './AdminChipRow';
import { useServiceLogos } from '../useServiceLogos';
import {
  ADMIN_DIRECT_URL_LABEL,
  ADMIN_PRIMARY_PAGE_LABEL,
  defaultLoginEntryType,
  resolveExplicitLoginEntry,
  type ExplicitLoginEntryType,
} from '../catalog/explicitLoginEntry';

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

/** URL as a new-tab link (valid http(s) only), plain text otherwise, «—» when empty. */
function UrlValue({ value, part }: { value: string | null | undefined; part: string }) {
  const text = value?.trim() ?? '';
  const href = httpUrlOrNull(text);
  if (href) {
    return (
      <a className="admin-pending-url" data-part={part} href={href} target="_blank" rel="noopener noreferrer" dir="ltr">
        {text}
      </a>
    );
  }
  return text ? (
    <bdi className="admin-pending-url" data-part={part} dir="ltr">
      {text}
    </bdi>
  ) : (
    <span data-part={part}>—</span>
  );
}

function Submitter({ profile }: { profile: SubmitterProfile | undefined }) {
  const { name, email } = submitterLabel(profile);
  if (!name && !email) return <span data-part="submitter-name">{UNKNOWN_SUBMITTER_HE}</span>;
  return (
    <>
      {name ? <span data-part="submitter-name">{name}</span> : null}
      {name && email ? ' · ' : null}
      {email ? (
        <a data-part="submitter-email" href={`mailto:${email}`} dir="ltr">
          {email}
        </a>
      ) : null}
    </>
  );
}

export default function ApprovalQueue() {
  const [rows, setRows] = useState<AdminRegistryRow[]>([]);
  const [profiles, setProfiles] = useState<SubmitterProfileMap>({});
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [globalIdOverride, setGlobalIdOverride] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [entryType, setEntryType] = useState<ExplicitLoginEntryType>('primary_page');
  const [confirmedLoginUrl, setConfirmedLoginUrl] = useState('');
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
      setProfiles(await loadSubmitterProfiles(pending));
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

  function selectSubmission(row: AdminRegistryRow) {
    const nextType = defaultLoginEntryType(
      row.login_url,
      row.primary_url,
      row.metadata?.loginEntryType,
    );
    setSelectedId(row.id);
    setEntryType(nextType);
    setConfirmedLoginUrl(nextType === 'direct_url' ? (row.login_url ?? '') : '');
    setShowMoreDetails(false);
  }

  async function handleApprove() {
    if (!selected) {
      return;
    }

    setError(null);
    setSuccess(null);

    let entry: ReturnType<typeof resolveExplicitLoginEntry>;
    try {
      entry = resolveExplicitLoginEntry({
        websiteUrl: selected.primary_url,
        sameAsWebsite: entryType === 'primary_page',
        dedicatedLoginUrl: confirmedLoginUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יש לאשר כתובת כניסה.');
      return;
    }

    try {
      setApproving(true);
      const globalId = await promoteUserSubmission(
        selected.id,
        globalIdOverride.trim() || undefined,
      );
      await updateGlobalRegistryRow(globalId, {
        login_url: entry.loginUrl,
        login_url_status: 'valid',
        metadata: {
          loginEntryType: entry.loginEntryType,
          loginUrlSource: 'admin',
        },
      });
      setSuccess(`אושר כאתר גלובלי (${globalId}).`);
      setSelectedId(null);
      setGlobalIdOverride('');
      setShowMoreDetails(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אישור נכשל.');
    } finally {
      setApproving(false);
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
      {approving && (
        <p className="admin-muted" role="status">
          מאשר…
        </p>
      )}
      {success && !approving && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}

      <div
        className="admin-scroll-panel admin-approvals-scroll"
        aria-label="הגשות ממתינות"
      >
      <ul className={`admin-pending-grid${selectedId && rows.some((r) => r.id === selectedId) ? ' has-selection' : ''}`}>
        {rows.length === 0 && !loading && (
          <li className="admin-muted">אין הגשות ממתינות כרגע.</li>
        )}
        {rows.map((row) => {
          const isSelected = selectedId === row.id;
          return (
            <li
              key={row.id}
              className={`admin-pending-card${isSelected ? ' is-active' : ''}`}
              data-submission={row.id}
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
                onClick={() => selectSubmission(row)}
              >
                <PreviewIcon row={row} logoSrc={logos[row.id]} />
                <div className="admin-site-card-name" title={row.display_name}>
                  {row.display_name}
                </div>
              </button>
              <div className="admin-site-card-meta">
                <AdminChipRow chips={[{ key: 'category', label: categoryLabel(row.category_id) }]} />
              </div>

              <dl className="admin-pending-facts" data-part="card-footer">
                <div data-fact="submitted-by">
                  <dt>הוגש ע&quot;י:</dt>
                  <dd>
                    <Submitter profile={row.owner_user_id ? profiles[row.owner_user_id] : undefined} />
                  </dd>
                </div>
                <div data-fact="submitted-at">
                  <dt>תאריך הגשה:</dt>
                  <dd>{formatAdminDateTime(row.created_at ?? row.updated_at)}</dd>
                </div>
                <div data-fact="home-url">
                  <dt>כתובת הבית:</dt>
                  <dd>
                    <UrlValue value={row.primary_url} part="home-url" />
                  </dd>
                </div>
                <div data-fact="login-url">
                  <dt>כתובת כניסה:</dt>
                  <dd>
                    <UrlValue value={dedicatedLoginUrlOrNull(row.metadata?.loginEntryType, row.login_url)} part="login-url" />
                  </dd>
                </div>
              </dl>

              {isSelected && (
                <>
                  <label className="admin-field">
                    <span>סוג כניסה לאישור</span>
                    <select
                      value={entryType}
                      onChange={(e) =>
                        setEntryType(e.target.value as ExplicitLoginEntryType)
                      }
                    >
                      <option value="primary_page">{ADMIN_PRIMARY_PAGE_LABEL}</option>
                      <option value="direct_url">{ADMIN_DIRECT_URL_LABEL}</option>
                    </select>
                  </label>
                  {entryType === 'direct_url' && (
                    <label className="admin-field">
                      <span>כתובת כניסה</span>
                      <input
                        type="url"
                        value={confirmedLoginUrl}
                        onChange={(e) => setConfirmedLoginUrl(e.target.value)}
                        placeholder="https://example.com/login"
                        required
                      />
                    </label>
                  )}
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
                      disabled={approving}
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
              <div data-fact="modal-login-url">
                <dt>כתובת כניסה</dt>
                <dd>
                  <UrlValue
                    value={dedicatedLoginUrlOrNull(selected.metadata?.loginEntryType, selected.login_url)}
                    part="modal-login-url"
                  />
                </dd>
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
