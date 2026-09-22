export {
  parseAutofillProfile,
  serializeAutofillProfile,
  validateAutofillProfileStructural,
  planAutofillProfileWrite,
  mergeAutofillProfileMetadata,
  isManagedAutofillEligible,
  isVersionMatchedValidated,
  readAutofillProfileFromMetadata,
  originFromHttpsLoginEntry,
  AUTOFILL_PROFILE_META_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
  MANAGED_READINESS_OK_SUMMARY,
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  AUTOFILL_PROFILE_ERROR,
} from './validatedProfile';

export {
  runManagedReadinessProbe,
  formatManagedReadinessFailureHe,
  ADMIN_MANAGED_READINESS_PROBE_MESSAGE,
} from './managedReadinessProbe';

export type {
  AutofillProfile,
  AutofillFieldMapping,
  AutofillSupportState,
  AutofillProfileAction,
  AutofillValidationEvidence,
  AutofillProfilePlan,
} from './validatedProfile';

export type { ManagedReadinessProbeResult } from './managedReadinessProbe';
