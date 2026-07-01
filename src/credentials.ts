import type { LoginField } from './service/legacyService';

export type Credential = Record<string, string>;

export function hasCompleteCredentials(
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  if (!credential) return false;
  return loginFields.every((field) => Boolean(credential[field.id]?.trim()));
}
