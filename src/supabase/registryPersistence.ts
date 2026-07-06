import { isSupabaseConfigured } from '../supabase/env';
import { ensureAnonymousUserId } from '../supabase/auth';
import { getSupabaseClient } from '../supabase/client';
import { ensureUserRow } from '../supabase/persistence';
import type { ServiceDefinition } from '../service/serviceModel';
import { serviceDefinitionToRegistryInsert } from '../registry/registryMapper';
import { clearRegistryCatalogCache } from '../registry/registryLoader';

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

  const row = serviceDefinitionToRegistryInsert(definition, userId);
  const { error } = await supabase.from('service_registry').upsert(row, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  clearRegistryCatalogCache();
}
