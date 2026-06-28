import { useState } from 'react';
import { discoverLoginEntry, runLoginDiscoverySession, type DiscoveryResult } from '../discovery';
import { DISCOVERY_HARNESS_QA_URLS } from './discoveryHarnessDev';
import {
  formatDiscoveryResultSummary,
  type DiscoveryHarnessRunMeta,
} from './formatDiscoveryResult';
import './discoveryHarness.css';

export default function DiscoveryHarness() {
  const [primaryUrl, setPrimaryUrl] = useState('https://www.shufersal.co.il');
  const [manualHtml, setManualHtml] = useState('');
  const [useDevProxy, setUseDevProxy] = useState(true);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [tryCommonPaths, setTryCommonPaths] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [runMeta, setRunMeta] = useState<DiscoveryHarnessRunMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDiscovery() {
    setRunning(true);
    setError(null);
    setResult(null);
    setRunMeta(null);

    const started = performance.now();
    let htmlSource: DiscoveryHarnessRunMeta['htmlSource'] = 'none';
    let htmlFetchNote: string | undefined;

    const pastedHtml = manualHtml.trim();
    let discoveryResult: DiscoveryResult;

    if (pastedHtml) {
      htmlSource = 'manual-paste';
      discoveryResult = await discoverLoginEntry(primaryUrl.trim(), {
        html: pastedHtml,
        pageUrl: primaryUrl.trim(),
        followRedirects,
        tryCommonPaths,
      });
    } else {
      const session = await runLoginDiscoverySession({
        primaryUrl: primaryUrl.trim(),
        fetchHtml: useDevProxy,
        followRedirects,
        tryCommonPaths,
      });
      discoveryResult = session.discovery;

      if (useDevProxy) {
        if (session.fetchResult?.ok) {
          htmlSource = 'dev-proxy';
          htmlFetchNote = `Loaded HTML via dev proxy (HTTP ${session.fetchResult.status}). Final URL: ${session.fetchResult.finalUrl}`;
        } else {
          htmlFetchNote = `Dev proxy fetch failed: ${session.fetchResult?.reason ?? 'unknown'}${session.fetchResult?.status ? ` (HTTP ${session.fetchResult.status})` : ''}. Running discovery without HTML.`;
        }
      }
    }

    try {
      setResult(discoveryResult);
      setRunMeta({
        htmlSource,
        htmlFetchNote,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'discovery_failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="discovery-harness" dir="ltr">
      <header className="discovery-harness-header">
        <h1>Discovery Validation Harness</h1>
        <p>
          Developer-only tool for Iteration 3.2. Not connected to vault, services,
          or autofill.
        </p>
        <a
          href="#"
          className="discovery-harness-back"
          onClick={(event) => {
            event.preventDefault();
            window.location.hash = '';
            window.location.reload();
          }}
        >
          ← Back to app
        </a>
      </header>

      <section className="discovery-harness-panel">
        <label className="discovery-harness-field">
          <span>Primary URL</span>
          <input
            type="url"
            value={primaryUrl}
            onChange={(event) => setPrimaryUrl(event.target.value)}
            placeholder="https://example.com"
          />
        </label>

        <div className="discovery-harness-presets">
          <span>Suggested QA URLs:</span>
          {DISCOVERY_HARNESS_QA_URLS.map((url) => (
            <button
              key={url}
              type="button"
              className="discovery-harness-preset"
              onClick={() => setPrimaryUrl(url)}
            >
              {url.replace('https://www.', '')}
            </button>
          ))}
        </div>

        <div className="discovery-harness-options">
          <label>
            <input
              type="checkbox"
              checked={useDevProxy}
              onChange={(event) => setUseDevProxy(event.target.checked)}
            />
            Fetch HTML via dev proxy (for DOM inspection)
          </label>
          <label>
            <input
              type="checkbox"
              checked={followRedirects}
              onChange={(event) => setFollowRedirects(event.target.checked)}
            />
            Follow redirects
          </label>
          <label>
            <input
              type="checkbox"
              checked={tryCommonPaths}
              onChange={(event) => setTryCommonPaths(event.target.checked)}
            />
            Try common login paths
          </label>
        </div>

        <label className="discovery-harness-field">
          <span>Manual HTML paste (optional — overrides dev proxy)</span>
          <textarea
            value={manualHtml}
            onChange={(event) => setManualHtml(event.target.value)}
            rows={4}
            placeholder="Paste page HTML from browser DevTools to test DOM discovery offline"
          />
        </label>

        <button
          type="button"
          className="discovery-harness-run"
          disabled={running || !primaryUrl.trim()}
          onClick={() => void runDiscovery()}
        >
          {running ? 'Running discovery…' : 'Run discoverLoginEntry()'}
        </button>
      </section>

      {error && (
        <section className="discovery-harness-error">
          <h2>Error</h2>
          <pre>{error}</pre>
        </section>
      )}

      {runMeta && (
        <section className="discovery-harness-meta">
          <h2>Run metadata</h2>
          <dl>
            <div>
              <dt>HTML source</dt>
              <dd>{runMeta.htmlSource}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{runMeta.durationMs} ms</dd>
            </div>
          </dl>
          {runMeta.htmlFetchNote && <p>{runMeta.htmlFetchNote}</p>}
        </section>
      )}

      {result && (
        <>
          <section className="discovery-harness-summary">
            <h2>Summary</h2>
            <pre>{formatDiscoveryResultSummary(result)}</pre>
          </section>

          <section className="discovery-harness-details">
            <h2>DiscoveryResult fields</h2>
            <dl>
              <div>
                <dt>Primary URL</dt>
                <dd>{result.primaryUrl}</dd>
              </div>
              <div>
                <dt>Final URL after redirects</dt>
                <dd>{result.finalUrlAfterRedirects ?? '—'}</dd>
              </div>
              <div>
                <dt>Success</dt>
                <dd>{result.success ? 'true' : 'false'}</dd>
              </div>
              <div>
                <dt>Discovered login URL</dt>
                <dd>{result.loginUrl ?? '—'}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{result.method ?? '—'}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{result.confidence ?? '—'}</dd>
              </div>
              <div>
                <dt>Failure reason</dt>
                <dd>{result.reason ?? '—'}</dd>
              </div>
            </dl>

            <h3>Redirect chain</h3>
            {result.redirectChain && result.redirectChain.length > 0 ? (
              <ul>
                {result.redirectChain.map((url) => (
                  <li key={url}>{url}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}

            <h3>Candidates</h3>
            {result.candidates && result.candidates.length > 0 ? (
              <table className="discovery-harness-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Method</th>
                    <th>Confidence</th>
                    <th>URL</th>
                    <th>Label</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.candidates]
                    .sort((a, b) => b.score - a.score)
                    .map((candidate) => (
                      <tr key={`${candidate.method}-${candidate.url}-${candidate.score}`}>
                        <td>{candidate.score}</td>
                        <td>{candidate.method}</td>
                        <td>{candidate.confidence}</td>
                        <td>{candidate.url}</td>
                        <td>{candidate.label ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>—</p>
            )}

            {result.modalTrigger && (
              <>
                <h3>Modal trigger</h3>
                <pre>{JSON.stringify(result.modalTrigger, null, 2)}</pre>
              </>
            )}
          </section>

          <section className="discovery-harness-raw">
            <h2>Raw DiscoveryResult JSON</h2>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </section>
        </>
      )}
    </div>
  );
}
