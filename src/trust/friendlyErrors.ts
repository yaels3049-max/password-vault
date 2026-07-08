import { TRUST_COPY } from './copy';

/**
 * Map vault/persist failures to friendly Hebrew (AC-106-7).
 * Never surfaces stack traces or crypto internals.
 */
export function toFriendlySecurityError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (message === 'Vault is locked' || /vault is locked/i.test(message)) {
    return TRUST_COPY.vaultLockedRetry;
  }

  if (
    message === 'Vault record missing' ||
    /persist|encrypt|decrypt|quota|indexeddb|network/i.test(message)
  ) {
    return TRUST_COPY.persistFailed;
  }

  // Profile management messages stay localized by caller; unknown → generic.
  if (!message || /error|exception|stack|crypto|aes|pbkdf|argon/i.test(message)) {
    return TRUST_COPY.genericSecurityError;
  }

  // Already-Hebrew / known product messages may pass through if short and safe.
  if (/[\u0590-\u05FF]/.test(message) && message.length < 120) {
    return message;
  }

  return TRUST_COPY.genericSecurityError;
}
