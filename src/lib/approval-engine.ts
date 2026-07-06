import { db } from '@/lib/db';
import { approvalRules, users } from '@/lib/db/schema';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';

export async function resolveApprovalRule(amount: number) {
  const amountText = amount.toFixed(2);
  const [rule] = await db
    .select()
    .from(approvalRules)
    .where(
      and(
        eq(approvalRules.enabled, true),
        lte(approvalRules.minAmount, amountText),
        or(isNull(approvalRules.maxAmount), gte(approvalRules.maxAmount, amountText))
      )
    )
    .orderBy(asc(approvalRules.targetLevel))
    .limit(1);

  return {
    requiredLevel: rule?.targetLevel || (amount > 500 ? 2 : 1),
    timeoutHours: rule?.timeoutHours || 24,
    rule,
  };
}

export async function resolveLevelAssignment(level: number, timeoutHours = 24) {
  let [approver] = await db
    .select()
    .from(users)
    .where(and(eq(users.enabled, true), eq(users.role, level === 1 ? 'level1_approver' : 'level2_approver')))
    .limit(1);
  if (!approver) {
    [approver] = await db
      .select()
      .from(users)
      .where(and(eq(users.enabled, true), eq(users.role, 'admin')))
      .limit(1);
  }

  return {
    targetLevel: level,
    status: level === 1 ? 'level1_review' : 'level2_review',
    timeoutAt: new Date(Date.now() + timeoutHours * 60 * 60 * 1000),
    approverId: approver?.id,
  };
}

export async function resolveInitialApproval(amount: number, startLevel = 1, timeoutHoursOverride?: number) {
  const rule = await resolveApprovalRule(amount);
  const assignment = await resolveLevelAssignment(startLevel, timeoutHoursOverride ?? rule.timeoutHours);
  return {
    ...assignment,
    requiredLevel: rule.requiredLevel,
    rule,
  };
}
