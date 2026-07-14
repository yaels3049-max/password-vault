import type { DiscoveryResult } from '../discoveryResult';
import type { DiscoveryExecutionOutcome, DiscoveryExecutor } from './discoveryExecution';
import {
  DISCOVERY_HUB_TIMEOUT_MS,
  getExtensionId,
  probeExtensionAvailable,
  sendExtensionMessageAsync,
} from '../../browserIntegration';

type ExtensionLoginDiscoveryResponse =
  | { ok: true; discovery: DiscoveryResult }
  | { ok: false; reason: string };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(reason));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function requestExtensionLoginDiscovery(
  primaryUrl: string,
): Promise<ExtensionLoginDiscoveryResponse> {
  if (!probeExtensionAvailable() || !getExtensionId()) {
    return { ok: false, reason: 'extension_unavailable' };
  }

  try {
    const response = await withTimeout(
      sendExtensionMessageAsync<ExtensionLoginDiscoveryResponse>({
        type: 'HUB_LOGIN_ENTRY_DISCOVERY',
        primaryUrl: primaryUrl.trim(),
      }),
      DISCOVERY_HUB_TIMEOUT_MS,
      'discovery_hub_timeout',
    );

    if (!response || typeof response !== 'object') {
      return { ok: false, reason: 'invalid_extension_response' };
    }

    const payload = response as ExtensionLoginDiscoveryResponse;
    if (payload.ok === true && payload.discovery && typeof payload.discovery === 'object') {
      return {
        ok: true,
        discovery: payload.discovery,
      };
    }

    return {
      ok: false,
      reason:
        payload.ok === false && typeof payload.reason === 'string'
          ? payload.reason
          : 'extension_discovery_failed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'extension_discovery_failed';
    return { ok: false, reason: message };
  }
}

/**
 * Production discovery executor (Phase 108 M2 + D-108-32).
 *
 * Asks the Hub extension to open an **unfocused off-screen popup window** (not a tab in
 * the Hub strip), run the discovery engine against the live DOM, return the result, and
 * close the discovery window. Hub-side timeout: DISCOVERY_HUB_TIMEOUT_MS (30s default).
 */
export const extensionTabDiscoveryExecutor: DiscoveryExecutor = {
  id: 'extension-tab',

  async discoverLogin(primaryUrl: string): Promise<DiscoveryExecutionOutcome> {
    const trimmed = primaryUrl.trim();

    if (!probeExtensionAvailable()) {
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
