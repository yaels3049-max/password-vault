import { getSupabaseClient } from '../supabase/client';
import { AUTH_COPY } from './copy';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled' | 'pending_verification' | 'deleted';

export interface AppUserProfile {
  id: string;
  /** Human-friendly identity starting at 100 (operator display). Ownership uses `id`. */
  userNumber: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailNormalized: string | null;
  phoneNormalized: string | null;
  role: UserRole;
  status: UserStatus;
  isAdmin: boolean;
}

export class AuthRequiredError extends Error {
  constructor(message: string = AUTH_COPY.authRequired) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class AccountStatusError extends Error {
  constructor(message = AUTH_COPY.sessionBlocked) {
    super(message);
    this.name = 'AccountStatusError';
  }
}

function mapProfileRow(row: Record<string, unknown>): AppUserProfile {
  const role = row.role === 'admin' ? 'admin' : 'user';
  const statusRaw = String(row.status ?? 'active');
  const status: UserStatus =
    statusRaw === 'disabled' ||
    statusRaw === 'pending_verification' ||
    statusRaw === 'deleted'
      ? statusRaw
      : 'active';

  return {
    id: String(row.id),
    userNumber:
      row.user_number != null && Number.isFinite(Number(row.user_number))
        ? Number(row.user_number)
        : null,
    firstName: row.first_name != null ? String(row.first_name) : null,
    lastName: row.last_name != null ? String(row.last_name) : null,
    email: row.email != null ? String(row.email) : null,
    emailNormalized: row.email_normalized != null ? String(row.email_normalized) : null,
    phoneNormalized: row.phone_normalized != null ? String(row.phone_normalized) : null,
    role,
    status,
    isAdmin: Boolean(row.is_admin) || role === 'admin',
  };
}

/** True when the Supabase user is anonymous (must never satisfy requireAuthenticatedUserId). */
export function isAnonymousAuthUser(user: {
  is_anonymous?: boolean;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
}): boolean {
  if (user.is_anonymous === true) {
    return true;
  }
  const provider = user.app_metadata?.provider;
  if (provider === 'anonymous') {
    return true;
  }
  if (!user.email || !String(user.email).trim()) {
    return true;
  }
  return false;
}

/**
 * Returns auth.uid() only for a non-anonymous email session.
 * Never creates users. Never calls signInAnonymously.
 */
export async function requireAuthenticatedUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new AuthRequiredError(AUTH_COPY.supabaseMissing);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new AuthRequiredError();
  }
  if (isAnonymousAuthUser(data.user)) {
    throw new AuthRequiredError();
  }
  return data.user.id;
}

/** Soft variant for optional cloud paths — null if unauthenticated / anonymous. */
export async function tryGetAuthenticatedUserId(): Promise<string | null> {
  try {
    return await requireAuthenticatedUserId();
  } catch {
    return null;
  }
}

export async function loadAppUserProfile(userId?: string): Promise<AppUserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const id = userId ?? (await tryGetAuthenticatedUserId());
  if (!id) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, user_number, first_name, last_name, email, email_normalized, phone_normalized, role, status, is_admin',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProfileRow(data as Record<string, unknown>);
}

export async function assertActiveProfile(profile: AppUserProfile | null): Promise<AppUserProfile> {
  if (!profile) {
    throw new AuthRequiredError();
  }
  if (profile.status === 'disabled' || profile.status === 'deleted') {
    throw new AccountStatusError();
  }
  return profile;
}

/** Count authoritative cloud user_services for post-auth routing (AC-109-14…16). */
export async function countUserServices(userId: string): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { count, error } = await supabase
    .from('user_services')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return null;
  }
  return count ?? 0;
}

export async function signOutAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
}

/**
 * Restore existing session without creating users.
 * Returns profile when a valid non-anonymous active session exists.
 */
export async function restoreAccountSession(): Promise<AppUserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || isAnonymousAuthUser(data.user)) {
    return null;
  }

  const profile = await loadAppUserProfile(data.user.id);
  if (!profile) {
    return null;
  }
  if (profile.status === 'disabled' || profile.status === 'deleted') {
    await signOutAccount();
    throw new AccountStatusError();
  }
  return profile;
}
