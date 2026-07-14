/**
 * Phase 113 — when floating assistance may open (AC-113-24 / D-113-16).
 * Empty panel with blank fields is forbidden.
 */

import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile';
import { profilesForService } from '../profile';
import { getLoginFields, type Service } from '../mockServices';

/**
 * True when the service has at least one Access Profile with at least one
 * non-empty stored credential field to display/copy.
 */
export function serviceHasUsableCredentials(
  service: Service,
  accessProfiles: AccessProfile[],
  credentialsByProfileId: Record<string, Credential>,
): boolean {
  const profiles = profilesForService(accessProfiles, service.id);
  if (profiles.length === 0) {
    return false;
  }

  const fields = getLoginFields(service);
  return profiles.some((profile) => {
    const credential = credentialsByProfileId[profile.id];
    if (!credential) {
      return false;
    }
    return fields.some((field) => Boolean(credential[field.id]?.trim()));
  });
}
