type ChromeRuntime = {
  sendMessage: (
    id: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

export function getChromeRuntime(): ChromeRuntime | undefined {
  return (
    globalThis as typeof globalThis & { chrome?: { runtime: ChromeRuntime } }
  ).chrome?.runtime;
}

export function getExtensionId(): string {
  return typeof import.meta.env.VITE_POC_EXTENSION_ID === 'string'
    ? import.meta.env.VITE_POC_EXTENSION_ID.trim()
    : '';
}

export function isExtensionAvailable(): boolean {
  return Boolean(getChromeRuntime()?.sendMessage && getExtensionId());
}

export function openUrlInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function sendExtensionMessage(
  payload: Record<string, unknown>,
  onErrorOpenUrl?: string,
): boolean {
  const runtime = getChromeRuntime();
  const extensionId = getExtensionId();

  if (!runtime?.sendMessage || !extensionId) {
    return false;
  }

  runtime.sendMessage(extensionId, payload, () => {
    if (runtime.lastError && onErrorOpenUrl) {
      openUrlInNewTab(onErrorOpenUrl);
    }
  });

  return true;
}
