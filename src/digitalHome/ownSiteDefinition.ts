import type { Credential } from '../credentials';
import type { ServiceDefinition } from '../service/serviceModel';
import { userApprovalState } from '../service/userApproval';

/**
 * D-123-8 — an own site (an app in the owner's vault `customServices`) follows its registry
 * entry only while that entry is approved for users. Fail-closed: a missing or unreadable entry,
 * or any state other than `approved`, keeps the vault copy.
 */
export function isApprovedForUsers(
  entry: Pick<ServiceDefinition, 'metadata' | 'loginFields'> | null | undefined,
): boolean {
  if (!entry) return false;
  try {
    return userApprovalState({ metadata: entry.metadata, login_fields: entry.loginFields }) === 'approved';
  } catch {
    return false;
  }
}

/**
 * The single effective definition of an own site: the registry entry when approved, else the
 * vault copy as stored (the last version the owner may see), never a mix of the two. An entry
 * without category / icon cannot be rendered as a tile and also keeps the vault copy.
 */
export function resolveOwnSiteDefinition(
  vaultCopy: ServiceDefinition,
  registryEntry: ServiceDefinition | null | undefined,
): { definition: ServiceDefinition; approved: boolean } {
  if (registryEntry?.category && registryEntry.icon && isApprovedForUsers(registryEntry)) {
    return { definition: registryEntry, approved: true };
  }
  return { definition: vaultCopy, approved: false };
}

/** Field ids holding a stored value that the current login form does not show. */
export function hiddenCredentialFieldIds(
  credential: Credential | null | undefined,
  currentFieldIds: readonly string[],
): string[] {
  if (!credential) return [];
  const current = new Set(currentFieldIds);
  return Object.keys(credential).filter((key) => !current.has(key) && Boolean(credential[key]?.trim()));
}
