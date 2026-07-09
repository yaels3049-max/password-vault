import type { AdminRegistryRow } from './adminRegistryApi';
import ServiceExternalLinks from './ServiceExternalLinks';

interface IntegrationStatusPanelProps {
  row: AdminRegistryRow;
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null) {
    return '—';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function IntegrationStatusPanel({ row }: IntegrationStatusPanelProps) {
  const metadata = row.metadata ?? {};

  return (
    <section className="admin-panel admin-panel--readonly">
      <h3 className="admin-panel-title">סטטוס אינטגרציה</h3>
      <ServiceExternalLinks primaryUrl={row.primary_url} loginUrl={row.login_url} />
      <dl className="admin-status-grid">
        <div>
          <dt>מזהה שירות</dt>
          <dd>{row.id}</dd>
        </div>
        <div>
          <dt>מקור</dt>
          <dd>{row.source_type}</dd>
        </div>
        <div>
          <dt>סטטוס שירות</dt>
          <dd>{row.service_status}</dd>
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
          <dt>כתובת ראשית</dt>
          <dd>{row.primary_url ?? '—'}</dd>
        </div>
        <div>
          <dt>כתובת כניסה</dt>
          <dd>{row.login_url ?? '—'}</dd>
        </div>
        <div>
          <dt>שיטת גילוי</dt>
          <dd>{String(metadata.discoveryMethod ?? '—')}</dd>
        </div>
        <div>
          <dt>בריאות אינטגרציה</dt>
          <dd>{formatJson(metadata.integrationHealth)}</dd>
        </div>
        <div>
          <dt>תוצאת גילוי אחרונה</dt>
          <dd>
            <pre className="admin-pre">{formatJson(metadata.lastDiscoveryOutcome)}</pre>
          </dd>
        </div>
        <div>
          <dt>הערות מנהל</dt>
          <dd>{String(metadata.adminNotes ?? '—')}</dd>
        </div>
        <div>
          <dt>עודכן לאחרונה</dt>
          <dd>{row.updated_at ?? '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
