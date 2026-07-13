/**
 * Phase 109 — Account authentication module.
 * Owns login / register / session. Does not create anonymous users.
 * Single Digital Home password: Auth + local vault KDF in one step
 * (see docs/MIGRATION_PHASE_109.md). MFA deferred to Phase 191.
 */

export { AUTH_COPY, mapAuthErrorToFriendly } from './copy';
export { loginWithPassword, type LoginInput } from './login';
export {
  isValidEmailFormat,
  normalizeEmail,
  normalizePhone,
} from './normalize';
export {
  getAccountPasswordPolicy,
  validateAccountPassword,
} from './passwordPolicy';
export { registerAccount, validateRegisterInput, type RegisterInput } from './register';
export {
  AccountStatusError,
  assertActiveProfile,
  AuthRequiredError,
  countUserServices,
  isAnonymousAuthUser,
  loadAppUserProfile,
  requireAuthenticatedUserId,
  restoreAccountSession,
  signOutAccount,
  tryGetAuthenticatedUserId,
  type AppUserProfile,
  type UserRole,
  type UserStatus,
} from './session';
