import { useCallback, useEffect, useState } from 'react';
import {
  adminBulkRefreshLoginUrls,
  adminTriggerLoginRediscovery,
  adminUpdateLoginUrl,
  createGlobalRegistryRowWithDiscovery,
  disableGlobalRegistryRow,
  fetchAdminCategories,
  fetchGlobalRegistryRows,
  fetchRegistryRowForAdmin,
  markGlobalLoginUrlInvalid,
  parseLoginFieldsJson,
  updateGlobalRegistryRow,
  updateIconMetadata,
  type AdminCategory,
  type AdminRegistryRow,
  type BulkLoginUrlRefreshReport,
  type GlobalRegistryInput,
} from './adminRegistryApi';
import { deriveRegistryServiceIdFromUrl } from '../registry/serviceIdFromUrl';
import IconMetadataEditor from './IconMetadataEditor';
import IntegrationStatusPanel from './IntegrationStatusPanel';
import LoginUrlRefresh from './LoginUrlRefresh';
import ServiceExternalLinks from './ServiceExternalLinks';

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

function emptyCreateForm(categories: AdminCategory[]): GlobalRegistryInput {
  return {
    ...EMPTY_FORM,
    category_id: categories[0]?.id ?? null,
  };
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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [registryRows, categoryRows] = await Promise.all([
        fetchGlobalRegistryRows(),
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
        setError(err instanceof Error ? err.message : 'טעינת שירות נכשלה.');
      }
    })();
  }, [selectedId, rows]);

  function startCreate() {
    setIsCreating(true);
    setSelectedId(null);
    setSelectedRow(null);
    setForm(emptyCreateForm(categories));
  }

  function startEdit(row: AdminRegistryRow) {
    setIsCreating(false);
    setSelectedId(row.id);
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

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (isCreating) {
        setDiscovering(true);
        setSuccess('שומר שירות ומחפש דף כניסה…');

        const result = await createGlobalRegistryRowWithDiscovery(form);
        setIsCreating(false);
        setSelectedId(result.serviceId);

        if (result.discoverySucceeded && result.loginUrl) {
          setSuccess(`השירות נוצר. נמצא דף כניסה: ${result.loginUrl}`);
        } else {
          setSuccess(
            `השירות נוצר (מזהה: ${result.serviceId}). ${result.discoveryMessage}`,
          );
        }
      } else if (selectedId) {
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
        setSuccess('השירות עודכן.');
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
          ? 'לרענן כתובות כניסה לכל השירותים הפעילים, כולל כתובות שערך מנהל?'
          : 'לרענן כתובות כניסה לכל השירותים הפעילים (מדלג על עריכות מנהל)?',
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
    if (!window.confirm(`להשבית את השירות "${serviceId}"?`)) {
      return;
    }

    setError(null);
    try {
      await disableGlobalRegistryRow(serviceId);
      setSuccess('השירות הושבת.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השבתה נכשלה.');
    }
  }

  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <h2>קטלוג שירותים גלובלי</h2>
        <p>יצירה ותחזוקה של שורות קטלוג גלובליות (ללא גישה לפרטי כניסה של משתמשים).</p>
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

      <div className="admin-split">
        <div className="admin-split-main">
          <div className="admin-actions-row">
            <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
              שירות גלובלי חדש
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
            <pre className="admin-pre" aria-label="דוח רענון מרוכז">
              {JSON.stringify(bulkReport, null, 2)}
            </pre>
          )}

          <ul className="admin-list admin-list--compact">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`admin-list-item ${selectedId === row.id ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="admin-list-button"
                  onClick={() => startEdit(row)}
                >
                  <span className="admin-list-button-title">
                    {row.icon ?? '🔗'} {row.display_name}
                  </span>
                  <span className="admin-list-button-meta">
                    {row.id} · {row.source_type} · {row.service_status}
                  </span>
                </button>
                <ServiceExternalLinks
                  compact
                  primaryUrl={row.primary_url}
                  loginUrl={row.login_url}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-split-detail">
          {(isCreating || selectedId) && (
            <form className="admin-form" onSubmit={(event) => void handleSave(event)}>
              <h3>{isCreating ? 'יצירת שירות' : `עריכת ${selectedId}`}</h3>
              {isCreating ? (
                <p className="admin-muted">
                  מזהה שייווצר אוטומטית מהאתר:{' '}
                  <strong>
                    {deriveRegistryServiceIdFromUrl(form.primary_url) || '— הזינו כתובת ראשית'}
                  </strong>
                </p>
              ) : (
                <>
                  <p className="admin-muted">מזהה: {selectedId}</p>
                  <ServiceExternalLinks
                    primaryUrl={form.primary_url || selectedRow?.primary_url}
                    loginUrl={selectedRow?.login_url}
                  />
                </>
              )}

              <label className="admin-field">
                <span>כתובת ראשית</span>
                <input
                  type="url"
                  value={form.primary_url}
                  onChange={(e) => setForm({ ...form, primary_url: e.target.value })}
                  required
                  placeholder="https://www.example.co.il"
                  autoFocus
                />
              </label>
              <label className="admin-field">
                <span>שם תצוגה</span>
                <input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  required
                />
              </label>
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
                <span>מקור (source_type)</span>
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
              </label>
              <label className="admin-field">
                <span>סטטוס שירות</span>
                <select
                  value={form.service_status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      service_status: e.target.value as GlobalRegistryInput['service_status'],
                    })
                  }
                >
                  <option value="active">active</option>
                  <option value="deprecated">deprecated</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Adapter (ריק = generic)</span>
                <input
                  value={form.adapter_id ?? ''}
                  onChange={(e) => setForm({ ...form, adapter_id: e.target.value })}
                />
              </label>

              <div className="admin-actions-row">
                <button type="submit" className="admin-btn admin-btn-primary" disabled={discovering}>
                  שמור
                </button>
                {!isCreating && selectedId && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => void handleDisable(selectedId)}
                  >
                    השבת
                  </button>
                )}
              </div>
            </form>
          )}

          {selectedRow && selectedRow.owner_user_id === null && (
            <>
              <LoginUrlRefresh
                row={selectedRow}
                onManualSave={async (loginUrl, loginFieldsJson) => {
                  const loginFields = parseLoginFieldsJson(loginFieldsJson);
                  await adminUpdateLoginUrl(selectedRow.id, loginUrl, loginFields, 'valid');
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
              <IntegrationStatusPanel row={selectedRow} />
              <IconMetadataEditor
                row={selectedRow}
                onSave={async (patch) => {
                  await updateIconMetadata(selectedRow.id, patch);
                  setSuccess('מטא-דאטת אייקון עודכנה.');
                  await reload();
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
