import {
  AUTH_SUBDOMAIN_PREFIXES,
  COMMON_LOGIN_PATH_FALLBACKS,
} from './discoveryKeywords';
import {
  isAlternateAudiencePortalUrl,
  isSameBrandHost,
  isTrustedAuthSubdomain,
} from './loginAudienceGate';
import { normalizePrimaryUrl } from './discoveryUtils';

/**
 * Probe order for same-brand trusted auth hosts (D-108-24).
 * `auth` first — KSP-class (`auth.ksp.co.il`) beats inventing `{primary}/login`.
 */
export const TRUSTED_AUTH_PROBE_PREFIX_PRIORITY = [
  'auth',
  'login',
  'secure',
  'e-services',
  'eservices',
  'services',
  'signin',
  'account',
  'accounts',
  'myaccount',
  'id',
  'online',
] as const;

const MAX_AUTH_HOST_PROBES = 4;

function registrableApexHostname(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
  if (israeliPublicSuffix.test(host)) {
    const withoutSuffix = host.replace(israeliPublicSuffix, '');
    const labels = withoutSuffix.split('.').filter(Boolean);
    const brand = labels[labels.length - 1] ?? withoutSuffix;
    const suffix = host.match(israeliPublicSuffix)?.[0] ?? '.co.il';
    return `${brand}${suffix}`;
  }

  const labels = host.split('.').filter(Boolean);
  if (labels.length >= 2) {
    return labels.slice(-2).join('.');
  }
  return host;
}

function orderedAuthPrefixes(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const prefix of TRUSTED_AUTH_PROBE_PREFIX_PRIORITY) {
    if (
      AUTH_SUBDOMAIN_PREFIXES.includes(
        prefix as (typeof AUTH_SUBDOMAIN_PREFIXES)[number],
      ) &&
      !seen.has(prefix)
    ) {
      seen.add(prefix);
      ordered.push(prefix);
    }
  }
  for (const prefix of AUTH_SUBDOMAIN_PREFIXES) {
    if (!seen.has(prefix)) {
      seen.add(prefix);
      ordered.push(prefix);
    }
  }
  return ordered;
}

/**
 * Construct same-brand trusted-auth probe URLs (D-108-24).
 * Never includes alternate-audience prefixes (`sa`, `seller`, …).
 * Never invents cross-brand hosts.
 */
export function buildTrustedAuthHostProbeUrls(
  primaryUrl: string,
  maxProbes: number = MAX_AUTH_HOST_PROBES,
): string[] {
  const normalized = normalizePrimaryUrl(primaryUrl);
  if (!normalized || normalized.startsWith('/')) {
    return [];
  }

  let primaryHost: string;
  let protocol: string;
  try {
    const parsed = new URL(normalized);
    primaryHost = parsed.hostname;
    protocol = parsed.protocol === 'http:' ? 'http:' : 'https:';
  } catch {
    return [];
  }

  const apex = registrableApexHostname(primaryHost);
  const primaryIsTrusted = isTrustedAuthSubdomain(primaryHost);
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (url: string) => {
    if (urls.length >= maxProbes) {
      return;
    }
    if (seen.has(url)) {
      return;
    }
    if (isAlternateAudiencePortalUrl(url)) {
      return;
    }
    if (!isSameBrandHost(normalized, url)) {
      return;
    }
    seen.add(url);
    urls.push(url);
  };

  for (const prefix of orderedAuthPrefixes()) {
    if (urls.length >= maxProbes) {
      break;
    }
    const host = `${prefix}.${apex}`;
    if (primaryIsTrusted && host === primaryHost.replace(/^www\./i, '').toLowerCase()) {
      continue;
    }
    // Prefer /login first on each host (KSP / GitHub-class).
    for (const path of COMMON_LOGIN_PATH_FALLBACKS) {
      if (urls.length >= maxProbes) {
        break;
      }
      push(`${protocol}//${host}${path}`);
    }
  }

  return urls;
}
