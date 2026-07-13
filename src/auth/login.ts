import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { AUTH_COPY, mapAuthErrorToFriendly } from './copy';
import { isValidEmailFormat, normalizeEmail } from './normalize';
import {
  assertActiveProfile,
  isAnonymousAuthUser,
  loadAppUserProfile,
  type AppUserProfile,
} from './session';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Authenticate an existing user only.
 * Never creates Auth or public.users rows on failure (AC-109-2, AC-109-10).
 */
export async function loginWithPassword(input: LoginInput): Promise<AppUserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  const email = normalizeEmail(input.email);
  if (!isValidEmailFormat(email) || !input.password) {
    throw new Error(AUTH_COPY.genericAuthFailure);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.user) {
    throw new Error(mapAuthErrorToFriendly(error ?? AUTH_COPY.genericAuthFailure));
  }

  if (isAnonymousAuthUser(data.user)) {
    await supabase.auth.signOut();
    throw new Error(AUTH_COPY.genericAuthFailure);
  }

  const profile = await loadAppUserProfile(data.user.id);
  try {
    return await assertActiveProfile(profile);
  } catch (statusError) {
    await supabase.auth.signOut();
    throw statusError;
  }
}
