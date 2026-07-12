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
