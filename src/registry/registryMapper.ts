import type { LoginField, ServiceCategory } from '../service/serviceModel';
import {
  SERVICE_SCHEMA_VERSION,
  validateServiceDefinition,
  type ServiceDefinition,
  type ServiceSource,
} from '../service/serviceModel';

export type LoginUrlStatus = 'unknown' | 'valid' | 'invalid';

export interface ServiceRegistryRow {
  id: string;
  display_name: string;
  primary_url: string;
  login_url: string | null;
  login_url_status: LoginUrlStatus;
  category_id: string | null;
  icon: string | null;
  adapter_id: string | null;
  login_fields: unknown;
  source_type: string;
  service_status: string;
  metadata: Record<string, unknown> | null;
  owner_user_id: string | null;
}

function isLoginFieldArray(value: unknown): value is LoginField[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as LoginField).id === 'string' &&
      typeof (entry as LoginField).label === 'string' &&
      ((entry as LoginField).type === 'text' || (entry as LoginField).type === 'password'),
  );
}

/** Ignore invalid cached login_fields (e.g. verify-script artifacts); discovery can refill. */
function sanitizeLoginFields(value: unknown): LoginField[] | undefined {
  if (!isLoginFieldArray(value) || value.length === 0) {
    return undefined;
  }

  if (!value.some((field) => field.type === 'password')) {
    return undefined;
  }

  return value;
}

function mapSourceType(sourceType: string): ServiceSource {
  if (sourceType === 'user') {
    return 'user-created';
  }

  return 'built-in-catalog';
}

function mapCategory(categoryId: string | null): ServiceCategory | undefined {
  if (!categoryId) {
    return undefined;
  }

  return categoryId;
}

export function registryRowToServiceDefinition(row: ServiceRegistryRow): ServiceDefinition {
  const candidate: ServiceDefinition = {
    schemaVersion: SERVICE_SCHEMA_VERSION,
    id: row.id,
    displayName: row.display_name,
    url: row.primary_url,
    source: mapSourceType(row.source_type),
  };

  if (row.login_url) {
    candidate.loginUrl = row.login_url;
  }

  const loginFields = sanitizeLoginFields(row.login_fields);
  if (loginFields) {
    candidate.loginFields = loginFields;
  }

  const category = mapCategory(row.category_id);
  if (category) {
    candidate.category = category;
  }

  if (row.icon) {
    candidate.icon = row.icon;
  }

  if (row.adapter_id) {
    candidate.adapterId = row.adapter_id;
  }

  if (row.metadata && typeof row.metadata === 'object') {
    candidate.metadata = row.metadata;
  }

  const validated = validateServiceDefinition(candidate);
  if (!validated.valid) {
    const details = validated.issues
      .map((issue) => `${issue.field}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid registry row "${row.id}": ${details}`);
  }

  return validated.definition;
}

export function serviceDefinitionToRegistryInsert(
  definition: ServiceDefinition,
  ownerUserId: string,
): Record<string, unknown> {
  const loginUrl = definition.loginUrl?.trim();
  const loginUrlStatus: LoginUrlStatus = loginUrl ? 'valid' : 'unknown';

  return {
    id: definition.id,
    display_name: definition.displayName,
    primary_url: definition.url,
    login_url: loginUrl ?? null,
    category_id: definition.category ?? 'custom',
    icon: definition.icon ?? '🔗',
    adapter_id: definition.adapterId ?? null,
    login_fields: definition.loginFields ?? null,
    source_type: 'user',
    service_status: 'active',
    metadata: definition.metadata ?? {},
    login_url_status: loginUrlStatus,
    owner_user_id: ownerUserId,
  };
}

export function shouldRunLoginUrlDiscovery(row: Pick<ServiceRegistryRow, 'login_url' | 'login_url_status'>): boolean {
  if (!row.login_url) {
    return true;
  }

  return row.login_url_status === 'invalid';
}
