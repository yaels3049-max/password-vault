import type { ReactNode } from 'react';
import { IconBlock, IconCheckCircle, IconClock, IconMinusCircle } from './adminIcons';
import { USER_APPROVAL_HE, userApprovalState, type UserApprovalRow, type UserApprovalState } from './userApproval';

const ICONS: Record<UserApprovalState, ReactNode> = {
  approved: <IconCheckCircle size={16} />,
  not_approved: <IconClock size={16} />,
  blocked: <IconBlock size={16} />,
  no_mapping: <IconMinusCircle size={16} />,
};

/** Phase 122.8 R3 — the same pill on the workspace header (`size="lg"`) and on every catalog card. */
export default function UserApprovalBadge({ row, size = 'sm' }: { row: UserApprovalRow; size?: 'sm' | 'lg' }) {
  const state = userApprovalState(row);
  return (
    <span
      className={`admin-approval-pill admin-approval-pill--${state} admin-approval-pill--${size}`}
      data-approval={state}
      title={USER_APPROVAL_HE[state]}
    >
      {ICONS[state]}
      <span>{USER_APPROVAL_HE[state]}</span>
    </span>
  );
}
