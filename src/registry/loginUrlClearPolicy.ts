import { isAlternateAudiencePortalUrl, evaluateLoginAudience } from '../discovery/loginAudienceGate';
import type { DiscoveryResult } from '../discovery';
import type { ServiceRegistryRow } from './registryMapper';
import { isAdminProtectedLoginUrl } from './loginUrlOverride';

/**
 * Whether rediscovery failure should clear an existing auto login_url (M11 / D-108-14…18).
 *
 * Clear only with positive evidence the stored URL is wrong (alternate-audience portal).
 * Weak failures (common-path, modal-only without portal evidence, extension timeout)
 * must not wipe previously good consumer login URLs (Shufersal/Clalit/HTZone class).
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
  }

  return false;
}
