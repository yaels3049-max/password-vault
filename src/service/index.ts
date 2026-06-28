export {
  DISPLAY_NAME_MAX_LENGTH,
  getLoginFieldsForDefinition,
  getServiceOpenUrlForDefinition,
  SERVICE_SCHEMA_VERSION,
  validateServiceDefinition,
  type ServiceDefinition,
  type ServiceMetadata,
  type ServiceSource,
  type ServiceValidationIssue,
  type ServiceValidationResult,
} from './serviceModel';

export {
  inferServiceSource,
  legacyServicesToDefinitions,
  legacyServiceToDefinition,
} from './legacyCatalogMap';

export type {
  LoginField,
  LoginFieldType,
  Service,
  ServiceCategory,
} from './legacyService';

export {
  DEFAULT_LOGIN_FIELDS,
  getLoginFields,
  getServiceOpenUrl,
} from './legacyService';
