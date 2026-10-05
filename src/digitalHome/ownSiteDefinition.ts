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
 * Whether an own site follows this registry entry: approved for users AND complete (category +
 * icon, so it renders as a tile). Shared by the resolver and the hydrate refresh (KI-5).
 */
export function ownSiteFollowsRegistry(
  entry: Pick<ServiceDefinition, 'metadata' | 'loginFields' | 'category' | 'icon'> | null | undefined,
): boolean {
  return Boolean(entry?.category && entry.icon) && isApprovedForUsers(entry);
}

/**
 * The single effective definition of an own site: the registry entry when it is followed
 * (`ownSiteFollowsRegistry`), else the vault copy as stored (the last version the owner may see),
 * never a mix of the two.
 */
export function resolveOwnSiteDefinition(
  vaultCopy: ServiceDefinition,
  registryEntry: ServiceDefinition | null | undefined,
): { definition: ServiceDefinition; approved: boolean } {
  if (registryEntry && ownSiteFollowsRegistry(registryEntry)) {
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
