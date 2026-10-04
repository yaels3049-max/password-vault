/**
 * Phase 123.2 — catalog model (AD-123-8). Pure: no profile data, no writes.
 * The catalog only reads services / categories / selection and delegates every
 * write to the host (`onAddApp` → addService, `onAddCustom` → addCustomService).
 */
import { runtimeCategoryOrder, type Service, type ServiceCategory } from '../mockServices';
import { filterDiscoveryServices } from '../serviceManagement/discoveryFilter';

export type AddOutcome =
  | { status: 'added' }
  | { status: 'already_added' }
  | { status: 'failed'; message: string };

export type CatalogItemState = 'added' | 'pending' | 'available';

/** Live registry order — a module-level snapshot would freeze the built-in categories. */
export function userFacingCategories(): ServiceCategory[] {
  return runtimeCategoryOrder.filter((category) => category !== 'practice');
}

export function filterCatalog(
  services: Service[],
  filter: { query: string; category: ServiceCategory | null },
): Service[] {
  return filterDiscoveryServices(services, filter);
}

/** FR-17: an app already in the Digital Home is marked and cannot be added again. */
export function catalogItemState(
  serviceId: string,
  selectedIds: ReadonlySet<string>,
  pendingIds: ReadonlySet<string>,
): CatalogItemState {
  if (selectedIds.has(serviceId)) {
    return 'added';
  }
  if (pendingIds.has(serviceId)) {
    return 'pending';
  }
  return 'available';
}
