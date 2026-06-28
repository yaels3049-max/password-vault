import type { DiscoveryResult } from '../discoveryResult';
import type { DiscoveryExecutionOutcome, DiscoveryExecutor } from './discoveryExecution';

const extensionId =
  typeof import.meta.env.VITE_POC_EXTENSION_ID === 'string'
    ? import.meta.env.VITE_POC_EXTENSION_ID.trim()
    : '';

type ChromeRuntime = {
  sendMessage: (
    id: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

function getChromeRuntime(): ChromeRuntime | undefined {
  return (
    globalThis as typeof globalThis & { chrome?: { runtime: ChromeRuntime } }
  ).chrome?.runtime;
}

function isExtensionMessagingAvailable(): boolean {
  return Boolean(getChromeRuntime()?.sendMessage && extensionId);
}

type ExtensionLoginDiscoveryResponse =
  | { ok: true; discovery: DiscoveryResult }
  | { ok: false; reason: string };

function requestExtensionLoginDiscovery(
  primaryUrl: string,
): Promise<ExtensionLoginDiscoveryResponse> {
  const runtime = getChromeRuntime();

  if (!runtime?.sendMessage || !extensionId) {
    return Promise.resolve({ ok: false, reason: 'extension_unavailable' });
  }

  return new Promise((resolve) => {
    runtime.sendMessage(
      extensionId,
      {
        type: 'HUB_LOGIN_ENTRY_DISCOVERY',
        primaryUrl: primaryUrl.trim(),
      },
      (response: unknown) => {
        if (runtime.lastError?.message) {
          resolve({ ok: false, reason: runtime.lastError.message });
          return;
        }

        if (!response || typeof response !== 'object') {
          resolve({ ok: false, reason: 'invalid_extension_response' });
          return;
        }

        const payload = response as Record<string, unknown>;
        if (payload.ok === true && payload.discovery && typeof payload.discovery === 'object') {
          resolve({
            ok: true,
            discovery: payload.discovery as DiscoveryResult,
          });
          return;
        }

        resolve({
          ok: false,
          reason:
            typeof payload.reason === 'string' ? payload.reason : 'extension_discovery_failed',
        });
      },
    );
  });
}

/**
 * Production discovery executor (Iteration 3.3b / 3.6).
 *
 * Opens a visible temporary browser tab via the Hub extension, runs the discovery engine against
 * the live DOM, returns the result, and closes the tab when safe.
 *
 * **Temporary implementation:** Visible tabs are used because they are available today without
 * additional browser APIs. The production goal is non-intrusive discovery (background or hidden
 * execution) whenever browser capabilities allow — without changing the Hub API or discovery engine.
 */
export const extensionTabDiscoveryExecutor: DiscoveryExecutor = {
  id: 'extension-tab',

  async discoverLogin(primaryUrl: string): Promise<DiscoveryExecutionOutcome> {
    const trimmed = primaryUrl.trim();

    if (!isExtensionMessagingAvailable()) {
      return { status: 'unavailable', reason: 'extension_unavailable' };
    }

    const response = await requestExtensionLoginDiscovery(trimmed);

    if (!response.ok) {
      if (response.reason === 'extension_unavailable') {
        return { status: 'unavailable', reason: response.reason };
      }

      return { status: 'error', reason: response.reason };
    }

    return {
      status: 'success',
      result: response.discovery,
    };
  },
};
