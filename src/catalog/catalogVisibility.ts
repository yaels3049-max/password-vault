import { resolveGlobalCredentialConfiguration } from '../service/credentialSchema';
import type { ServiceDefinition } from '../service/serviceModel';
import { userApprovalState, type UserApprovalState } from '../service/userApproval';

/** Fields shared by `ServiceDefinition` and the legacy runtime `Service`. */
export type CatalogEntry = Pick<
  ServiceDefinition,
  'source' | 'metadata' | 'loginFields' | 'storedLoginFieldsStatus'
>;

export type CatalogGateState = 'own_site' | 'no_stored_credentials' | UserApprovalState;

/**
 * AD-123-19 — why a site is (not) listed for users. A user's own site is not gated (RLS already
 * limits it to its owner). Every other row is global: admin-created or a promoted submission.
 */
export function catalogGateState(entry: CatalogEntry): CatalogGateState {
  if (entry.source === 'user-created') return 'own_site';
  const credential = resolveGlobalCredentialConfiguration({
    metadata: entry.metadata,
    loginFields: entry.loginFields,
    storedLoginFieldsStatus: entry.storedLoginFieldsStatus,
  });
  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';
  return userApprovalState({ metadata: entry.metadata, login_fields: entry.loginFields });
}

/**
 * AD-123-19 — the user catalog lists (and custom add offers) a global site only when it is
 * approved for users or explicitly configured as no_stored_credentials. Listing / new adds only:
 * apps already in a home stay there.
 */
export function isListedInUserCatalog(entry: CatalogEntry): boolean {
  const state = catalogGateState(entry);
  return state === 'own_site' || state === 'no_stored_credentials' || state === 'approved';
}

/**
 * AD-123-19 (a) — what the user catalog shows: listed sites, plus a site already in the user's
 * home (marked «✓ כבר בבית הדיגיטלי», no add action) until it leaves the home.
 */
export function isShownInUserCatalog(entry: CatalogEntry, inHome: boolean): boolean {
  return inHome || isListedInUserCatalog(entry);
}
