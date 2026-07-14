import type { AdminRegistryRow } from './adminRegistryApi';
import ServiceExternalLinks from './ServiceExternalLinks';
import {
  adminDiscoveryErrorLabel,
  resolveLoginDiscoveryOutcomeState,
} from '../registry/loginDiscoveryMetadata';

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

function metaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  return String(value);
}

export default function IntegrationStatusPanel({ row }: IntegrationStatusPanelProps) {
  const metadata = row.metadata ?? {};
  const outcomeState = resolveLoginDiscoveryOutcomeState(row);
  const discoveryErrorCode =
    typeof metadata.loginUrlDiscoveryError === 'string' ? metadata.loginUrlDiscoveryError : null;

  return (
    <section className="admin-panel admin-panel--readonly">
      <h3 className="admin-panel-title">סטטוס אינטגרציה</h3>
      <p className="admin-muted">
        תוצאת גילוי חיה (D-108-20) — למה <code>login_url</code> נקבע או נשאר ריק.
      </p>
      <ServiceExternalLinks primaryUrl={row.primary_url} loginUrl={row.login_url} />
      <dl className="admin-status-grid">
        <div>
          <dt>מצב גילוי (loginUrlDiscoveryOutcome)</dt>
          <dd>{outcomeState}</dd>
        </div>
        <div>
          <dt>סיבת גילוי / שגיאה</dt>
          <dd>{adminDiscoveryErrorLabel(discoveryErrorCode)}</dd>
        </div>
        <div>
          <dt>קוד שגיאה גולמי</dt>
          <dd>{discoveryErrorCode ?? '—'}</dd>
        </div>
        <div>
          <dt>שיטת גילוי (discoveryMethod)</dt>
          <dd>{metaString(metadata, 'discoveryMethod')}</dd>
        </div>
        <div>
          <dt>ביטחון (loginUrlConfidence)</dt>
          <dd>{metaString(metadata, 'loginUrlConfidence')}</dd>
        </div>
        <div>
          <dt>rejectedLoginUrl</dt>
          <dd>{metaString(metadata, 'rejectedLoginUrl')}</dd>
        </div>
        <div>
          <dt>phase112Deferred</dt>
          <dd>{metaString(metadata, 'phase112Deferred')}</dd>
        </div>
        <div>
          <dt>loginIntelligenceHint</dt>
          <dd>{metaString(metadata, 'loginIntelligenceHint')}</dd>
        </div>
        <div>
          <dt>loginEntryType / usesModal</dt>
          <dd>
            {metaString(metadata, 'loginEntryType')} / {metaString(metadata, 'usesModal')}
          </dd>
        </div>
        <div>
          <dt>נבדק לאחרונה</dt>
          <dd>{metaString(metadata, 'loginUrlLastCheckedAt')}</dd>
        </div>
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
          <dt>כתובת ראשית</dt>
          <dd>{row.primary_url ?? '—'}</dd>
        </div>
        <div>
          <dt>כתובת כניסה (login_url)</dt>
          <dd>{row.login_url ?? '—'}</dd>
        </div>
        <div>
          <dt>תוצאת גילוי אחרונה (lastDiscoveryOutcome)</dt>
          <dd>
            <pre className="admin-pre">{formatJson(metadata.lastDiscoveryOutcome)}</pre>
          </dd>
        </div>
        <div>
          <dt>Payload גולמי מהרחבה (rawExtensionDiscovery)</dt>
          <dd>
            <pre className="admin-pre">{formatJson(metadata.rawExtensionDiscovery)}</pre>
          </dd>
        </div>
        <div>
          <dt>בריאות אינטגרציה (integrationHealth)</dt>
          <dd>{metaString(metadata, 'integrationHealth')}</dd>
        </div>
        <div>
          <dt>loginComplexity / lastValidatedBy</dt>
          <dd>
            {metaString(metadata, 'loginComplexity')} /{' '}
            {metaString(metadata, 'lastValidatedBy')}
          </dd>
        </div>
        <div>
          <dt>עודכן לאחרונה</dt>
          <dd>{row.updated_at ?? '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
