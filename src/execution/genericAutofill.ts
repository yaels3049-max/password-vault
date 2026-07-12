import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import type { LoginField } from '../mockServices';
import { getExtensionId, isExtensionAvailable, openUrlInNewTab, sendExtensionMessage } from './extensionBridge';

export type GenericAutofillResult =
  | { ok: true; extensionUsed: boolean }
  | { ok: false; reason: 'credentials_missing' };

function logGenericFillDev(message: string, detail?: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }
  if (detail !== undefined) {
    console.log(message, detail);
    return;
  }
  console.log(message);
}

/** Open a login URL and fill credentials via the generic extension engine (POC / Phase 103). */
export function executeGenericAutofill(
  url: string,
  credential: Credential | undefined,
  loginFields: LoginField[],
): GenericAutofillResult {
  if (!hasCompleteCredentials(credential, loginFields)) {
    return { ok: false, reason: 'credentials_missing' };
  }

  const vaultCredentials: Credential = {};
  for (const field of loginFields) {
    vaultCredentials[field.id] = credential![field.id].trim();
  }

  const payload: Record<string, unknown> = {
    type: 'POC_GENERIC_FILL',
    url,
    loginFields,
    credentials: vaultCredentials,
  };

  logGenericFillDev('[Generic Fill] Hub: vault credentials prepared for extension', {
    extensionConfigured: Boolean(getExtensionId()),
    extensionAvailable: isExtensionAvailable(),
    fieldIds: loginFields.map((field) => field.id),
  });

  if (sendExtensionMessage(payload, url)) {
    logGenericFillDev('[Generic Fill] Hub: sending POC_GENERIC_FILL', {
      type: payload.type,
      url: payload.url,
      loginFields,
    });
    return { ok: true, extensionUsed: true };
  }

  logGenericFillDev(
    '[Generic Fill] Hub: extension unavailable — opening login page without fill',
    getExtensionId() ? 'extension messaging unavailable' : 'extension id not configured',
  );
  openUrlInNewTab(url);

  return { ok: true, extensionUsed: false };
}
