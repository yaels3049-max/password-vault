/**
 * AC-112-26 / D-112-23 — explicit Hebrew user statuses for medium attempts.
 * Technical reasons stay in diagnostic logs only; never credentials / stacks in UI.
 */

export type MediumUserStatusCategory =
  | 'login_form_not_detected'
  | 'first_field_not_detected'
  | 'no_credentials_for_profile'
  | 'website_not_supported'
  | 'blocked_by_website'
  | 'system_error'
  | 'success_step1';

/** User-facing Hebrew only (one status per attempt). */
export const AC112_26_HEBREW: Record<MediumUserStatusCategory, string> = {
  login_form_not_detected:
    'פתחנו את האתר, אך לא זיהינו את מסך ההתחברות. ניתן להמשיך ידנית.',
  first_field_not_detected:
    'פתחנו את האתר, אך לא זיהינו את שדה ההתחברות הראשון למילוי. ניתן להמשיך ידנית.',
  no_credentials_for_profile:
    'נבחר פרופיל, אך אין פרטי זהות לשלב הראשון עבור אתר זה. הוסיפו אימייל/שם משתמש בפרופיל הפעיל.',
  website_not_supported:
    'האתר אינו ברשימת התמיכה למילוי חכם דו-שלבי כרגע. האתר נפתח — ניתן להמשיך ידנית.',
  blocked_by_website:
    'האתר חסם או הגביל את המילוי האוטומטי. האתר נפתח — ניתן להמשיך ידנית.',
  system_error:
    'אירעה תקלה במערכת המילוי. האתר נפתח — ניתן להמשיך ידנית.',
  success_step1:
    'מילאנו את שדה הזהות בשלב הראשון. לחצו «המשך» / Continue בעצמכם — לא נלחץ עבורכם.',
};

/** Diagnostic codes (logs / evidence) — D-112-24 failure taxonomy. */
export type MediumFailureClass =
  | 'login_interface_not_detected'
  | 'field_not_detected'
  | 'profile_not_resolved'
  | 'credential_not_available'
  | 'browser_permission_missing'
  | 'script_not_injected'
  | 'website_security_restriction'
  | 'unsupported_login_flow'
  | 'unhandled_implementation_defect';

export interface MappedMediumOutcome {
  category: MediumUserStatusCategory;
  userMessage: string;
  failureClass: MediumFailureClass | null;
  success: boolean;
}

/**
 * Map Hub/extension outcome → exactly one AC-112-26 status (M10).
 */
export function mapMediumOutcomeToUserStatus(input: {
  ok?: boolean | null;
  reason?: string | null;
  filled?: number | null;
  extensionMissing?: boolean;
  unsupportedSite?: boolean;
  noIdentityCredential?: boolean;
  profileMissing?: boolean;
}): MappedMediumOutcome {
  if (input.profileMissing) {
    return {
      category: 'no_credentials_for_profile',
      userMessage: AC112_26_HEBREW.no_credentials_for_profile,
      failureClass: 'profile_not_resolved',
      success: false,
    };
  }

  if (input.noIdentityCredential) {
    return {
      category: 'no_credentials_for_profile',
      userMessage: AC112_26_HEBREW.no_credentials_for_profile,
      failureClass: 'credential_not_available',
      success: false,
    };
  }

  if (input.unsupportedSite) {
    return {
      category: 'website_not_supported',
      userMessage: AC112_26_HEBREW.website_not_supported,
      failureClass: 'unsupported_login_flow',
      success: false,
    };
  }

  if (input.extensionMissing) {
    return {
      category: 'system_error',
      userMessage: AC112_26_HEBREW.system_error,
      failureClass: 'browser_permission_missing',
      success: false,
    };
  }

  if (input.ok === true && (input.filled ?? 0) >= 1) {
    return {
      category: 'success_step1',
      userMessage: AC112_26_HEBREW.success_step1,
      failureClass: null,
      success: true,
    };
  }

  const reason = (input.reason || '').trim();

  if (
    reason === 'identity_step_not_found' ||
    reason === 'form_not_found' ||
    reason === 'no_result'
  ) {
    return {
      category: 'login_form_not_detected',
      userMessage: AC112_26_HEBREW.login_form_not_detected,
      failureClass: 'login_interface_not_detected',
      success: false,
    };
  }

  if (
    reason === 'identity_mapping_failed' ||
    reason === 'no_identity_mapping' ||
    reason === 'no_identity_fields' ||
    reason === 'identity_fill_failed' ||
    reason === 'low_confidence' ||
    reason === 'ambiguous_mapping'
  ) {
    return {
      category: 'first_field_not_detected',
      userMessage: AC112_26_HEBREW.first_field_not_detected,
      failureClass: 'field_not_detected',
      success: false,
    };
  }

  if (
    reason === 'bot_interstitial' ||
    reason === 'website_security_restriction' ||
    /blocked|security|csp|frame/i.test(reason)
  ) {
    return {
      category: 'blocked_by_website',
      userMessage: AC112_26_HEBREW.blocked_by_website,
      failureClass: 'website_security_restriction',
      success: false,
    };
  }

  if (
    reason === 'url_not_allowed' ||
    reason === 'unsupported_login_flow' ||
    reason === 'not_supported'
  ) {
    return {
      category: 'website_not_supported',
      userMessage: AC112_26_HEBREW.website_not_supported,
      failureClass: 'unsupported_login_flow',
      success: false,
    };
  }

  if (
    reason === 'script_injection_failed' ||
    reason === 'identity_first_function_missing' ||
    reason === 'autofill_function_missing' ||
    reason === 'engine_unavailable'
  ) {
    return {
      category: 'system_error',
      userMessage: AC112_26_HEBREW.system_error,
      failureClass: 'script_not_injected',
      success: false,
    };
  }

  if (
    reason === 'tab_load_timeout' ||
    reason === 'operation_timeout' ||
    reason === 'tab_load_error' ||
    reason === 'no_tab' ||
    reason === 'missing_vault_payload' ||
    reason === 'missing_credentials_or_fields'
  ) {
    return {
      category: 'system_error',
      userMessage: AC112_26_HEBREW.system_error,
      failureClass: 'unhandled_implementation_defect',
      success: false,
    };
  }

  // Null extension response / unknown reason → system error (never silent)
  return {
    category: 'system_error',
    userMessage: AC112_26_HEBREW.system_error,
    failureClass: 'unhandled_implementation_defect',
    success: false,
  };
}
