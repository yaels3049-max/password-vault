import { useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import {
  LOGIN_COMPLEXITIES,
  INTEGRATION_HEALTH_STATES,
  ADAPTER_LIFECYCLES,
  readLoginIntelligence,
  type LoginComplexity,
  type IntegrationHealth,
  type AdapterLifecycle,
} from '../loginIntelligence';

interface LoginIntelligencePanelProps {
  row: AdminRegistryRow;
  onRefresh: (options?: { forceReplaceAdmin?: boolean }) => Promise<string>;
  onOverride: (patch: {
    loginComplexity: LoginComplexity;
    integrationHealth: IntegrationHealth;
    adapterRecommended: boolean;
    adapterLifecycle: AdapterLifecycle | null;
    adapterReason: string | null;
  }) => Promise<void>;
}

function metaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

export default function LoginIntelligencePanel({
  row,
  onRefresh,
  onOverride,
}: LoginIntelligencePanelProps) {
  const metadata = row.metadata ?? {};
  const li = readLoginIntelligence(metadata);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<LoginComplexity>(
    li?.loginComplexity ?? 'unknown',
  );
  const [health, setHealth] = useState<IntegrationHealth>(
    li?.integrationHealth ?? 'needs_review',
  );
  const [adapterRecommended, setAdapterRecommended] = useState(
    Boolean(li?.adapterRecommended),
  );
  const [adapterLifecycle, setAdapterLifecycle] = useState<AdapterLifecycle | ''>(
    li?.adapterLifecycle ?? '',
  );
  const [adapterReason, setAdapterReason] = useState(li?.adapterReason ?? '');

  return (
    <section className="admin-panel">
      <h3 className="admin-panel-title">Login Intelligence (Phase 112)</h3>
      <p className="admin-panel-hint">
        סיווג מורכבות התחברות, בריאות אינטגרציה והמלצת מתאם. דריסת מנהל אינה מוחלפת
        אוטומטית.
      </p>

      <dl className="admin-status-grid">
        <div>
          <dt>loginComplexity</dt>
          <dd>{li?.loginComplexity ?? '—'}</dd>
        </div>
        <div>
          <dt>loginFlowType</dt>
          <dd>{li?.loginFlowType ?? '—'}</dd>
        </div>
        <div>
          <dt>confidence / status</dt>
          <dd>
            {li?.loginDetectionConfidence ?? '—'} / {li?.loginDetectionStatus ?? '—'}
          </dd>
        </div>
        <div>
          <dt>engineVersion / lastValidatedBy</dt>
          <dd>
            {li?.loginDetectionEngineVersion ?? '—'} / {li?.lastValidatedBy ?? '—'}
          </dd>
        </div>
        <div>
          <dt>integrationHealth</dt>
          <dd>{li?.integrationHealth ?? metaString(metadata, 'integrationHealth')}</dd>
        </div>
        <div>
          <dt>adapterRecommended / lifecycle</dt>
          <dd>
            {String(li?.adapterRecommended ?? false)} / {li?.adapterLifecycle ?? '—'}
          </dd>
        </div>
        <div>
          <dt>adapterReason</dt>
          <dd>{li?.adapterReason ?? '—'}</dd>
        </div>
        <div>
          <dt>flags (otp/captcha/iframe/modal/multi)</dt>
          <dd>
            {String(li?.requiresOtp ?? false)}/{String(li?.requiresCaptcha ?? false)}/
            {String(li?.usesIframe ?? false)}/{String(li?.usesModal ?? false)}/
            {String(li?.isMultiStep ?? false)}
          </dd>
        </div>
        <div>
          <dt>adminOverride</dt>
          <dd>{String(Boolean(li?.loginIntelligenceAdminOverride))}</dd>
        </div>
        <div>
          <dt>phase112Deferred / hint (108)</dt>
          <dd>
            {metaString(metadata, 'phase112Deferred')} /{' '}
            {metaString(metadata, 'loginIntelligenceHint')}
          </dd>
        </div>
        <div>
          <dt>נבדק לאחרונה</dt>
          <dd>{li?.loginDetectionLastCheckedAt ?? '—'}</dd>
        </div>
      </dl>

      <div className="admin-form" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage(null);
            void onRefresh()
              .then((msg) => setMessage(msg))
              .catch((err: unknown) => {
                setMessage(err instanceof Error ? err.message : 'רענון נכשל');
              })
              .finally(() => setBusy(false));
          }}
        >
          רענון / סיווג מחדש
        </button>
        <button
          type="button"
          className="admin-btn"
          disabled={busy}
          style={{ marginInlineStart: 8 }}
          onClick={() => {
            setBusy(true);
            setMessage(null);
            void onRefresh({ forceReplaceAdmin: true })
              .then((msg) => setMessage(msg))
              .catch((err: unknown) => {
                setMessage(err instanceof Error ? err.message : 'דריסה נכשלה');
              })
              .finally(() => setBusy(false));
          }}
        >
          סיווג עם דריסת מנהל
        </button>
      </div>

      <form
        className="admin-form"
        style={{ marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setMessage(null);
          void onOverride({
            loginComplexity: complexity,
            integrationHealth: health,
            adapterRecommended,
            adapterLifecycle: adapterLifecycle || null,
            adapterReason: adapterReason.trim() || null,
          })
            .then(() => setMessage('דריסת מנהל נשמרה.'))
            .catch((err: unknown) => {
              setMessage(err instanceof Error ? err.message : 'שמירה נכשלה');
            })
            .finally(() => setBusy(false));
        }}
      >
        <label className="admin-field">
          <span>מורכבות (override)</span>
          <select
            value={complexity}
            onChange={(e) => setComplexity(e.target.value as LoginComplexity)}
          >
            {LOGIN_COMPLEXITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>בריאות אינטגרציה</span>
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value as IntegrationHealth)}
          >
            {INTEGRATION_HEALTH_STATES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>
            <input
              type="checkbox"
              checked={adapterRecommended}
              onChange={(e) => setAdapterRecommended(e.target.checked)}
            />{' '}
            המלצת מתאם
          </span>
        </label>
        <label className="admin-field">
          <span>lifecycle מתאם</span>
          <select
            value={adapterLifecycle}
            onChange={(e) =>
              setAdapterLifecycle(e.target.value as AdapterLifecycle | '')
            }
          >
            <option value="">—</option>
            {ADAPTER_LIFECYCLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>סיבת מתאם</span>
          <input
            type="text"
            value={adapterReason}
            onChange={(e) => setAdapterReason(e.target.value)}
            placeholder="iframe_login / otp_heavy / …"
          />
        </label>
        <button type="submit" className="admin-btn" disabled={busy}>
          שמור דריסת מנהל
        </button>
      </form>

      {message ? <p className="admin-muted" style={{ marginTop: 8 }}>{message}</p> : null}
    </section>
  );
}
