import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminBulkRefreshLoginUrls,
  adminTriggerLoginRediscovery,
  adminUpdateLoginUrl,
  createGlobalRegistryRowWithDiscovery,
  disableGlobalRegistryRow,
  fetchAdminCategories,
  fetchAllRegistryRowsForAdmin,
  fetchRegistryRowForAdmin,
  markGlobalLoginUrlInvalid,
  parseLoginFieldsJson,
  updateGlobalRegistryRow,
  updateUserOwnedRegistryRow,
  updateIconMetadata,
  uploadAdminIconFile,
  adminRefreshServiceIcon,
  adminRefreshLoginIntelligence,
  adminOverrideLoginIntelligence,
  type AdminCategory,
  type AdminRegistryRow,
  type BulkLoginUrlRefreshReport,
  type GlobalRegistryInput,
} from './adminRegistryApi';
import {
  addedByLabel,
  formatAdminDate,
  sourceFilterKind,
  sourceKindLabelHe,
  statusLabelHe,
} from './adminPresentation';
import { deriveRegistryServiceIdFromUrl } from '../registry/serviceIdFromUrl';
import IconAssetEditor from './IconAssetEditor';
import IntegrationStatusPanel from './IntegrationStatusPanel';
import LoginIntelligencePanel from './LoginIntelligencePanel';
import LoginUrlRefresh from './LoginUrlRefresh';
import UrlFieldWithCopy from './UrlFieldWithCopy';
import { adminRowToLogoService } from './adminLogoService';
import { useServiceLogos } from '../useServiceLogos';

const EMPTY_FORM: GlobalRegistryInput = {
  display_name: '',
  primary_url: '',
  login_url: '',
  category_id: null,
  icon: '🔗',
  adapter_id: '',
  source_type: 'admin',
  service_status: 'active',
};

type SourceFilter = 'all' | 'built_in' | 'custom' | 'user_submitted';
type StatusFilter = 'all' | 'active' | 'inactive';

function emptyCreateForm(categories: AdminCategory[]): GlobalRegistryInput {
  return {
    ...EMPTY_FORM,
    category_id: categories[0]?.id ?? null,
  };
}

function SiteIcon({
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

export default function RegistryAdmin() {
  const [rows, setRows] = useState<AdminRegistryRow[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AdminRegistryRow | null>(null);
  const [form, setForm] = useState<GlobalRegistryInput>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [forceBulkOverwrite, setForceBulkOverwrite] = useState(false);
  const [bulkReport, setBulkReport] = useState<BulkLoginUrlRefreshReport | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

  const logoServices = useMemo(() => rows.map(adminRowToLogoService), [rows]);
  const logos = useServiceLogos(logoServices);

  const categoryLabel = useCallback(
    (categoryId: string | null | undefined) => {
      if (!categoryId) return 'ללא קטגוריה';
      return categories.find((c) => c.id === categoryId)?.display_name ?? categoryId;
    },
    [categories],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [registryRows, categoryRows] = await Promise.all([
        fetchAllRegistryRowsForAdmin(),
        fetchAdminCategories(),
      ]);
      setRows(registryRows);
      setCategories(categoryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת קטלוג נכשלה.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRow(null);
      return;
    }

    void (async () => {
      try {
        const row = await fetchRegistryRowForAdmin(selectedId);
        setSelectedRow(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'טעינת אתר נכשלה.');
      }
    })();
  }, [selectedId, rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterCategory && row.category_id !== filterCategory) return false;
      if (filterSource !== 'all' && sourceFilterKind(row) !== filterSource) return false;
      if (filterStatus === 'active' && row.service_status !== 'active') return false;
      if (
        filterStatus === 'inactive' &&
        row.service_status !== 'disabled' &&
        row.service_status !== 'deprecated'
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        row.display_name,
        categoryLabel(row.category_id),
        row.login_url ?? '',
        row.primary_url ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filterCategory, filterSource, filterStatus, categoryLabel]);

  function startCreate() {
    setIsCreating(true);
    setSelectedId(null);
    setSelectedRow(null);
    setShowMoreDetails(false);
    setForm(emptyCreateForm(categories));
  }

  function startEdit(row: AdminRegistryRow) {
    setIsCreating(false);
    setSelectedId(row.id);
    setShowMoreDetails(false);
    setForm({
      id: row.id,
      display_name: row.display_name,
      primary_url: row.primary_url,
      login_url: row.login_url,
      category_id: row.category_id,
      icon: row.icon,
      adapter_id: row.adapter_id,
      source_type: row.source_type as GlobalRegistryInput['source_type'],
      service_status: row.service_status as GlobalRegistryInput['service_status'],
      login_url_status: row.login_url_status,
      metadata: row.metadata ?? {},
    });
  }

  function cancelEdit() {
    setIsCreating(false);
    setSelectedId(null);
    setSelectedRow(null);
    setShowMoreDetails(false);
    setForm(EMPTY_FORM);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (isCreating) {
        setDiscovering(true);
        setSuccess('שומר אתר ומחפש דף כניסה…');

        const result = await createGlobalRegistryRowWithDiscovery(form);
        setIsCreating(false);
        setSelectedId(result.serviceId);

        if (result.discoverySucceeded && result.loginUrl) {
          setSuccess(`האתר נוצר. נמצא דף כניסה: ${result.loginUrl}`);
        } else {
          setSuccess(
            `האתר נוצר (מזהה: ${result.serviceId}). ${result.discoveryMessage}`,
          );
        }
      } else if (selectedId) {
        if (selectedRow?.owner_user_id != null) {
          await updateUserOwnedRegistryRow(selectedId, {
            display_name: form.display_name,
            primary_url: form.primary_url,
            login_url: form.login_url,
            category_id: form.category_id,
            service_status: form.service_status,
          });
          setSuccess('הגשת המשתמש עודכנה.');
        } else {
          await updateGlobalRegistryRow(selectedId, {
            display_name: form.display_name,
            primary_url: form.primary_url,
            login_url: form.login_url,
            category_id: form.category_id,
            icon: form.icon,
            adapter_id: form.adapter_id || null,
            source_type: form.source_type,
            service_status: form.service_status,
            metadata: form.metadata,
          });
          setSuccess('האתר עודכן.');
        }
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה.');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleBulkRefresh() {
    if (
      !window.confirm(
        forceBulkOverwrite
          ? 'לרענן כתובות כניסה לכל האתרים הפעילים, כולל כתובות שערך מנהל?'
          : 'לרענן כתובות כניסה לכל האתרים הפעילים (מדלג על עריכות מנהל)?',
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setBulkRunning(true);
    setBulkReport(null);

    try {
      const report = await adminBulkRefreshLoginUrls(forceBulkOverwrite);
      setBulkReport(report);
      setSuccess(
        `רענון מרוכז הושלם: ${report.succeeded.length} הצליחו, ${report.failed.length} נכשלו, ${report.skipped.length} דולגו.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'רענון מרוכז נכשל.');
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleDisable(serviceId: string) {
    if (selectedRow?.owner_user_id != null) {
      setError('לא ניתן להשבית כאן אתר בבעלות משתמש. השתמשו באישור או דחייה בתור ההגשות.');
      return;
    }
    if (!window.confirm('להשבית את האתר הזה?')) {
      return;
    }

    setError(null);
    try {
      await disableGlobalRegistryRow(serviceId);
      setSuccess('האתר הושבת.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השבתה נכשלה.');
    }
  }

  const editing = isCreating || selectedId;
  const isUserOwnedRow =
    !isCreating && selectedRow != null && selectedRow.owner_user_id != null;

  return (
    <section className="admin-section admin-section--registry">
      <header className="admin-section-header">
        <h2>כל האתרים</h2>
        <p>
          קטלוג מלא של אתרים (מובנים, מנהל, והגשות משתמשים) — ללא גישה לפרטי כניסה של משתמשים.
          השתמשו בסינון לפי מקור וסטטוס.
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
          מחפש דף כניסה… (דורש הרחבת דפדפן)
        </p>
      )}
      {success && !discovering && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}

      <div className="admin-toolbar">
        <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
          אתר חדש
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          disabled={bulkRunning || loading}
          onClick={() => void handleBulkRefresh()}
        >
          {bulkRunning ? 'מרענן כתובות כניסה…' : 'רענון כניסה מרוכז'}
        </button>
        <label className="admin-chip">
          <input
            type="checkbox"
            checked={forceBulkOverwrite}
            onChange={(e) => setForceBulkOverwrite(e.target.checked)}
            disabled={bulkRunning}
          />{' '}
          דרוס עריכות מנהל
        </label>
      </div>

      {bulkReport && (
        <details className="admin-details" style={{ marginBottom: '0.75rem' }}>
          <summary>דוח רענון מרוכז</summary>
          <pre className="admin-pre" aria-label="דוח רענון מרוכז">
            {JSON.stringify(bulkReport, null, 2)}
          </pre>
        </details>
      )}

      <div className="admin-filters" role="search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, קטגוריה או כתובת כניסה"
          aria-label="חיפוש אתרים"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="סינון לפי קטגוריה"
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.display_name}
            </option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as SourceFilter)}
          aria-label="סינון לפי מקור"
        >
          <option value="all">כל המקורות</option>
          <option value="built_in">מובנה</option>
          <option value="custom">מותאם / מנהל</option>
          <option value="user_submitted">הוגש על ידי משתמש</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="inactive">לא פעיל</option>
        </select>
      </div>

      <div className="admin-split">
        <div
          className="admin-split-main admin-scroll-panel"
          aria-label="רשימת אתרים"
        >
          <ul className="admin-card-grid">
            {filteredRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`admin-site-card${selectedId === row.id ? ' is-active' : ''}`}
                  onClick={() => startEdit(row)}
                >
                  <div className="admin-site-card-head">
                    <SiteIcon row={row} logoSrc={logos[row.id]} />
                    <div>
                      <div className="admin-site-card-name">{row.display_name}</div>
                      <div className="admin-site-card-meta">
                        <span className="admin-badge">{categoryLabel(row.category_id)}</span>
                        <span className="admin-badge admin-badge--muted">
                          {sourceKindLabelHe(row)}
                        </span>
                        <span
                          className={`admin-badge${
                            row.service_status === 'active' ? ' admin-badge--ok' : ' admin-badge--warn'
                          }`}
                        >
                          {statusLabelHe(row.service_status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="admin-site-card-line">
                    <strong>נוסף:</strong> {formatAdminDate(row.created_at)} ·{' '}
                    <strong>על ידי:</strong> {addedByLabel(row)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {!loading && filteredRows.length === 0 && (
            <p className="admin-muted">לא נמצאו אתרים התואמים לסינון.</p>
          )}
        </div>

        <div className="admin-split-detail admin-scroll-panel" aria-label="עריכת אתר">
          {editing && (
            <form className="admin-edit-shell" onSubmit={(event) => void handleSave(event)}>
              <h3>
                {isCreating
                  ? 'יצירת אתר'
                  : isUserOwnedRow
                    ? 'פרטי אתר (הגשת משתמש)'
                    : 'עריכת אתר'}
              </h3>

              {isUserOwnedRow && (
                <p className="admin-field-hint" role="status">
                  זו הגשה בבעלות משתמש — ניתן לערוך את השדות ולשמור. לאישור או דחייה עברו ל-
                  «אתרים בהוספה ע&quot;י משתמשים».
                </p>
              )}

              <div className="admin-collapse-body" style={{ padding: 0 }}>
                <label className="admin-field">
                  <span>שם האתר</span>
                  <input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    required
                    autoFocus
                  />
                </label>
                <UrlFieldWithCopy
                  label="כתובת הבית (Home URL)"
                  value={form.primary_url}
                  onChange={(value) => setForm({ ...form, primary_url: value })}
                  required
                  placeholder="https://www.example.co.il"
                />
                <UrlFieldWithCopy
                  label="כתובת כניסה (אופציונלי)"
                  value={form.login_url ?? ''}
                  onChange={(value) => setForm({ ...form, login_url: value })}
                  placeholder="ריק = ייעשה שימוש בכתובת הבית"
                  hint="אם כתובת הכניסה ריקה, הבית הדיגיטלי יפתח את כתובת הבית."
                />
                <label className="admin-field">
                  <span>קטגוריה</span>
                  <select
                    value={form.category_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value || null })
                    }
                  >
                    <option value="">ללא קטגוריה</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>סטטוס</span>
                  <select
                    value={form.service_status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        service_status: e.target.value as GlobalRegistryInput['service_status'],
                      })
                    }
                  >
                    <option value="active">פעיל</option>
                    <option value="pending_review">ממתין לאישור</option>
                    <option value="deprecated">מיושן</option>
                    <option value="disabled">מושבת</option>
                  </select>
                </label>
                {isCreating ? (
                  <p className="admin-muted">
                    מזהה טכני ייווצר אוטומטית:{' '}
                    <strong>
                      {deriveRegistryServiceIdFromUrl(form.primary_url) || '— הזינו כתובת בית'}
                    </strong>
                  </p>
                ) : null}
              </div>

              <div className="admin-actions-row">
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={discovering}
                >
                  שמור
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={cancelEdit}
                >
                  ביטול
                </button>
                {!isCreating && selectedId && (
                  <>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => setShowMoreDetails(true)}
                    >
                      פרטים נוספים
                    </button>
                    {!isUserOwnedRow && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() => void handleDisable(selectedId)}
                      >
                        השבת
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          )}

          {!isCreating && selectedRow && selectedRow.owner_user_id === null && (
            <>
              <details className="admin-collapse">
                <summary>אייקון</summary>
                <div className="admin-collapse-body">
                  <IconAssetEditor
                    row={selectedRow}
                    onUploadFile={async (file) => {
                      await uploadAdminIconFile(selectedRow.id, file);
                      setSuccess('האייקון הועלה ונשמר כנכס מנוהל פעיל.');
                      await reload();
                    }}
                    onSaveSecondaryMetadata={async (patch) => {
                      await updateIconMetadata(selectedRow.id, patch);
                      setSuccess('מטא-דאטה משנית לעיצוב אייקון עודכנה.');
                      await reload();
                    }}
                    onRefreshAsset={async (options) => {
                      const result = await adminRefreshServiceIcon(
                        selectedRow.id,
                        options,
                      );
                      setSuccess(result.message);
                      await reload();
                    }}
                  />
                </div>
              </details>

              <details className="admin-collapse">
                <summary>רענון / עריכת כתובת כניסה</summary>
                <div className="admin-collapse-body">
                  <LoginUrlRefresh
                    row={selectedRow}
                    onManualSave={async (loginUrl, loginFieldsJson) => {
                      const loginFields = parseLoginFieldsJson(loginFieldsJson);
                      await adminUpdateLoginUrl(
                        selectedRow.id,
                        loginUrl,
                        loginFields,
                        'valid',
                      );
                      setSuccess('כתובת הכניסה עודכנה.');
                      await reload();
                    }}
                    onMarkInvalid={async () => {
                      await markGlobalLoginUrlInvalid(selectedRow.id);
                      setSuccess('כתובת הכניסה סומנה כלא תקינה.');
                      await reload();
                    }}
                    onRediscover={async () => {
                      const result = await adminTriggerLoginRediscovery(selectedRow.id);
                      setSuccess(result.message);
                      await reload();
                      return result.message;
                    }}
                  />
                </div>
              </details>
            </>
          )}

          {!editing && (
            <p className="admin-muted">בחרו כרטיס אתר לעריכה, או צרו אתר חדש.</p>
          )}
        </div>
      </div>

      {showMoreDetails && selectedRow && (
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
            aria-labelledby="admin-more-details-title"
            dir="rtl"
          >
            <div className="admin-modal-header">
              <h3 id="admin-more-details-title">פרטים נוספים</h3>
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
                <dt>מזהה גלובלי</dt>
                <dd>{selectedRow.id}</dd>
              </div>
              <div>
                <dt>מקור (source_type)</dt>
                <dd>
                  <select
                    value={form.source_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        source_type: e.target.value as GlobalRegistryInput['source_type'],
                      })
                    }
                  >
                    <option value="admin">admin</option>
                    <option value="approved_global">approved_global</option>
                    <option value="built_in">built_in</option>
                  </select>
                </dd>
              </div>
              <div>
                <dt>Adapter</dt>
                <dd>
                  <input
                    value={form.adapter_id ?? ''}
                    onChange={(e) => setForm({ ...form, adapter_id: e.target.value })}
                    placeholder="ריק = generic"
                  />
                </dd>
              </div>
              <div>
                <dt>login_url_status</dt>
                <dd>{selectedRow.login_url_status ?? '—'}</dd>
              </div>
              <div>
                <dt>metadata_version</dt>
                <dd>{selectedRow.metadata_version ?? '—'}</dd>
              </div>
              <div>
                <dt>updated_at</dt>
                <dd>{selectedRow.updated_at ?? '—'}</dd>
              </div>
            </dl>

            <details className="admin-details" style={{ marginTop: '0.75rem' }}>
              <summary>מטא-דאטה (JSON)</summary>
              <pre className="admin-pre">{JSON.stringify(selectedRow.metadata ?? {}, null, 2)}</pre>
            </details>

            {selectedRow.owner_user_id === null && (
              <>
                <IntegrationStatusPanel row={selectedRow} />
                <LoginIntelligencePanel
                  row={selectedRow}
                  onRefresh={async (options) => {
                    const result = await adminRefreshLoginIntelligence(
                      selectedRow.id,
                      options,
                    );
                    setSuccess(result.message);
                    await reload();
                    return result.message;
                  }}
                  onOverride={async (patch) => {
                    await adminOverrideLoginIntelligence(selectedRow.id, patch);
                    setSuccess('דריסת Login Intelligence נשמרה.');
                    await reload();
                  }}
                />
              </>
            )}

            <div className="admin-actions-row" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setShowMoreDetails(false)}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
