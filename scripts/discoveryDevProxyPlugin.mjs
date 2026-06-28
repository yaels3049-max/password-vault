import { fetchRemoteHtml } from './discoveryDevProxyFetch.mjs';

/** Dev-only generic HTML fetch for the Discovery Validation Harness (Iteration 3.2b). */
export function discoveryDevProxyPlugin() {
  return {
    name: 'discovery-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url ?? '';
        if (!reqUrl.startsWith('/dev-discovery-proxy')) {
          next();
          return;
        }

        try {
          const parsed = new URL(reqUrl, 'http://localhost');
          const target = parsed.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end('missing url parameter');
            return;
          }

          const targetUrl = new URL(target);
          if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
            res.statusCode = 400;
            res.end('invalid url protocol');
            return;
          }

          const { status, body, finalUrl } = await fetchRemoteHtml(targetUrl.href);

          res.statusCode = status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Access-Control-Expose-Headers', 'X-Final-Url');
          res.setHeader('X-Final-Url', finalUrl);
          res.end(body);
        } catch (error) {
          res.statusCode = 502;
          res.end(error instanceof Error ? error.message : 'proxy_fetch_failed');
        }
      });
    },
  };
}
