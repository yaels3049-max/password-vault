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
