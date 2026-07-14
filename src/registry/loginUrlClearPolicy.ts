import {
  isAlternateAudiencePortalUrl,
  evaluateLoginAudience,
  isSameBrandHost,
  isTrustedAuthSubdomain,
} from '../discovery/loginAudienceGate';
import type { DiscoveryResult } from '../discovery';
import type { ServiceRegistryRow } from './registryMapper';
import { isAdminProtectedLoginUrl } from './loginUrlOverride';

/**
 * Auto-invented same-brand auth-host /login probe shape (U24 soft invent).
 * Used to roll back dead invents (e.g. non-existent retail auth host) on rediscovery.
 */
function isAuthHostLoginInventUrl(primaryUrl: string, loginUrl: string): boolean {
  try {
    const login = new URL(loginUrl);
    const path = login.pathname.replace(/\/$/, '') || '/';
    if (path !== '/login') {
      return false;
    }
    const host = login.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host.startsWith('auth.')) {
      return false;
    }
    if (!isTrustedAuthSubdomain(login.hostname)) {
      return false;
    }
    return isSameBrandHost(primaryUrl, loginUrl);
  } catch {
    return false;
  }
}

/**
 * Whether rediscovery failure should clear an existing auto login_url (M11 / D-108-14…18).
 *
 * Clear only with positive evidence the stored URL is wrong (alternate-audience portal
 * or dead auth-host invent that rediscovery can no longer validate).
 * Weak failures must not wipe previously good consumer login URLs
 * (Shufersal/Clalit/HTZone class) that are not auth-host invents.
 */
export function shouldClearAutoLoginUrlOnDiscoveryReject(
  row: Pick<ServiceRegistryRow, 'login_url' | 'primary_url' | 'metadata'>,
  discovery: DiscoveryResult | null,
): boolean {
  if (isAdminProtectedLoginUrl(row)) {
    return false;
  }

  const existing = row.login_url?.trim() || null;
  if (!existing) {
    return false;
  }

  if (isAlternateAudiencePortalUrl(existing)) {
    return true;
  }

  const rejected = discovery?.rejectedLoginUrl?.trim() || null;
  if (rejected && isAlternateAudiencePortalUrl(rejected)) {
    // Clear only when the stored URL is the rejected portal (or also portal).
    if (existing === rejected || isAlternateAudiencePortalUrl(existing)) {
      return true;
    }
  }

  if (discovery?.loginUrl && isAlternateAudiencePortalUrl(discovery.loginUrl)) {
    return existing === discovery.loginUrl;
  }

  const primary = row.primary_url?.trim();
  if (primary) {
    const audience = evaluateLoginAudience(primary, existing, {
      primaryHasModalLoginTrigger: false,
    });
    if (!audience.accept) {
      return true;
    }

    // Roll back unverified auth-host invents when rediscovery no longer persists them.
    if (
      discovery &&
      !discovery.success &&
      !discovery.loginUrl &&
      isAuthHostLoginInventUrl(primary, existing)
    ) {
      return true;
    }
  }

  return false;
}
