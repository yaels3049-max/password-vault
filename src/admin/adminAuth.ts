import { ensureAnonymousUserId } from '../supabase/auth';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { formatUnknownError } from '../formatErrorChain';

export interface AdminAccessResult {
  userId: string | null;
  isAdmin: boolean;
  error: string | null;
}

export async function resolveAdminAccess(): Promise<AdminAccessResult> {
  if (!isSupabaseConfigured()) {
    return {
      userId: null,
      isAdmin: false,
      error: 'Supabase לא מוגדר. הוסיפו VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const userId = await ensureAnonymousUserId();
    if (!userId) {
      return { userId: null, isAdmin: false, error: 'לא ניתן לאמת משתמש.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { userId: null, isAdmin: false, error: 'חיבור Supabase לא זמין.' };
    }

    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { userId, isAdmin: false, error: formatUnknownError(error) };
    }

    return {
      userId,
      isAdmin: Boolean(data?.is_admin),
      error: null,
    };
  } catch (error) {
    return {
      userId: null,
      isAdmin: false,
      error: formatUnknownError(error),
    };
  }
}
