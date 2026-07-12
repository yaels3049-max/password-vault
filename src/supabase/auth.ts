import { getSupabaseClient, resetSupabaseClient } from './client';
import { formatUnknownError } from '../formatErrorChain';

/**
 * Ensure an anonymous Supabase session exists (D-101-5).
 * Uses getUser() so stale localStorage sessions are not trusted without server validation.
 */
export async function ensureAnonymousUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user?.id) {
    return userData.user.id;
  }

  // Transient getUser failures must not wipe an existing session (e.g. admin JWT).
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id ?? null;
  if (sessionUserId) {
    const retry = await supabase.auth.getUser();
    if (!retry.error && retry.data.user?.id) {
      return retry.data.user.id;
    }
    // Keep the local session; RLS will reject unauthorized writes if the JWT is dead.
    return sessionUserId;
  }

  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(formatUnknownError(error), { cause: error });
  }

  return data.user?.id ?? null;
}

/** Clear persisted Supabase auth and recreate client (e.g. retry after catalog load failure). */
export async function resetSupabaseAuthSession(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  resetSupabaseClient();
}
