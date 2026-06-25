import type { Credential } from './credentials';
import {
  DEFAULT_LOGIN_FIELDS,
  getServiceOpenUrl,
  HUB_PRACTICE_LOGIN_ID,
  mockServices,
  type LoginField,
  type Service,
} from './mockServices';

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
export { HUB_PRACTICE_LOGIN_ID };
export const HUB_PRACTICE_DEMO_PATH = '/demo-login.html';

const htzoneService = mockServices.find((service) => service.id === HTZONE_SERVICE_ID);
export const POC_IL_SITE_URL = htzoneService
  ? getServiceOpenUrl(htzoneService)
  : 'https://www.htzone.co.il/login';

const extensionId =
  typeof import.meta.env.VITE_POC_EXTENSION_ID === 'string'
    ? import.meta.env.VITE_POC_EXTENSION_ID.trim()
    : '';

/** True in Vite dev server (`npm run dev`). POC dashboard controls are dev-only. */
export function isPocControlsVisible(): boolean {
  return import.meta.env.DEV;
}

export function isHubPracticeService(service: Service): boolean {
  return service.id === HUB_PRACTICE_LOGIN_ID;
}

export function isExtensionAvailable(): boolean {
  return Boolean(getChromeRuntime()?.sendMessage && extensionId);
}

function withPocAutofillParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('pocAutofill', '1');
  return parsed.toString();
}

function localDemoUrl(path: string, useAutofillParam = true): string {
  const absolute = new URL(path, window.location.origin).toString();
  return useAutofillParam ? withPocAutofillParam(absolute) : absolute;
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

export function hasCompleteCredentials(
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  if (!credential) return false;
  return loginFields.every((field) => Boolean(credential[field.id]?.trim()));
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

type DemoFillOptions = {
  credentials?: Credential;
  loginFields?: LoginField[];
};

function openLocalDemoPage(path: string, options?: DemoFillOptions): void {
  const useUrlAutofill = !options?.credentials;
  const url = localDemoUrl(path, useUrlAutofill);
  const runtime = getChromeRuntime();
  const payload: Record<string, unknown> = {
    type: 'POC_FILL_DEMO',
    url,
  };

  if (options?.credentials) {
    payload.credentials = options.credentials;
  }

  if (options?.loginFields) {
    payload.loginFields = options.loginFields;
  }

  if (runtime?.sendMessage && extensionId) {
    const isPracticeVaultFill = Boolean(options?.credentials);

    if (isPracticeVaultFill) {
      console.log('[Practice] Extension target ID:', extensionId);
    }

    runtime.sendMessage(extensionId, payload, (response: unknown) => {
      const lastError = runtime.lastError;

      if (isPracticeVaultFill) {
        if (lastError?.message) {
          console.log('[Practice] Extension send error:', lastError.message);
        } else {
          console.log('[Practice] Extension response:', response);
        }
      }

      if (lastError) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
    return;
  }

  if (options?.credentials) {
    console.log(
      '[Practice] Extension send error:',
      extensionId
        ? 'chrome.runtime.sendMessage unavailable'
        : 'VITE_POC_EXTENSION_ID is not configured',
    );
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
  openLocalDemoPage(HUB_PRACTICE_DEMO_PATH);
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

export type PracticeOpenResult =
  | { ok: true; extensionUsed: boolean }
  | { ok: false; reason: 'credentials_missing' };

/** Hub practice tile: open demo login and fill saved vault credentials. */
export function openPracticeLoginFromTile(
  credential: Credential | undefined,
  loginFields: LoginField[] = DEFAULT_LOGIN_FIELDS,
): PracticeOpenResult {
  if (!hasCompleteCredentials(credential, loginFields)) {
    return { ok: false, reason: 'credentials_missing' };
  }

  const vaultCredentials: Credential = {};
  for (const field of loginFields) {
    vaultCredentials[field.id] = credential![field.id].trim();
  }

  console.log('[Practice] Practice credentials found');
  console.log('[Practice] Practice credentials sent to extension');

  openLocalDemoPage(HUB_PRACTICE_DEMO_PATH, {
    credentials: vaultCredentials,
    loginFields,
  });

  return { ok: true, extensionUsed: isExtensionAvailable() };
}
