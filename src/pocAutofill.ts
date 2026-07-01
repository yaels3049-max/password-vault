import type { Credential } from './credentials';
import { hasCompleteCredentials } from './credentials';
import {
  DEFAULT_LOGIN_FIELDS,
  getServiceOpenUrl,
  HUB_PRACTICE_LOGIN_ID,
  mockServices,
  type LoginField,
  type Service,
} from './mockServices';
import { htzoneAdapter } from './execution/adapters/htzoneAdapter';
import { practiceAdapter } from './execution/adapters/practiceAdapter';
import { executeGenericAutofill } from './execution/genericAutofill';
import {
  isExtensionAvailable,
  openUrlInNewTab,
  sendExtensionMessage,
} from './execution/extensionBridge';
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
export const SHUFERSAL_SERVICE_ID = 'shufersal';
export const CLALIT_SERVICE_ID = 'clalit';
export { HUB_PRACTICE_LOGIN_ID };
export const HUB_PRACTICE_DEMO_PATH = '/demo-login.html';

const htzoneService = mockServices.find((service) => service.id === HTZONE_SERVICE_ID);
export const POC_IL_SITE_URL = htzoneService
  ? getServiceOpenUrl(htzoneService)
  : 'https://www.htzone.co.il/login';

/** True in Vite dev server (`npm run dev`). POC dashboard controls are dev-only. */
export function isPocControlsVisible(): boolean {
  return import.meta.env.DEV;
}

export function isHubPracticeService(service: Service): boolean {
  return service.id === HUB_PRACTICE_LOGIN_ID;
}

export { hasCompleteCredentials, isExtensionAvailable };

function withPocAutofillParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('pocAutofill', '1');
  return parsed.toString();
}

function localDemoUrl(path: string, useAutofillParam = true): string {
  const absolute = new URL(path, window.location.origin).toString();
  return useAutofillParam ? withPocAutofillParam(absolute) : absolute;
}

/** POC button: open local demo-login.html and trigger extension autofill. */
export function openDemoAndFill(): void {
  const url = localDemoUrl(HUB_PRACTICE_DEMO_PATH);
  if (!sendExtensionMessage({ type: 'POC_FILL_DEMO', url }, url)) {
    openUrlInNewTab(url);
  }
}

/** POC button: open local 3-field demo page and trigger extension autofill. */
export function openDemo3FieldsAndFill(): void {
  const url = localDemoUrl('/demo-login-3-fields.html');
  if (!sendExtensionMessage({ type: 'POC_FILL_DEMO', url }, url)) {
    openUrlInNewTab(url);
  }
}

/** HTZone mock test: open login and fill mock email/password only. */
export function openIsraeliSiteAutofillTest(): void {
  const url = POC_IL_SITE_URL;
  if (
    !sendExtensionMessage(
      { type: 'POC_FILL_IL', url, withAutofillParam: true },
      url,
    )
  ) {
    openUrlInNewTab(url);
  }
}

/** Dev-only: exercise generic autofill against Shufersal login URL. */
export function openShufersalLoginFromTile(
  credential: Credential | undefined,
  loginFields: LoginField[] = DEFAULT_LOGIN_FIELDS,
): ReturnType<typeof executeGenericAutofill> {
  const shufersalService = mockServices.find((service) => service.id === SHUFERSAL_SERVICE_ID);
  const url = shufersalService
    ? getServiceOpenUrl(shufersalService)
    : 'https://www.shufersal.co.il/online/he/login';
  return executeGenericAutofill(url, credential, loginFields);
}

/** Dev-only: exercise generic autofill against Clalit login URL. */
export function openClalitLoginFromTile(
  credential: Credential | undefined,
  loginFields: LoginField[] = DEFAULT_LOGIN_FIELDS,
): ReturnType<typeof executeGenericAutofill> {
  const clalitService = mockServices.find((service) => service.id === CLALIT_SERVICE_ID);
  const url = clalitService
    ? getServiceOpenUrl(clalitService)
    : 'https://e-services.clalit.co.il/onlineweb/general/login.aspx';
  return executeGenericAutofill(url, credential, loginFields);
}

/** Dev-only: exercise HTZone adapter directly. */
export function openHtzoneTile(
  credential: Credential | undefined,
  loginFields: LoginField[] = htzoneService ? htzoneService.loginFields ?? DEFAULT_LOGIN_FIELDS : DEFAULT_LOGIN_FIELDS,
): void {
  htzoneAdapter.execute({
    service: htzoneService ?? {
      id: HTZONE_SERVICE_ID,
      name: 'הייטקזון',
      icon: '🛒',
      url: POC_IL_SITE_URL,
      category: 'shopping',
      adapterId: 'htzone',
    },
    openUrl: POC_IL_SITE_URL,
    credential,
    loginFields,
  });
}

/** Dev-only: exercise practice adapter directly. */
export function openPracticeLoginFromTile(
  credential: Credential | undefined,
  loginFields: LoginField[] = DEFAULT_LOGIN_FIELDS,
): ReturnType<typeof practiceAdapter.execute> {
  const practiceService = mockServices.find((service) => service.id === HUB_PRACTICE_LOGIN_ID);
  if (!practiceService) {
    return { ok: false, reason: 'credentials_missing' };
  }

  return practiceAdapter.execute({
    service: practiceService,
    openUrl: getServiceOpenUrl(practiceService),
    credential,
    loginFields,
  });
}

export { executeGenericAutofill as openGenericLoginFromTile };
