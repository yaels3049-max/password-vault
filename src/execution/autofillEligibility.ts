import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import {
  hasConfiguredLoginFields,
  type LoginField,
  type Service,
} from '../mockServices';

/** Metadata-driven generic autofill gate (D-103-5). Independent of service id or origin. */
export function shouldAttemptGenericAutofill(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  return (
    hasConfiguredLoginFields(service) &&
    hasCompleteCredentials(credential, loginFields)
  );
}
