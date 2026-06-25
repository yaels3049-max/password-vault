/** Local demo-only mock credentials. */
export const POC_MOCK_CREDENTIALS = {
  username: 'demo-user',
  password: 'demo-pass',
};

export const POC_MOCK_3_FIELD_CREDENTIALS = {
  idNumber: '123456789',
  userCode: 'demo-code',
  password: 'demo-pass',
};

const extensionId = import.meta.env.VITE_POC_EXTENSION_ID;

function withPocAutofillParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('pocAutofill', '1');
  return parsed.toString();
}

function localDemoUrl(path: string): string {
  return withPocAutofillParam(new URL(path, window.location.origin).toString());
}

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

function openLocalDemoPage(path: string): void {
  const url = localDemoUrl(path);
  const runtime = getChromeRuntime();

  if (runtime?.sendMessage && extensionId) {
    runtime.sendMessage(
      extensionId,
      {
        type: 'POC_FILL_DEMO',
        url,
      },
      () => {
        if (runtime.lastError) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
    );
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** POC button: open local demo-login.html and trigger extension autofill. */
export function openDemoAndFill(): void {
  openLocalDemoPage('/demo-login.html');
}

/** POC button: open local 3-field demo page and trigger extension autofill. */
export function openDemo3FieldsAndFill(): void {
  openLocalDemoPage('/demo-login-3-fields.html');
}
