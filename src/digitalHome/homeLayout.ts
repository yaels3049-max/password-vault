import {
  categoryLabels,
  runtimeCategoryLabels,
  runtimeCategoryOrder,
  type Service,
  type ServiceCategory,
} from '../mockServices';

/**
 * Adaptive Digital Home layout threshold (selected services only).
 * <= 12 → flat app-launcher grid
 * >= 13 → category-grouped sections
 *
 * Useful Services / Notifications are not part of this count.
 */
export const CATEGORY_LAYOUT_MIN_SERVICES = 13;

export type HomeServicesLayoutMode = 'flat' | 'category';

export function resolveHomeServicesLayoutMode(
  selectedServiceCount: number,
): HomeServicesLayoutMode {
  return selectedServiceCount >= CATEGORY_LAYOUT_MIN_SERVICES
    ? 'category'
    : 'flat';
}

export function shouldUseCategoryLayout(selectedServiceCount: number): boolean {
  return resolveHomeServicesLayoutMode(selectedServiceCount) === 'category';
}

export interface CategoryServiceGroup {
  category: ServiceCategory;
  label: string;
  services: Service[];
}

/**
 * Group selected services by registry category. Empty categories omitted.
 * Each service appears in at most one group (its `service.category`).
 */
export function groupSelectedServicesByCategory(
  selectedServices: Service[],
): CategoryServiceGroup[] {
  const order =
    runtimeCategoryOrder.length > 0
      ? runtimeCategoryOrder
      : ['practice', 'banking', 'health', 'shopping'];

  return order
    .map((category) => ({
      category,
      label: runtimeCategoryLabels[category] ?? categoryLabels[category] ?? category,
      services: selectedServices.filter((service) => service.category === category),
    }))
    .filter((group) => group.services.length > 0);
}
