import type { Credential } from '../../credentials';
import { hasCompleteCredentials } from '../../credentials';
import type { LoginField } from '../../mockServices';
import { isExtensionAvailable, openUrlInNewTab, sendExtensionMessage } from '../extensionBridge';
import type { ServiceAdapter } from './types';

function toEmailPasswordPayload(
  credential: Credential,
  loginFields: LoginField[],
): { email: string; password: string } | null {
  const emailField = loginFields.find((field) => field.id === 'email') ?? loginFields[0];
  const passwordField =
    loginFields.find((field) => field.type === 'password') ??
    loginFields[loginFields.length - 1];

  if (!emailField || !passwordField) {
    return null;
  }

  const email = credential[emailField.id]?.trim();
  const password = credential[passwordField.id]?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export const htzoneAdapter: ServiceAdapter = {
  execute({ openUrl, credential, loginFields }) {
    const autofillAttempted = hasCompleteCredentials(credential, loginFields);

    if (!autofillAttempted || !credential) {
      openUrlInNewTab(openUrl);
      return {
        ok: true,
        extensionUsed: false,
        autofillAttempted: false,
      };
    }

    const mapped = toEmailPasswordPayload(credential, loginFields);
    if (!mapped) {
      openUrlInNewTab(openUrl);
      return {
        ok: true,
        extensionUsed: false,
        autofillAttempted: false,
      };
    }

    const payload: Record<string, unknown> = {
      type: 'POC_FILL_IL',
      url: openUrl,
      withAutofillParam: false,
      credentials: mapped,
    };

    if (!sendExtensionMessage(payload, openUrl)) {
      openUrlInNewTab(openUrl);
      return {
        ok: true,
        extensionUsed: false,
        autofillAttempted: true,
      };
    }

    return {
      ok: true,
      extensionUsed: isExtensionAvailable(),
      autofillAttempted: true,
    };
  },
};
