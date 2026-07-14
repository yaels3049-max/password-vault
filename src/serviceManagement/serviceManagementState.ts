import { hasCompleteCredentials, type Credential } from '../credentials';
import { getDefaultProfile, type AccessProfile } from '../profile/accessProfileModel';
import { profilesForService } from '../profile/profileResolution';
import { getLoginFields, type Service } from '../mockServices';

export type ServiceManagementState =
  | 'not_added'
  | 'added'
  | 'missing_credentials'
  | 'multiple_profiles';

export interface ServiceManagementContext {
  selectedIds: Set<string>;
  accessProfiles: AccessProfile[];
  credentials: Record<string, Credential>;
}

/**
 * Derived (never stored) management state per D-104-7 / AC-113-31:
 *   not_added → not in selectedIds
 *   missing_credentials → selected, default/primary credential incomplete
 *   added → selected with complete credentials (single or multi-profile)
 * Multi-profile alone is never an attention state (AC-113-31 / D-113-18).
 * Badges are informational only — they never block Open (execution handles missing creds).
 */
export function deriveServiceManagementState(
  service: Service,
  context: ServiceManagementContext,
): ServiceManagementState {
  if (!context.selectedIds.has(service.id)) {
    return 'not_added';
  }

  const profiles = profilesForService(context.accessProfiles, service.id);
  const defaultProfile =
    getDefaultProfile(context.accessProfiles, service.id) ?? profiles[0];
  const credential = defaultProfile
    ? context.credentials[defaultProfile.id]
    : undefined;

  if (!hasCompleteCredentials(credential, getLoginFields(service))) {
    return 'missing_credentials';
  }

  return 'added';
}

const BADGE_LABELS: Record<ServiceManagementState, string> = {
  not_added: 'לא נוסף',
  added: 'מוכן לשימוש',
  missing_credentials: 'חסרים פרטי כניסה',
  /** Kept for type compat; no longer emitted as attention (AC-113-31). */
  multiple_profiles: 'מספר פרופילים',
};

export function serviceManagementBadgeLabel(state: ServiceManagementState): string {
  return BADGE_LABELS[state];
}
