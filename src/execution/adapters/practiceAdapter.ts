import { hasCompleteCredentials } from '../../credentials';
import { isExtensionAvailable, openUrlInNewTab, sendExtensionMessage } from '../extensionBridge';
import type { ServiceAdapter } from './types';

function withAutofillParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('pocAutofill', '1');
  return parsed.toString();
}

function resolvePracticeDemoUrl(serviceUrl: string): string {
  return new URL(serviceUrl, window.location.origin).toString();
}

export const practiceAdapter: ServiceAdapter = {
  execute({ service, credential, loginFields }) {
    if (!hasCompleteCredentials(credential, loginFields)) {
      return { ok: false, reason: 'credentials_missing' };
    }

    const vaultCredentials: Record<string, string> = {};
    for (const field of loginFields) {
      vaultCredentials[field.id] = credential![field.id].trim();
    }

    const demoUrl = withAutofillParam(resolvePracticeDemoUrl(service.url));
    const payload: Record<string, unknown> = {
      type: 'POC_FILL_DEMO',
      url: demoUrl,
      credentials: vaultCredentials,
      loginFields,
    };

    if (!sendExtensionMessage(payload, demoUrl)) {
      openUrlInNewTab(demoUrl);
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
