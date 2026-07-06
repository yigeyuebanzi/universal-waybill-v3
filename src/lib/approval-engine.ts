import { db } from '@/lib/db';
import { approvalRules, users } from '@/lib/db/schema';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';

export async function resolveApproval(amount: number) {
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

  const targetLevel = rule?.targetLevel || (amount > 500 ? 2 : 1);
  const timeoutHours = rule?.timeoutHours || 24;
  const [approver] = await db
    .select()
    .from(users)
    .where(eq(users.role, targetLevel === 1 ? 'level1_approver' : 'level2_approver'))
    .limit(1);

  return {
    targetLevel,
    status: targetLevel === 1 ? 'level1_review' : 'level2_review',
    timeoutAt: new Date(Date.now() + timeoutHours * 60 * 60 * 1000),
    approverId: approver?.id,
  };
}
