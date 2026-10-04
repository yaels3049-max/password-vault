import type { UserApprovalState } from '../service/userApproval';

export { userApprovalState, type UserApprovalRow, type UserApprovalState } from '../service/userApproval';

export const USER_APPROVAL_HE: Record<UserApprovalState, string> = {
  approved: 'מאושר למשתמשים',
  not_approved: 'טרם אושר למשתמשים',
  blocked: 'חסום למשתמשים',
  no_mapping: 'אין מיפוי',
};
