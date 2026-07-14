/** Login-related keywords for visible text and URL matching (Hebrew + English). */
export const LOGIN_TEXT_KEYWORDS = [
  'login',
  'log in',
  'log-in',
  'signin',
  'sign in',
  'sign-in',
  'sign on',
  'account',
  'התחבר',
  'התחברות',
  'כניסה',
  'כניסה לחשבון',
  'היכנס',
  'member login',
  'my account',
] as const;

/** URL path segments that commonly indicate login destinations. */
export const LOGIN_PATH_SEGMENTS = [
  '/login',
  '/log-in',
  '/signin',
  '/sign-in',
  '/account/login',
  '/account/signin',
  '/users/login',
  '/user/login',
  '/auth/login',
  '/authentication/login',
  '/portal/login',
  '/online/he/login',
  '/onlineweb/general/login.aspx',
] as const;

/** Subdomain prefixes often used for authentication / consumer service login. */
export const AUTH_SUBDOMAIN_PREFIXES = [
  'login',
  'signin',
  'auth',
  'account',
  'accounts',
  'myaccount',
  'e-services',
  'eservices',
  // Bank Jerusalem-class: services.bankjerusalem.co.il/Pages/Login.aspx
  'services',
  'secure',
  'id',
  'online',
  // Federated / parent IdP hosts (D-108-27) — also same-brand probeable.
  'sso',
  'identity',
] as const;

/**
 * Trusted IdP host labels for cross-registrable federated accept (D-108-27).
 * Subset of AUTH-style prefixes that commonly host parent-company SSO.
 */
export const FEDERATED_IDP_HOST_PREFIXES = [
  'id',
  'login',
  'auth',
  'accounts',
  'sso',
  'identity',
] as const;

export const COMMON_LOGIN_PATH_FALLBACKS = [
  '/login',
  '/signin',
  '/sign-in',
  '/account/login',
  '/user/login',
  '/auth/login',
] as const;

export const MAX_REDIRECT_HOPS = 10;

export const DISCOVERY_FETCH_TIMEOUT_MS = 12_000;
