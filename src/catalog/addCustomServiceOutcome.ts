import type { ServiceDefinition } from '../service/serviceModel';
import {
  urlsReferToSameService,
  type AddCustomServiceResult,
} from '../supabase/registryPersistence';

export type ClassifiedAddCustomServiceResult = Exclude<
  AddCustomServiceResult,
  { status: 'created' }
>;

function isGlobalCatalogDefinition(definition: ServiceDefinition): boolean {
  return definition.source !== 'user-created';
}

/**
 * Authoritative Custom Add classifier (Phase 104 consolidation).
 *
 * Global / catalog definitions are resolved first. A private custom in a mixed
 * list cannot win identity merely because Array.find() hits it first.
 *
 * Returns null when no duplicate/catalog business outcome applies and create
 * may proceed.
 */
export function classifyAddCustomService(input: {
  normalizedUrl: string;
  definitions: ServiceDefinition[];
  selectedIds: ReadonlySet<string>;
  localCustomServices: ServiceDefinition[];
}): ClassifiedAddCustomServiceResult | null {
  const globalMatch = input.definitions
    .filter(isGlobalCatalogDefinition)
    .find((existing) => urlsReferToSameService(existing.url, input.normalizedUrl));

  if (globalMatch) {
    if (input.selectedIds.has(globalMatch.id)) {
      return {
        status: 'already_in_user_home',
        existingServiceId: globalMatch.id,
        displayName: globalMatch.displayName,
      };
    }
    return {
      status: 'catalog_service_available',
      existingServiceId: globalMatch.id,
      displayName: globalMatch.displayName,
    };
  }

  const localMatch = input.localCustomServices.find((existing) =>
    urlsReferToSameService(existing.url, input.normalizedUrl),
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
      urlsReferToSameService(existing.url, input.normalizedUrl),
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
