import type { Credential } from './credentials';
import { getServiceOpenUrl, mockServices } from './mockServices';

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

export const HTZONE_SERVICE_ID = 'htzone';
const htzoneService = mockServices.find((service) => service.id === HTZONE_SERVICE_ID);
export const POC_IL_SITE_URL = htzoneService
  ? getServiceOpenUrl(htzoneService)
  : 'https://www.htzone.co.il/login';

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

export function getHtzoneVaultCredentials(
  vaultCredentials: Record<string, Credential>,
): { email: string; password: string } | null {
  const stored = vaultCredentials[HTZONE_SERVICE_ID];
  const email = stored?.email?.trim();
  const password = stored?.password?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
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

function openHtzonePage(
  credentials?: Record<string, string>,
  withAutofillParam = true,
): void {
  const url = POC_IL_SITE_URL;
  const runtime = getChromeRuntime();
  const payload: Record<string, unknown> = {
    type: 'POC_FILL_IL',
    url,
    withAutofillParam,
  };

  if (credentials) {
    payload.credentials = credentials;
  }

  if (runtime?.sendMessage && extensionId) {
    runtime.sendMessage(extensionId, payload, () => {
      if (runtime.lastError) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
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

/** HTZone mock test: open login and fill mock email/password only. */
export function openIsraeliSiteAutofillTest(): void {
  openHtzonePage(undefined, true);
}

/** HTZone tile: open login and fill saved vault credentials when available. */
export function openHtzoneTile(
  vaultCredentials: Record<string, Credential>,
): void {
  const saved = getHtzoneVaultCredentials(vaultCredentials);

  if (!saved) {
    window.open(POC_IL_SITE_URL, '_blank', 'noopener,noreferrer');
    return;
  }

  openHtzonePage(saved, false);
}
