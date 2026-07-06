export const REVIEW_STATUSES = ['pending', 'level1_review', 'level2_review', 'resubmitted'] as const;
export const CLOSED_STATUSES = ['completed', 'closed', 'auto_rejected', 'fast_released'] as const;

export function isClosedStatus(status: string) {
  return CLOSED_STATUSES.includes(status as (typeof CLOSED_STATUSES)[number]);
}

export function approverRoleForLevel(level: number) {
  return level === 2 ? 'level2_approver' : 'level1_approver';
}
