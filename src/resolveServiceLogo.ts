// Keep in sync with .app-icon-img max size in App.css (72% of icon container).
export const APP_ICON_SIZE_PX = 44;
const MIN_LOGO_SIZE = Math.ceil(APP_ICON_SIZE_PX * 0.8);
const IMAGE_TIMEOUT_MS = 2500;

interface ResolveLogoInput {
  url: string;
  logoUrl?: string;
}

function normalizeSiteUrl(siteUrl: string): URL | null {
  try {
    const normalized = siteUrl.startsWith('http')
      ? siteUrl
      : `https://${siteUrl}`;
    return new URL(normalized);
  } catch {
    return null;
  }
}

function resolveHref(href: string, base: URL): string {
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
}

function tryImage(src: string): Promise<boolean> {
  if (!src) return Promise.resolve(false);

  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(false), IMAGE_TIMEOUT_MS);

    img.onload = () => {
      window.clearTimeout(timer);
      resolve(
        img.naturalWidth >= MIN_LOGO_SIZE &&
          img.naturalHeight >= MIN_LOGO_SIZE,
      );
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };

    img.src = src;
  });
}

async function firstValidSequential(
  candidates: string[],
): Promise<string | null> {
  for (const src of candidates) {
    if (await tryImage(src)) return src;
  }
  return null;
}

async function firstValidParallel(
  candidates: string[],
): Promise<string | null> {
  if (candidates.length === 0) return null;

  return new Promise((resolve) => {
    let pending = candidates.length;
    let settled = false;

    for (const src of candidates) {
      void tryImage(src).then((ok) => {
        if (settled) return;
        if (ok) {
          settled = true;
          resolve(src);
          return;
        }
        pending -= 1;
        if (pending === 0) resolve(null);
      });
    }
  });
}

async function fetchPageHtml(site: URL): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);

  try {
    try {
      const response = await fetch(site.href, {
        signal: controller.signal,
        mode: 'cors',
      });
      if (response.ok) return await response.text();
    } catch {
      // CORS blocked — fall back to read-only proxy for meta tags.
    }

    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(site.href)}`;
    const response = await fetch(proxyUrl, { signal: controller.signal });
    if (response.ok) return await response.text();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }

  return null;
}

function parsePageMeta(
  html: string,
  site: URL,
): { appleTouch?: string; ogImage?: string; icons: string[] } {
  const appleMatch =
    html.match(
      /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i,
    );

  const ogMatch =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );

  const icons: { url: string; size: number }[] = [];

  for (const match of html.matchAll(/<link[^>]+>/gi)) {
    const tag = match[0];
    if (!/rel=["'][^"']*icon/i.test(tag)) continue;

    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;

    const sizes = tag.match(/sizes=["']([^"']+)["']/i)?.[1];
    let size = 0;
    if (sizes) {
      const sizeMatch = sizes.match(/(\d+)x(\d+)/);
      if (sizeMatch) size = Number.parseInt(sizeMatch[1], 10);
    }

    icons.push({ url: resolveHref(href, site), size });
  }

  icons.sort((a, b) => b.size - a.size);

  return {
    appleTouch: appleMatch ? resolveHref(appleMatch[1], site) : undefined,
    ogImage: ogMatch ? resolveHref(ogMatch[1], site) : undefined,
    icons: icons.map((icon) => icon.url),
  };
}

export async function resolveServiceLogo(
  input: ResolveLogoInput,
): Promise<string | null> {
  const site = normalizeSiteUrl(input.url);
  if (!site) return null;

  const origin = site.origin;

  if (input.logoUrl) {
    const explicit = await firstValidSequential([input.logoUrl]);
    if (explicit) return explicit;
  }

  const applePaths = [
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png',
    '/apple-touch-icon-180x180.png',
    '/apple-touch-icon-152x152.png',
    '/apple-touch-icon-120x120.png',
  ].map((path) => `${origin}${path}`);

  const appleFromPaths = await firstValidParallel(applePaths);
  if (appleFromPaths) return appleFromPaths;

  const html = await fetchPageHtml(site);
  if (html) {
    const meta = parsePageMeta(html, site);

    if (meta.appleTouch) {
      const appleFromMeta = await firstValidSequential([meta.appleTouch]);
      if (appleFromMeta) return appleFromMeta;
    }

    const iconsFromMeta = await firstValidSequential(meta.icons);
    if (iconsFromMeta) return iconsFromMeta;

    if (meta.ogImage) {
      const ogImage = await firstValidSequential([meta.ogImage]);
      if (ogImage) return ogImage;
    }
  }

  const faviconPaths = [
    `${origin}/favicon.ico`,
    `${origin}/favicon.png`,
    `${origin}/favicon-32x32.png`,
    `${origin}/favicon-96x96.png`,
    `${origin}/favicon-192x192.png`,
    `${origin}/android-chrome-192x192.png`,
  ];

  const favicon = await firstValidSequential(faviconPaths);
  if (favicon) return favicon;

  return null;
}
