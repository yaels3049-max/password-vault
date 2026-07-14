export interface SupabaseEnvConfig {
  /** Client API base (may be Vite `/dev-supabase-proxy` in DEV). */
  url: string;
  /** Always the real `https://<ref>.supabase.co` project URL. */
  remoteUrl: string;
  anonKey: string;
}

/** Project base URL only — no `/rest/v1/` suffix (D-101-8). */
function normalizeSupabaseBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/$/, '');
  return trimmed.replace(/\/rest\/v1\/?$/i, '');
}

function useDevSupabaseProxy(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (import.meta.env.VITE_SUPABASE_DEV_PROXY === 'false') {
    return false;
  }
  return typeof window !== 'undefined';
}

/** In dev, route Supabase through Vite proxy (browser → localhost → Supabase). */
function resolveSupabaseUrl(remoteUrl: string): string {
  if (!useDevSupabaseProxy()) {
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

  return { url, remoteUrl, anonKey: key };
}

/** Canonical project URL — never the Vite proxy (for persisted Storage public URLs). */
export function getSupabaseRemoteUrl(): string | null {
  return getSupabaseConfig()?.remoteUrl ?? null;
}

/**
 * Rewrites a persisted Storage public URL so the browser loads it via the DEV proxy
 * when Netfree/safepage would block direct `*.supabase.co` image requests.
 */
export function toBrowserAccessibleStorageUrl(publicUrl: string): string {
  const trimmed = publicUrl.trim();
  if (!trimmed || !useDevSupabaseProxy()) {
    return trimmed;
  }
  const remote = getSupabaseRemoteUrl();
  if (!remote || !trimmed.startsWith(remote)) {
    return trimmed;
  }
  return `${window.location.origin}/dev-supabase-proxy${trimmed.slice(remote.length)}`;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
