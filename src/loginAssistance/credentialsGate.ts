/**
 * Phase 113 — Digital Home Launch Card kind (tile click).
 * All credential-related launch states open the Launch Card.
 * They remain semantically distinct; only the interaction pattern is unified.
 */

import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile';
import { profilesForService } from '../profile';
import {
  readStoredCredentialMode,
  resolveCredentialEntry,
} from '../service/credentialSchema';
import type { Service } from '../mockServices';

export type DigitalHomeLaunchKind =
  | 'credentials'
  | 'no-stored-credentials'
  | 'not-configured'
  | 'missing-user-credentials';

/**
 * True when the service has at least one Access Profile with at least one
 * non-empty stored credential field to display/copy (CREDENTIAL_FIELDS only).
 */
export function serviceHasUsableCredentials(
  service: Service,
  accessProfiles: AccessProfile[],
  credentialsByProfileId: Record<string, Credential>,
): boolean {
  const entry = resolveCredentialEntry(service);
  if (entry.kind !== 'form') {
    return false;
  }

  const profiles = profilesForService(accessProfiles, service.id);
  if (profiles.length === 0) {
    return false;
  }

  return profiles.some((profile) => {
    const credential = credentialsByProfileId[profile.id];
    if (!credential) {
      return false;
    }
    return entry.fields.some((field) => Boolean(credential[field.id]?.trim()));
  });
}

/**
 * Launch Card kind from authoritative stored/resolved credentialMode.
 * Does not infer NOT_CONFIGURED from empty loginFields alone.
 */
export function resolveDigitalHomeLaunchKind(
  service: Service,
  accessProfiles: AccessProfile[],
  credentialsByProfileId: Record<string, Credential>,
): DigitalHomeLaunchKind {
  const isCustom = service.source === 'user-created';
  const storedMode = readStoredCredentialMode(service.metadata);

  if (!isCustom) {
    if (storedMode === 'no_stored_credentials') {
      return 'no-stored-credentials';
    }
    if (storedMode === 'not_configured') {
      return 'not-configured';
    }
  }

  const entry = resolveCredentialEntry(service);
  if (entry.kind === 'no-stored-credentials') {
    return 'no-stored-credentials';
  }
  if (entry.kind === 'incomplete') {
    return 'not-configured';
  }

  if (serviceHasUsableCredentials(service, accessProfiles, credentialsByProfileId)) {
    return 'credentials';
  }
  return 'missing-user-credentials';
}

/**
 * Whether Digital Home may open the floating Launch Card for this service click.
 * Every resolved launch kind uses the Launch Card (no page-level banner).
 */
export function shouldOpenLoginAssistancePanel(
  service: Service,
  accessProfiles: AccessProfile[],
  credentialsByProfileId: Record<string, Credential>,
): boolean {
  void service;
  void accessProfiles;
  void credentialsByProfileId;
  return true;
}
