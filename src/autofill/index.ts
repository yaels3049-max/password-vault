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
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  AUTOFILL_PROFILE_ERROR,
} from './validatedProfile';

export type {
  AutofillProfile,
  AutofillFieldMapping,
  AutofillSupportState,
  AutofillProfileAction,
  AutofillValidationEvidence,
  AutofillProfilePlan,
} from './validatedProfile';
