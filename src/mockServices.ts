import {
  definitionsToLegacyServices,
  getBuiltinCatalogDefinitions,
  highResFavicon,
  HUB_PRACTICE_LOGIN_ID,
} from './catalog';
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
} from './service/legacyService';

export { highResFavicon, HUB_PRACTICE_LOGIN_ID };

/** Built-in catalog derived from canonical ServiceDefinition data. */
export const mockServices = definitionsToLegacyServices(getBuiltinCatalogDefinitions());

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

export const categories: ServiceCategory[] = [
  'practice',
  'banking',
  'health',
  'shopping',
];
