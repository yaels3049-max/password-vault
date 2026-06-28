import {
  validateServiceDefinition,
  type ServiceDefinition,
} from '../service/serviceModel';
import { BUILTIN_CATALOG_DEFINITIONS } from './builtinCatalog';

let cachedValidatedCatalog: ServiceDefinition[] | null = null;

/**
 * Returns validated built-in catalog definitions.
 * Validation runs once per session on first access.
 */
export function getBuiltinCatalogDefinitions(): ServiceDefinition[] {
  if (cachedValidatedCatalog) {
    return cachedValidatedCatalog;
  }

  const validated: ServiceDefinition[] = [];

  for (const definition of BUILTIN_CATALOG_DEFINITIONS) {
    const result = validateServiceDefinition(definition);
    if (!result.valid) {
      const details = result.issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid built-in catalog entry "${definition.id}": ${details}`);
    }
    validated.push(result.definition);
  }

  cachedValidatedCatalog = validated;
  return validated;
}
