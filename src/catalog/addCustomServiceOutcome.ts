import type { ServiceDefinition } from '../service/serviceModel';
import {
  serviceMatchesRegisteredUrl,
  type AddCustomServiceResult,
} from '../supabase/registryPersistence';
import { isListedInUserCatalog } from './catalogVisibility';

export type ClassifiedAddCustomServiceResult = Exclude<
  AddCustomServiceResult,
  { status: 'created' }
>;

function isGlobalCatalogDefinition(definition: ServiceDefinition): boolean {
  return definition.source !== 'user-created';
}

/**
 * Authoritative Custom Add classifier (Phase 104 consolidation + Phase 116 AC-116-3).
 *
 * Global / catalog definitions are resolved first. A private custom in a mixed
 * list cannot win identity merely because Array.find() hits it first.
 *
 * Identity set per definition: primary `url` + `loginUrl` when present
 * (existing Phase 116 normalization via serviceMatchesRegisteredUrl).
 *
 * Returns null when no duplicate/catalog business outcome applies and create
 * may proceed.
 *
 * AD-123-19: a global site that is not listed for users is never offered; it still
 * counts as already in the home when the user has it.
 */
export function classifyAddCustomService(input: {
  normalizedUrl: string;
  definitions: ServiceDefinition[];
  selectedIds: ReadonlySet<string>;
  localCustomServices: ServiceDefinition[];
}): ClassifiedAddCustomServiceResult | null {
  const globalMatch = input.definitions
    .filter(isGlobalCatalogDefinition)
    .find((existing) => serviceMatchesRegisteredUrl(existing, input.normalizedUrl));

  if (globalMatch) {
    if (input.selectedIds.has(globalMatch.id)) {
      return {
        status: 'already_in_user_home',
        existingServiceId: globalMatch.id,
        displayName: globalMatch.displayName,
      };
    }
    if (isListedInUserCatalog(globalMatch)) {
      return {
        status: 'catalog_service_available',
        existingServiceId: globalMatch.id,
        displayName: globalMatch.displayName,
      };
    }
  }

  const localMatch = input.localCustomServices.find((existing) =>
    serviceMatchesRegisteredUrl(existing, input.normalizedUrl),
  );
  if (localMatch) {
    // Already in the user's site list / Digital Home — never say «מותאם אישית».
    if (input.selectedIds.has(localMatch.id)) {
      return {
        status: 'already_in_user_home',
        existingServiceId: localMatch.id,
        displayName: localMatch.displayName,
      };
    }
    return {
      status: 'same_user_custom_duplicate',
      existingServiceId: localMatch.id,
      displayName: localMatch.displayName,
    };
  }

  const registryCustomMatch = input.definitions.find(
    (existing) =>
      existing.source === 'user-created' &&
      serviceMatchesRegisteredUrl(existing, input.normalizedUrl),
  );
  if (registryCustomMatch) {
    if (input.selectedIds.has(registryCustomMatch.id)) {
      return {
        status: 'already_in_user_home',
        existingServiceId: registryCustomMatch.id,
        displayName: registryCustomMatch.displayName,
      };
    }
    return {
      status: 'same_user_custom_duplicate',
      existingServiceId: registryCustomMatch.id,
      displayName: registryCustomMatch.displayName,
    };
  }

  return null;
}
