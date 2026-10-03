import {
  AuthRequiredError,
  isAnonymousAuthUser,
  loadAppUserProfile,
  requireAuthenticatedUserId,
} from '../auth';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { formatUnknownError } from '../formatErrorChain';

export type AdminAccessStatus =
  | 'allowed'
  | 'unauthenticated'
  | 'not_admin'
  | 'inactive'
  | 'misconfigured'
  | 'error';

export interface AdminAccessResult {
  status: AdminAccessStatus;
  userId: string | null;
  isAdmin: boolean;
  error: string | null;
}

export interface SignedInAdmin {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

/** Signed-in admin for the top app bar: session email + own `public.users` name; null when unavailable. */
export async function readSignedInAdmin(): Promise<SignedInAdmin | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.trim();
    if (!email || !data.user?.id) return null;
    const profile = await loadAppUserProfile(data.user.id);
    return { firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null, email };
  } catch {
    return null;
  }
}

/**
 * Resolve admin access for an email-authenticated session only.
 * Never creates anonymous users (Phase 109).
 * Callers must show Login when status === 'unauthenticated' (D-109-22).
 */
export async function resolveAdminAccess(): Promise<AdminAccessResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'misconfigured',
      userId: null,
      isAdmin: false,
      error: 'Supabase לא מוגדר. הוסיפו VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const userId = await requireAuthenticatedUserId();
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        status: 'misconfigured',
        userId: null,
        isAdmin: false,
        error: 'חיבור Supabase לא זמין.',
      };
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || isAnonymousAuthUser(userData.user)) {
      return {
        status: 'unauthenticated',
        userId: null,
        isAdmin: false,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('users')
      .select('is_admin, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return {
        status: 'error',
        userId,
        isAdmin: false,
        error: formatUnknownError(error),
      };
    }

    if (data?.status === 'disabled' || data?.status === 'deleted') {
      return {
        status: 'inactive',
        userId,
        isAdmin: false,
        error: 'החשבון אינו פעיל.',
      };
    }

    const isAdmin = Boolean(data?.is_admin) || data?.role === 'admin';
    if (!isAdmin) {
      return {
        status: 'not_admin',
        userId,
        isAdmin: false,
        error: 'אין הרשאת מנהל לחשבון זה. קידום מתבצע ב-SQL בלבד.',
      };
    }

    return {
      status: 'allowed',
      userId,
      isAdmin: true,
      error: null,
    };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return {
        status: 'unauthenticated',
        userId: null,
        isAdmin: false,
        error: null,
      };
    }
    return {
      status: 'error',
      userId: null,
      isAdmin: false,
      error: formatUnknownError(error),
    };
  }
}
