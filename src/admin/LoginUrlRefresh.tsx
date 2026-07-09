import { useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import { parseLoginFieldsJson } from './adminRegistryApi';
import ServiceExternalLinks from './ServiceExternalLinks';

interface LoginUrlRefreshProps {
  row: AdminRegistryRow;
  onManualSave: (loginUrl: string, loginFieldsJson: string) => Promise<void>;
  onMarkInvalid: () => Promise<void>;
  onRediscover: () => Promise<string>;
}

export default function LoginUrlRefresh({
  row,
  onManualSave,
  onMarkInvalid,
  onRediscover,
}: LoginUrlRefreshProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultFields = JSON.stringify(row.login_fields ?? [], null, 2);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await action();
      if (typeof result === 'string') {
        setMessage(result);
      } else {
        setMessage('הפעולה הושלמה בהצלחה.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  const isBuiltIn = row.source_type === 'built_in';

  return (
    <section className="admin-panel">
      <h3 className="admin-panel-title">
        {isBuiltIn ? 'כתובת כניסה — עריכה ידנית' : 'רענון כתובת כניסה'}
      </h3>
      <p className="admin-panel-hint">
        {isBuiltIn
          ? 'למקרים מורכבים שבהם הגילוי האוטומטי לא מוצא דף כניסה — עדכנו כאן ידנית. ניתן גם לסמן כלא תקין או להפעיל גילוי מחדש (דורש הרחבת דפדפן).'
          : 'ניתן לערוך ידנית, לסמן כלא תקין, או להפעיל גילוי מחדש (דורש הרחבת דפדפן).'}
      </p>

      <ServiceExternalLinks primaryUrl={row.primary_url} loginUrl={row.login_url} />

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}

      <form
        key={`${row.id}-${row.login_url ?? ''}-${row.updated_at ?? ''}`}
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const loginUrl = (form.elements.namedItem('loginUrl') as HTMLInputElement).value;
          const loginFieldsJson = (form.elements.namedItem('loginFieldsJson') as HTMLTextAreaElement)
            .value;
          void run(async () => {
            parseLoginFieldsJson(loginFieldsJson);
            await onManualSave(loginUrl, loginFieldsJson);
          });
        }}
      >
        <label className="admin-field">
          <span>כתובת כניסה</span>
          <input name="loginUrl" type="url" defaultValue={row.login_url ?? ''} required />
        </label>
        <details className="admin-details">
          <summary>שדות כניסה מתקדמים (JSON)</summary>
          <label className="admin-field">
            <span>שדות כניסה</span>
            <textarea name="loginFieldsJson" rows={6} defaultValue={defaultFields} />
          </label>
        </details>
        <div className="admin-actions-row">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            שמור ידנית
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={busy}
            onClick={() => void run(onMarkInvalid)}
          >
            סמן כלא תקין
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={busy}
            onClick={() => void run(onRediscover)}
          >
            גילוי מחדש
          </button>
        </div>
      </form>
    </section>
  );
}
