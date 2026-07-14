import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import {
  hasConfiguredLoginFields,
  type LoginField,
  type Service,
} from '../mockServices';

/**
 * Metadata-driven generic autofill gate (D-103-5 / D-110-1).
 * Origin-independent: catalog / custom / admin share this gate.
 * Never keyed by service id, host, or source_type (AC-110-1…4, AC-110-11).
 *
 * Attempt fill when credentials are complete for the effective field schema
 * (`loginFields` argument — usually from getLoginFields), and either:
 *   - the service has an explicit loginFields schema, or
 *   - a dedicated loginUrl exists (custom/discovered services often omit
 *     loginFields in the registry while the Hub credential UI already uses
 *     DEFAULT_LOGIN_FIELDS).
 */
export function shouldAttemptGenericAutofill(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  if (!hasCompleteCredentials(credential, loginFields)) {
    return false;
  }
  if (hasConfiguredLoginFields(service)) {
    return true;
  }
  return Boolean(service.loginUrl?.trim());
}

/** Non-sensitive health codes for fill outcomes (Phase 110 / 112 hooks). */
export type AutofillHealthCode = 'fill_failed' | 'not_standard_login';
