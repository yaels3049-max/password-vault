import {
  categoryLabels,
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

/**
 * Stable Digital Home category display order (all registry categories).
 * Independent of Service Management's soft-hidden practice filter so every
 * selected service still appears when category layout is active.
 */
const HOME_CATEGORY_ORDER: ServiceCategory[] = [
  'practice',
  'banking',
  'health',
  'shopping',
];

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
  return HOME_CATEGORY_ORDER.map((category) => ({
    category,
    label: categoryLabels[category],
    services: selectedServices.filter((service) => service.category === category),
  })).filter((group) => group.services.length > 0);
}
