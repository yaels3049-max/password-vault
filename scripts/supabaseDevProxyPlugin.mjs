import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/** fetch() decompresses the body; forwarding these breaks browser/Node clients. */
const STRIP_FROM_RESPONSE = new Set([
  ...HOP_BY_HOP,
  'content-encoding',
  'content-length',
]);

const PROXY_PREFIX = '/dev-supabase-proxy';

/** Project base URL only — no `/rest/v1/` suffix (D-101-8). */
export function normalizeSupabaseBaseUrl(rawUrl) {
  return rawUrl.trim().replace(/\/$/, '').replace(/\/rest\/v1\/?$/i, '');
}

function resolveCaPath() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) {
    return extra;
  }

  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8' }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      return cafile;
    }
  } catch {
    // ignore
  }

  return null;
}

/** Node fetch() honors NODE_EXTRA_CA_CERTS; https.Agent({ ca }) does not on this network. */
export function bootstrapDevProxyTls() {
  const caPath = resolveCaPath();
  if (caPath) {
    process.env.NODE_EXTRA_CA_CERTS = caPath;
  }
  return caPath;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function forwardToSupabase(req, res, targetBase) {
  const incomingUrl = req.url ?? '';
  const pathWithQuery = incomingUrl.startsWith(PROXY_PREFIX)
    ? incomingUrl.slice(PROXY_PREFIX.length) || '/'
    : incomingUrl;

  const targetUrl = new URL(pathWithQuery, targetBase);

  try {
    const body = await readRequestBody(req);
    const headers = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (!value || HOP_BY_HOP.has(name)) {
        continue;
      }

      if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      } else {
        headers.set(name, value);
      }
    }

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!STRIP_FROM_RESPONSE.has(key)) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  } catch (error) {
    res.statusCode = 502;
    res.end(error instanceof Error ? error.message : 'supabase_proxy_failed');
  }
}

/**
 * Dev-only reverse proxy: browser → Vite → Supabase.
 * Avoids browser "Failed to fetch" on networks that block or MITM direct calls.
 */
export function supabaseDevProxyPlugin(targetBase) {
  if (!targetBase) {
    return { name: 'supabase-dev-proxy-disabled' };
  }

  const caPath = bootstrapDevProxyTls();

  return {
    name: 'supabase-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      if (caPath) {
        console.log(`[dev-supabase-proxy] TLS CA: ${caPath}`);
      } else {
        console.warn('[dev-supabase-proxy] No CA bundle — proxy may fail on corporate TLS.');
      }

      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? '').startsWith(PROXY_PREFIX)) {
          next();
          return;
        }
        void forwardToSupabase(req, res, targetBase);
      });
    },
  };
}
