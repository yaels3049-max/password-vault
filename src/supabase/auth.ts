/**
 * Phase 109: anonymous auto-create retired.
 * Production Hub paths must use `requireAuthenticatedUserId` from `src/auth/`.
 */
import { getSupabaseClient, resetSupabaseClient } from './client';

/** Clear persisted Supabase auth and recreate client (e.g. after logout). */
export async function resetSupabaseAuthSession(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  resetSupabaseClient();
}
