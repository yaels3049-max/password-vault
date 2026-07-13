import { isDevBuild } from '../dev/devMode';

/**
 * Digital Home password policy (Supabase Auth + local vault KDF — same secret).
 * Production: stronger minimum. Development: relaxed behind explicit dev flag (AC-109-31).
 * MFA / re-separation deferred to Phase 191 — not in this module.
 */
export interface AccountPasswordPolicy {
  minLength: number;
  requireLetter: boolean;
  requireDigit: boolean;
  /** True when using the temporary development policy */
  isDevelopmentPolicy: boolean;
}

export function getAccountPasswordPolicy(): AccountPasswordPolicy {
  if (isDevBuild()) {
    return {
      minLength: 6,
      requireLetter: false,
      requireDigit: false,
      isDevelopmentPolicy: true,
    };
  }
  return {
    minLength: 8,
    requireLetter: true,
    requireDigit: true,
    isDevelopmentPolicy: false,
  };
}

export function validateAccountPassword(password: string): string | null {
  const policy = getAccountPasswordPolicy();
  if (!password || password.length < policy.minLength) {
    return `הסיסמה חייבת להכיל לפחות ${policy.minLength} תווים.`;
  }
  if (policy.requireLetter && !/[A-Za-zא-ת]/.test(password)) {
    return 'הסיסמה חייבת להכיל לפחות אות אחת.';
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    return 'הסיסמה חייבת להכיל לפחות ספרה אחת.';
  }
  return null;
}
