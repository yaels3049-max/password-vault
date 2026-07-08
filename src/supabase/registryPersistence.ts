import { isSupabaseConfigured } from '../supabase/env';
import { ensureAnonymousUserId } from '../supabase/auth';
import { getSupabaseClient } from '../supabase/client';
import { ensureUserRow } from '../supabase/persistence';
import type { ServiceDefinition } from '../service/serviceModel';
import { serviceDefinitionToRegistryInsert } from '../registry/registryMapper';
import { clearRegistryCatalogCache } from '../registry/registryLoader';

/** Raised when a user already owns a custom service with the same normalized primary URL. */
export class DuplicateCustomServiceError extends Error {
  readonly existingServiceId: string;

  constructor(existingServiceId: string) {
    super('Custom service already exists for this user + primary URL');
    this.name = 'DuplicateCustomServiceError';
    this.existingServiceId = existingServiceId;
  }
}

export function normalizeCustomServiceUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).href;
  } catch {
    return rawUrl.trim();
  }
}

export async function upsertCustomServiceRegistryRow(
  definition: ServiceDefinition,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const userId = await ensureAnonymousUserId();
  if (!userId) {
    throw new Error('Anonymous auth did not return a user id');
  }

  await ensureUserRow(userId);

  // Idempotency: reject a second row for the same user + normalized primary URL.
  const normalizedUrl = normalizeCustomServiceUrl(definition.url);
  const { data: existingRows, error: lookupError } = await supabase
    .from('service_registry')
    .select('id, primary_url')
    .eq('owner_user_id', userId)
    .eq('source_type', 'user');

  if (lookupError) {
    throw lookupError;
  }

  const duplicate = (existingRows ?? []).find(
    (existing) =>
      existing.id !== definition.id &&
      normalizeCustomServiceUrl(String(existing.primary_url)) === normalizedUrl,
  );

  if (duplicate) {
    throw new DuplicateCustomServiceError(String(duplicate.id));
  }

  const row = serviceDefinitionToRegistryInsert(definition, userId);
  const { error } = await supabase.from('service_registry').upsert(row, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  clearRegistryCatalogCache();
}

export async function deleteCustomServiceRegistryRow(serviceId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const userId = await ensureAnonymousUserId();
  if (!userId) {
    return;
  }

  const { error } = await supabase
    .from('service_registry')
    .delete()
    .eq('id', serviceId)
    .eq('owner_user_id', userId)
    .eq('source_type', 'user');

  if (error) {
    throw error;
  }
}
