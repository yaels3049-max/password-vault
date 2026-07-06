import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, type SupabaseEnvConfig } from './env';

let client: SupabaseClient | null = null;
let clientConfigKey: string | null = null;

function configKey(config: SupabaseEnvConfig): string {
  return `${config.url}|${config.anonKey}`;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) {
    resetSupabaseClient();
    return null;
  }

  const key = configKey(config);
  if (client && clientConfigKey === key) {
    return client;
  }

  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  clientConfigKey = key;

  return client;
}

/** Drop cached client (e.g. env URL fix or auth retry). */
export function resetSupabaseClient(): void {
  client = null;
  clientConfigKey = null;
}

/** @deprecated Use resetSupabaseClient() */
export function resetSupabaseClientForTests(): void {
  resetSupabaseClient();
}
