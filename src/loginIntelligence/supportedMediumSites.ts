/**
 * Phase 112 M9 — published supported websites for medium / two-step identity-first fill.
 * Acceptance (Architect): step-1 fill on EVERY site on this list in live UAT.
 * Hosts not on this list → AC-112-26 "website not supported" (never silent).
 */

export interface Phase112SupportedMediumSite {
  /** Stable id for evidence / Admin */
  id: string;
  /** Human name shown in evidence package */
  displayName: string;
  /** Optional catalog service id when matching hub services */
  serviceId?: string;
  /** Hostname substrings (lowercase) that identify the site */
  hostIncludes: string[];
  /** Optional path substrings for fixture / entry pages */
  pathIncludes?: string[];
  /** Flow note for operators */
  flowNote: string;
}

/**
 * Named supported list (D-112-24 §5). Keep short and honest — every entry must be
 * live-UAT’d before Architect re-review.
 */
export const PHASE112_MEDIUM_SUPPORTED_SITES: readonly Phase112SupportedMediumSite[] = [
  {
    id: 'fixture-email-first',
    displayName: 'Phase 112 email-first fixture (localhost)',
    hostIncludes: ['localhost', '127.0.0.1'],
    pathIncludes: ['phase112-email-first'],
    flowNote: 'Identity-only step 1 HTML fixture — CI + local operator proof',
  },
  {
    id: 'amazon-il',
    displayName: 'Amazon ישראל',
    serviceId: 'amazon-il',
    hostIncludes: ['amazon.co.il', 'amazon.com'],
    flowNote: 'Two-step / email-first identity when classified medium',
  },
  {
    id: 'ksp',
    displayName: 'KSP',
    serviceId: 'ksp',
    hostIncludes: ['ksp.co.il', 'auth.ksp.co.il'],
    flowNote: 'Email identity step when login surface is identity-first / medium',
  },
] as const;

export function isPhase112MediumFeatureEnabled(): boolean {
  // Feature on by default for medium LI; may be disabled via env for emergency off.
  return import.meta.env.VITE_PHASE112_MEDIUM !== 'false';
}

export function matchSupportedMediumSite(
  openUrl: string,
  serviceId?: string,
): Phase112SupportedMediumSite | null {
  let host = '';
  let path = '';
  try {
    const u = new URL(openUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return null;
  }

  for (const site of PHASE112_MEDIUM_SUPPORTED_SITES) {
    if (serviceId && site.serviceId && site.serviceId === serviceId) {
      return site;
    }
    const hostOk = site.hostIncludes.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h));
    if (!hostOk) continue;
    if (site.pathIncludes?.length) {
      const pathOk = site.pathIncludes.some((p) => path.includes(p.toLowerCase()));
      if (!pathOk) continue;
    }
    return site;
  }
  return null;
}
