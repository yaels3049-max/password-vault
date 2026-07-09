import {
  definitionsToLegacyServices,
  highResFavicon,
  HUB_PRACTICE_LOGIN_ID,
} from './catalog';
import { isDevBuild } from './dev/devMode';
import type { ServiceDefinition } from './service/serviceModel';

export type {
  LoginField,
  LoginFieldType,
  Service,
  ServiceCategory,
} from './service/legacyService';

export {
  DEFAULT_LOGIN_FIELDS,
  getLoginFields,
  getServiceOpenUrl,
  hasConfiguredLoginFields,
  hasLoginIntegrationMetadata,
} from './service/legacyService';

export { highResFavicon, HUB_PRACTICE_LOGIN_ID };

/** Built-in catalog legacy services — populated after registry load (Phase 102). */
export let mockServices: import('./service/legacyService').Service[] = [];

export function setRuntimeBuiltinServices(definitions: ServiceDefinition[]): void {
  mockServices = definitionsToLegacyServices(definitions);
}

export const categoryLabels: Record<string, string> = {
  practice: 'התחלה כאן',
  banking: 'בנקים',
  health: 'בריאות',
  shopping: 'קניות',
};

export const categoryQuestions: Record<string, string> = {
  practice: 'רוצים לחוות את המילוי האוטומטי? בחרו תרגול התחברות.',
  banking: 'איזה בנקים יש לך?',
  health: 'באיזו קופת חולים אתה חבר?',
  shopping: 'באילו אתרי קניות אתה משתמש?',
};

const ALL_CATEGORIES: string[] = ['practice', 'banking', 'health', 'shopping'];

export const categories: string[] = isDevBuild()
  ? ALL_CATEGORIES
  : ALL_CATEGORIES.filter((category) => category !== 'practice');

/** Registry-driven category order + labels (set after Supabase category load). */
export let runtimeCategoryOrder: string[] = [...categories];
export let runtimeCategoryLabels: Record<string, string> = { ...categoryLabels };

export function setRuntimeCategoryCatalog(registryCategories: {
  id: string;
  display_name: string;
  sort_order: number;
}[]): void {
  if (registryCategories.length === 0) {
    runtimeCategoryOrder = [...categories];
    runtimeCategoryLabels = { ...categoryLabels };
    return;
  }

  runtimeCategoryLabels = { ...categoryLabels };
  runtimeCategoryOrder = [];

  const sorted = [...registryCategories].sort((a, b) => a.sort_order - b.sort_order);
  for (const category of sorted) {
    runtimeCategoryLabels[category.id] = category.display_name;
    if (isDevBuild() || category.id !== 'practice') {
      runtimeCategoryOrder.push(category.id);
    }
  }
}
