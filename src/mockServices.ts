import {
  definitionsToLegacyServices,
  highResFavicon,
  HUB_PRACTICE_LOGIN_ID,
} from './catalog';
import { isDevBuild } from './dev/devMode';
import type { ServiceDefinition } from './service/serviceModel';
import type { ServiceCategory } from './service/legacyService';

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

export const categoryLabels: Record<ServiceCategory, string> = {
  practice: 'התחלה כאן',
  banking: 'בנקים',
  health: 'בריאות',
  shopping: 'קניות',
};

export const categoryQuestions: Record<ServiceCategory, string> = {
  practice: 'רוצים לחוות את המילוי האוטומטי? בחרו תרגול התחברות.',
  banking: 'איזה בנקים יש לך?',
  health: 'באיזו קופת חולים אתה חבר?',
  shopping: 'באילו אתרי קניות אתה משתמש?',
};

const ALL_CATEGORIES: ServiceCategory[] = [
  'practice',
  'banking',
  'health',
  'shopping',
];

export const categories: ServiceCategory[] = isDevBuild()
  ? ALL_CATEGORIES
  : ALL_CATEGORIES.filter((category) => category !== 'practice');
