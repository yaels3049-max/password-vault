export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
}

/** Project base URL only — no `/rest/v1/` suffix (D-101-8). */
function normalizeSupabaseBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/$/, '');
  return trimmed.replace(/\/rest\/v1\/?$/i, '');
}

/** In dev, route Supabase through Vite proxy (browser → localhost → Supabase). */
function resolveSupabaseUrl(remoteUrl: string): string {
  if (!import.meta.env.DEV) {
    return remoteUrl;
  }

  if (import.meta.env.VITE_SUPABASE_DEV_PROXY === 'false') {
    return remoteUrl;
  }

  if (typeof window === 'undefined') {
    return remoteUrl;
  }

  return `${window.location.origin}/dev-supabase-proxy`;
}

export function getSupabaseConfig(): SupabaseEnvConfig | null {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof rawUrl !== 'string' || typeof anonKey !== 'string') {
    return null;
  }

  const remoteUrl = normalizeSupabaseBaseUrl(rawUrl);
  const url = resolveSupabaseUrl(remoteUrl);
  const key = anonKey.trim();
  if (!remoteUrl || !key) {
    return null;
  }

  return { url, anonKey: key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
