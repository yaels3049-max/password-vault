import { chromeHostAdapter } from './chromeHostAdapter';

export type { BrowserHostAdapter, ExtensionMessage } from './types';
export { DISCOVERY_HUB_TIMEOUT_MS } from './constants';
export { chromeHostAdapter } from './chromeHostAdapter';

const activeAdapter = chromeHostAdapter;

export function probeExtensionAvailable(): boolean {
  return activeAdapter.probeExtensionAvailable();
}

/** @deprecated Use probeExtensionAvailable — kept for extensionBridge consumers. */
export const isExtensionAvailable = probeExtensionAvailable;

export function getExtensionId(): string {
  return activeAdapter.getExtensionId();
}

export function openUrlInNewTab(url: string): void {
  activeAdapter.openUrlInNewTab(url);
}

export function sendExtensionMessage(
  payload: Record<string, unknown>,
  onErrorOpenUrl?: string,
): boolean {
  return activeAdapter.sendExtensionMessage(payload, (response, lastError) => {
    if (import.meta.env.DEV) {
      console.log('[Hub → Extension]', payload.type, { response, lastError });
    }

    if (lastError && onErrorOpenUrl) {
      openUrlInNewTab(onErrorOpenUrl);
    }
  });
}

export function sendExtensionMessageAsync<T = unknown>(
  message: Record<string, unknown>,
): Promise<T | null> {
  return activeAdapter.sendExtensionMessageAsync<T>(message);
}

/** @deprecated Use browserIntegration — legacy alias for migration compatibility. */
export function getChromeRuntime(): ReturnType<typeof getChromeRuntimeFromAdapter> {
  return getChromeRuntimeFromAdapter();
}

function getChromeRuntimeFromAdapter():
  | { sendMessage: ChromeRuntime['sendMessage']; lastError?: { message?: string } }
  | undefined {
  return (
    globalThis as typeof globalThis & {
      chrome?: { runtime: ChromeRuntime };
    }
  ).chrome?.runtime;
}

type ChromeRuntime = {
  sendMessage: (
    id: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};
