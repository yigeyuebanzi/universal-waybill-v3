import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets } from '@/lib/db/schema';
import { and, eq, lt, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const overdue = await db
    .select()
    .from(exceptionTickets)
    .where(
      and(
        lt(exceptionTickets.timeoutAt, new Date()),
        or(eq(exceptionTickets.status, 'pending'), eq(exceptionTickets.status, 'level1_review'), eq(exceptionTickets.status, 'level2_review'))
      )
    )
    .limit(50);

  let changed = 0;
  for (const ticket of overdue) {
    const nextStatus = ticket.currentLevel < 2 ? 'level2_review' : 'auto_rejected';
    await db.transaction(async (tx) => {
      await tx.insert(approvalRecords).values({
        ticketId: ticket.id,
        level: ticket.currentLevel,
        action: 'timeout',
        opinion: ticket.currentLevel < 2 ? '超时自动升级二级审批' : '二级审批超时自动驳回',
        idempotencyKey: `timeout-${ticket.id}-${ticket.version}`,
        fromStatus: ticket.status,
        toStatus: nextStatus,
      }).onConflictDoNothing();

      await tx.update(exceptionTickets).set({
        status: nextStatus,
        currentLevel: ticket.currentLevel < 2 ? 2 : ticket.currentLevel,
        timeoutAt: ticket.currentLevel < 2 ? new Date(Date.now() + 24 * 60 * 60 * 1000) : ticket.timeoutAt,
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(eq(exceptionTickets.id, ticket.id));
    });
    changed++;
  }

  return NextResponse.json({ changed });
}
