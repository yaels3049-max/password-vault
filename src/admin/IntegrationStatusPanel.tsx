import type { AdminRegistryRow } from './adminRegistryApi';
import ServiceExternalLinks from './ServiceExternalLinks';
import {
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  readAutofillProfileFromMetadata,
} from '../autofill/validatedProfile';

interface IntegrationStatusPanelProps {
  row: AdminRegistryRow;
}

function metaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  return String(value);
}

export default function IntegrationStatusPanel({ row }: IntegrationStatusPanelProps) {
  const metadata = row.metadata ?? {};
  const autofillProfile = readAutofillProfileFromMetadata(metadata);
  const supportStateLabel = autofillProfile
    ? AUTOFILL_SUPPORT_STATE_LABEL_HE[autofillProfile.supportState]
    : AUTOFILL_SUPPORT_STATE_LABEL_HE.not_configured;

  return (
    <section className="admin-panel admin-panel--readonly">
      <h3 className="admin-panel-title">סטטוס אינטגרציה</h3>
      <p className="admin-muted">כתובת הבית וכתובת הכניסה השמורות. אין סטטוס גילוי.</p>
      <ServiceExternalLinks primaryUrl={row.primary_url} loginUrl={row.login_url} />
      <dl className="admin-status-grid">
        <div>
          <dt>מזהה אתר</dt>
          <dd>{row.id}</dd>
        </div>
        <div>
          <dt>מקור / סטטוס אתר</dt>
          <dd>
            {row.source_type} / {row.service_status}
          </dd>
        </div>
        <div>
          <dt>Adapter</dt>
          <dd>{row.adapter_id ?? 'generic'}</dd>
        </div>
        <div>
          <dt>סטטוס כתובת כניסה</dt>
          <dd>{row.login_url_status}</dd>
        </div>
        <div>
          <dt>סוג כניסה</dt>
          <dd>{metaString(metadata, 'loginEntryType')}</dd>
        </div>
        <div>
          <dt>מקור כתובת כניסה</dt>
          <dd>{metaString(metadata, 'loginUrlSource')}</dd>
        </div>
        <div>
          <dt>כתובת ראשית</dt>
          <dd>{row.primary_url ?? '—'}</dd>
        </div>
        <div>
          <dt>כתובת כניסה (login_url)</dt>
          <dd>{row.login_url ?? '—'}</dd>
        </div>
        <div>
          <dt>מילוי אוטומטי מנוהל</dt>
          <dd>{supportStateLabel}</dd>
        </div>
        <div>
          <dt>עודכן לאחרונה</dt>
          <dd>{row.updated_at ?? '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
