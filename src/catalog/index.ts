export {
  BUILTIN_CATALOG_DEFINITIONS,
  HUB_PRACTICE_LOGIN_ID,
} from './builtinCatalog';
export {
  createCustomServiceDefinition,
  generateCustomServiceId,
  isCustomServiceId,
  isStoredServiceDefinition,
  validateCustomPrimaryUrl,
  type CreateCustomServiceInput,
  type CustomPrimaryUrlValidationResult,
} from './customService';
export { normalizeStoredCustomService, normalizeStoredCustomServices } from './customServiceStorage';
export {
  classifyDiscoveryReviewStatus,
  discoverLoginForCustomService,
  discoverLoginForRegistryService,
  shouldPersistDiscoveredLoginUrl,
  type CustomServiceDiscoveryOutcome,
  type CustomServiceDiscoveryResult,
  type RegistryLoginDiscoveryResult,
} from './customServiceDiscovery';
export { loadBuiltinCatalogDefinitions } from './catalogLoader';
export { classifyAddCustomService } from './addCustomServiceOutcome';
export {
  classifyCustomAddFailure,
  userMessageForCustomAddFailure,
  CUSTOM_ADD_FAIL_CONNECTIVITY_HE,
  CUSTOM_ADD_FAIL_AUTH_POLICY_HE,
  CUSTOM_ADD_FAIL_PERSISTENCE_HE,
  CUSTOM_ADD_FAIL_DUPLICATE_HE,
  type CustomAddFailureClass,
} from './customAddFailure';
export {
  bootstrapMissingKnownBuiltins,
  getKnownBuiltinDefinition,
  isKnownBuiltinServiceId,
  listKnownBuiltinDefinitions,
  resolveKnownBuiltinByUrl,
} from './knownServiceBootstrap';
export {
  definitionToLegacyService,
  definitionsToLegacyServices,
  highResFavicon,
} from './definitionToLegacyService';
