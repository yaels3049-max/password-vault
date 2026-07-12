import type { BrowserHostAdapter, ExtensionMessage } from './types';

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

function readExtensionId(): string {
  return typeof import.meta.env.VITE_POC_EXTENSION_ID === 'string'
    ? import.meta.env.VITE_POC_EXTENSION_ID.trim()
    : '';
}

/**
 * Chrome + Edge Chromium host adapter (AC-108-1, AC-108-2).
 * Firefox/Safari slots can implement the same BrowserHostAdapter interface later.
 */
export const chromeHostAdapter: BrowserHostAdapter = {
  probeExtensionAvailable(): boolean {
    return Boolean(getChromeRuntime()?.sendMessage && readExtensionId());
  },

  getExtensionId(): string {
    return readExtensionId();
  },

  sendExtensionMessage(
    message: ExtensionMessage,
    onResponse?: (response: unknown, lastError: string | null) => void,
  ): boolean {
    const runtime = getChromeRuntime();
    const extensionId = readExtensionId();

    if (!runtime?.sendMessage || !extensionId) {
      return false;
    }

    runtime.sendMessage(extensionId, message, (response) => {
      const err = runtime.lastError?.message ?? null;
      onResponse?.(response, err);
    });

    return true;
  },

  sendExtensionMessageAsync<T = unknown>(message: ExtensionMessage): Promise<T | null> {
    const runtime = getChromeRuntime();
    const extensionId = readExtensionId();

    if (!runtime?.sendMessage || !extensionId) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      runtime.sendMessage(extensionId, message, (response) => {
        if (runtime.lastError?.message) {
          resolve(null);
          return;
        }
        resolve((response as T) ?? null);
      });
    });
  },

  openUrlInNewTab(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};
