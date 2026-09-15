import { classifyStoredLoginFields } from '../service/credentialSchema';
import {
  SERVICE_SCHEMA_VERSION,
  validateServiceDefinition,
  type ServiceCategory,
  type ServiceDefinition,
  type ServiceSource,
} from '../service/serviceModel';

export type LoginUrlStatus =
  | 'unknown'
  | 'valid'
  | 'invalid'
  | 'missing'
  | 'stale'
  | 'failed'
  | 'needs_review';

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

function mapStoredLoginFields(value: unknown) {
  const classified = classifyStoredLoginFields(value);
  if (classified.status === 'valid') {
    return classified.fields;
  }
  if (classified.status === 'empty') {
    return [];
  }
  return undefined;
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

  const storedSchema = classifyStoredLoginFields(row.login_fields);
  const loginFields = mapStoredLoginFields(row.login_fields);
  candidate.storedLoginFieldsStatus = storedSchema.status;
  if (loginFields !== undefined) {
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
    category_id: definition.category?.trim() || null,
    icon: definition.icon ?? '🔗',
    adapter_id: definition.adapterId ?? null,
    login_fields: definition.loginFields ?? null,
    source_type: 'user',
    service_status: 'pending_review',
    metadata: {
      ...(definition.metadata ?? {}),
      loginUrlSource: 'user',
      loginEntryType:
        definition.metadata?.loginEntryType === 'direct_url' ? 'direct_url' : 'primary_page',
    },
    login_url_status: loginUrl ? 'valid' : loginUrlStatus,
    owner_user_id: ownerUserId,
  };
}

export function shouldRunLoginUrlDiscovery(
  row: Pick<ServiceRegistryRow, 'login_url' | 'login_url_status' | 'metadata'>,
): boolean {
  if (!row.login_url) {
    return true;
  }

  return (
    row.login_url_status === 'invalid' ||
    row.login_url_status === 'stale' ||
    row.login_url_status === 'failed' ||
    row.login_url_status === 'missing' ||
    row.login_url_status === 'needs_review'
  );
}
