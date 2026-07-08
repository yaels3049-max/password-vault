import type { FocusEvent, InputHTMLAttributes } from 'react';

/**
 * Hub credential field hardening (Phase 106 / D-106-5).
 * Email/username: browser autocomplete + history allowed.
 * Password: PM suppression (no generate/save/update prompts).
 */

export type HubCredentialAssistLevel = 'browser' | 'neutral' | 'password-hardened';

export function hubCredentialAssistLevel(
  fieldId: string,
  fieldType: 'text' | 'password',
): HubCredentialAssistLevel {
  if (fieldType === 'password') {
    return 'password-hardened';
  }
  const normalized = fieldId.toLowerCase();
  if (normalized === 'email' || normalized.includes('email')) {
    return 'browser';
  }
  if (normalized === 'username' || normalized === 'user' || normalized.includes('username')) {
    return 'browser';
  }
  return 'neutral';
}

export function hubCredentialFieldName(
  serviceId: string,
  fieldId: string,
  fieldType: 'text' | 'password',
): string {
  if (fieldType === 'password') {
    return `hub-vault-cred-${serviceId}-${fieldId}`;
  }
  if (hubCredentialAssistLevel(fieldId, fieldType) === 'browser') {
    return fieldId;
  }
  return `hub-vault-cred-${serviceId}-${fieldId}`;
}

export function hubCredentialAutoComplete(
  fieldId: string,
  fieldType: 'text' | 'password',
): string {
  if (fieldType === 'password') {
    return 'one-time-code';
  }
  const level = hubCredentialAssistLevel(fieldId, fieldType);
  if (level === 'browser') {
    const normalized = fieldId.toLowerCase();
    if (normalized === 'email' || normalized.includes('email')) {
      return 'email';
    }
    return 'username';
  }
  return 'off';
}

export function hubCredentialInputMode(
  fieldId: string,
  fieldType: 'text' | 'password',
): InputHTMLAttributes<HTMLInputElement>['inputMode'] | undefined {
  if (fieldType !== 'text') {
    return undefined;
  }
  const normalized = fieldId.toLowerCase();
  if (normalized === 'email' || normalized.includes('email')) {
    return 'email';
  }
  return undefined;
}

export function isHubCredentialPasswordField(fieldType: 'text' | 'password'): boolean {
  return fieldType === 'password';
}

/** Remove readOnly on first focus — password fields only. */
export function enableHubCredentialFieldOnFocus(
  event: FocusEvent<HTMLInputElement>,
): void {
  event.currentTarget.readOnly = false;
}

/** PM-ignore attributes — password fields only. */
export const HUB_CREDENTIAL_PASSWORD_PROPS: Record<string, string | boolean> = {
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-protonpass-ignore': 'true',
  'data-bwignore': 'true',
};

interface HubCredentialInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'autoComplete' | 'name' | 'readOnly'> {
  serviceId: string;
  fieldId: string;
  fieldType: 'text' | 'password';
}

/**
 * Email/username: browser autocomplete + prior values (standard tokens).
 * Other text: neutral (autocomplete off).
 * Password: readOnly-until-focus, PM-ignore, one-time-code — no PM prompts.
 */
export default function HubCredentialInput({
  serviceId,
  fieldId,
  fieldType,
  onFocus,
  ...rest
}: HubCredentialInputProps) {
  const isPassword = isHubCredentialPasswordField(fieldType);

  return (
    <input
      {...(isPassword ? HUB_CREDENTIAL_PASSWORD_PROPS : {})}
      {...rest}
      type={fieldType}
      name={hubCredentialFieldName(serviceId, fieldId, fieldType)}
      autoComplete={hubCredentialAutoComplete(fieldId, fieldType)}
      inputMode={hubCredentialInputMode(fieldId, fieldType)}
      spellCheck={isPassword ? false : undefined}
      {...(isPassword
        ? {
            autoCapitalize: 'off',
            autoCorrect: 'off',
            readOnly: true,
            onFocus: (event: FocusEvent<HTMLInputElement>) => {
              enableHubCredentialFieldOnFocus(event);
              onFocus?.(event);
            },
          }
        : { onFocus })}
    />
  );
}
