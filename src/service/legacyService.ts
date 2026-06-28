export type ServiceCategory = 'practice' | 'banking' | 'health' | 'shopping';

export type LoginFieldType = 'text' | 'password';

export interface LoginField {
  id: string;
  label: string;
  type: LoginFieldType;
}

/** Legacy runtime service shape used by Dashboard, vault, and autofill today. */
export interface Service {
  id: string;
  name: string;
  icon: string;
  url: string;
  loginUrl?: string;
  category: ServiceCategory;
  logoUrl?: string;
  loginFields?: LoginField[];
}

export const DEFAULT_LOGIN_FIELDS: LoginField[] = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];

export function getServiceOpenUrl(service: Service): string {
  return service.loginUrl ?? service.url;
}

export function getLoginFields(service: Service): LoginField[] {
  return service.loginFields ?? DEFAULT_LOGIN_FIELDS;
}
