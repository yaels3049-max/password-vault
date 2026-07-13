import { isDevBuild } from '../dev/devMode';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { AUTH_COPY, mapAuthErrorToFriendly } from './copy';
import { isValidEmailFormat, normalizeEmail, normalizePhone } from './normalize';
import { validateAccountPassword } from './passwordPolicy';
import {
  assertActiveProfile,
  loadAppUserProfile,
  signOutAccount,
  type AppUserProfile,
} from './session';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
}

export function validateRegisterInput(input: RegisterInput): string | null {
  if (
    !input.firstName.trim() ||
    !input.lastName.trim() ||
    !input.email.trim() ||
    !input.phone.trim() ||
    !input.password ||
    !input.passwordConfirm
  ) {
    return AUTH_COPY.requiredFields;
  }
  if (!isValidEmailFormat(input.email)) {
    return AUTH_COPY.invalidEmail;
  }
  if (input.password !== input.passwordConfirm) {
    return AUTH_COPY.passwordMismatch;
  }
  return validateAccountPassword(input.password);
}

function isAlreadyRegisteredAuthError(error: unknown): boolean {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : String(error ?? '').toLowerCase();
  return (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already') ||
    message.includes('email address is already')
  );
}

function describeAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? '');
  }
  const e = error as { message?: unknown; code?: unknown; status?: unknown };
  const parts = [
    e.code != null ? String(e.code) : '',
    e.status != null ? String(e.status) : '',
    e.message != null ? String(e.message) : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function logRegisterFailure(stage: string, error: unknown): void {
  if (!isDevBuild()) {
    return;
  }
  // Never log passwords / tokens — message/code only
  console.warn('[auth] register failed:', stage, describeAuthError(error));
}

/** In DEV, append a short non-secret hint so operators can report the real failure. */
function withDevHint(friendly: string, error: unknown): string {
  if (!isDevBuild()) {
    return friendly;
  }
  const detail = describeAuthError(error).slice(0, 160);
  if (!detail) {
    return friendly;
  }
  return `${friendly}\n(פרטי פיתוח: ${detail})`;
}

async function loadProfileOrNull(): Promise<AppUserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    return null;
  }
  return loadAppUserProfile(data.user.id);
}

async function ensureProfileForSession(input: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNormalized: string;
}): Promise<AppUserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  // Trigger may have already created the row on auth.users INSERT — prefer success.
  const existing = await loadProfileOrNull();
  if (existing) {
    if (existing.isAdmin || existing.role === 'admin') {
      await signOutAccount();
      throw new Error(AUTH_COPY.profileIncomplete);
    }
    return assertActiveProfile(existing);
  }

  const { error: profileError } = await supabase.rpc('ensure_app_user_profile', {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone_normalized: input.phoneNormalized,
  });

  if (profileError) {
    logRegisterFailure('ensure_app_user_profile', profileError);
    // Profile might still exist from a concurrent trigger — try once more
    const raced = await loadProfileOrNull();
    if (raced) {
      return assertActiveProfile(raced);
    }
    await signOutAccount();
    const msg = (profileError.message ?? '').toLowerCase();
    if (msg.includes('not authenticated')) {
      throw new Error(withDevHint(AUTH_COPY.registerConfirmEmail, profileError));
    }
    throw new Error(
      withDevHint(
        msg.includes('23505') || msg.includes('email_normalized') || msg.includes('already registered')
          ? AUTH_COPY.registerDuplicate
          : msg.includes('database') || msg.includes('user_number') || msg.includes('null value')
            ? AUTH_COPY.registerDatabaseError
            : AUTH_COPY.profileIncomplete,
        profileError,
      ),
    );
  }

  const profile = await loadProfileOrNull();
  if (!profile) {
    logRegisterFailure('loadAppUserProfile', 'profile row missing after RPC');
    await signOutAccount();
    throw new Error(AUTH_COPY.profileIncomplete);
  }

  if (profile.isAdmin || profile.role === 'admin') {
    await signOutAccount();
    throw new Error(AUTH_COPY.profileIncomplete);
  }

  return assertActiveProfile(profile);
}

async function recoverOrphanAuthRegistration(
  input: RegisterInput,
  email: string,
  phoneNormalized: string,
  firstName: string,
  lastName: string,
): Promise<AppUserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError) {
    logRegisterFailure('orphan recover signIn', signInError);
    throw new Error(withDevHint(AUTH_COPY.registerDuplicate, signInError));
  }

  return ensureProfileForSession({
    firstName,
    lastName,
    email,
    phoneNormalized,
  });
}

async function establishSessionAfterSignUp(
  input: RegisterInput,
  email: string,
  phoneNormalized: string,
  firstName: string,
  lastName: string,
  identitiesLength: number,
): Promise<AppUserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  if (identitiesLength === 0) {
    return recoverOrphanAuthRegistration(
      input,
      email,
      phoneNormalized,
      firstName,
      lastName,
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError) {
    logRegisterFailure('post-signUp signIn', signInError);
    const lower = (signInError.message ?? '').toLowerCase();
    if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
      throw new Error(withDevHint(AUTH_COPY.registerConfirmEmail, signInError));
    }
    throw new Error(
      withDevHint(mapAuthErrorToFriendly(signInError, 'register'), signInError),
    );
  }

  return ensureProfileForSession({
    firstName,
    lastName,
    email,
    phoneNormalized,
  });
}

/**
 * Explicit registration only path that creates Auth + public.users (AC-109-3).
 */
export async function registerAccount(input: RegisterInput): Promise<AppUserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  const validationError = validateRegisterInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(AUTH_COPY.supabaseMissing);
  }

  const email = normalizeEmail(input.email);
  const phoneNormalized = normalizePhone(input.phone);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        phone_normalized: phoneNormalized,
      },
    },
  });

  if (error || !data.user) {
    logRegisterFailure('signUp', error);
    if (isAlreadyRegisteredAuthError(error)) {
      return recoverOrphanAuthRegistration(
        input,
        email,
        phoneNormalized,
        firstName,
        lastName,
      );
    }
    throw new Error(
      withDevHint(
        mapAuthErrorToFriendly(error ?? AUTH_COPY.registerGenericFailure, 'register'),
        error,
      ),
    );
  }

  if (!data.session) {
    return establishSessionAfterSignUp(
      input,
      email,
      phoneNormalized,
      firstName,
      lastName,
      data.user.identities?.length ?? 0,
    );
  }

  return ensureProfileForSession({
    firstName,
    lastName,
    email,
    phoneNormalized,
  });
}
