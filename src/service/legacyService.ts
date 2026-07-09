export type ServiceCategory = string;

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
  /** Optional adapter routing metadata (e.g. htzone). */
  adapterId?: string;
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

/** True when the service definition includes an explicit login field schema. */
export function hasConfiguredLoginFields(service: Service): boolean {
  return Boolean(service.loginFields && service.loginFields.length > 0);
}

/**
 * Whether a service definition carries explicit login metadata from registry/catalog.
 * Phase 102 tile open does not branch on this flag (stabilization).
 * Phase 103 unified execution may use it for autofill eligibility only.
 */
export function hasLoginIntegrationMetadata(service: Service): boolean {
  return hasConfiguredLoginFields(service) || Boolean(service.loginUrl?.trim());
}
