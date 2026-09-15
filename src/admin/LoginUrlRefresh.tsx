import { useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import ServiceExternalLinks from './ServiceExternalLinks';

interface LoginUrlRefreshProps {
  row: AdminRegistryRow;
  onManualSave: (loginUrl: string) => Promise<void>;
  onMarkInvalid: () => Promise<void>;
}

export default function LoginUrlRefresh({
  row,
  onManualSave,
  onMarkInvalid,
}: LoginUrlRefreshProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        {isBuiltIn ? 'כתובת כניסה — עריכה ידנית' : 'כתובת כניסה'}
      </h3>
      <p className="admin-panel-hint">
        עדכנו את כתובת הכניסה ידנית, או סמנו כלא תקינה. שמירה לא מחפשת דף כניסה.
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
          void run(async () => {
            await onManualSave(loginUrl);
          });
        }}
      >
        <label className="admin-field">
          <span>כתובת כניסה (Login URL)</span>
          <input name="loginUrl" type="url" defaultValue={row.login_url ?? ''} required />
          <p className="admin-field-hint">
            כתובת הבית:{' '}
            {row.primary_url || '—'}
            {!row.login_url
              ? ' · כשכתובת הכניסה ריקה, הבית הדיגיטלי משתמש בכתובת הבית.'
              : ''}
          </p>
        </label>
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
        </div>
      </form>
    </section>
  );
}
