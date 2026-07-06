import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets, users } from '@/lib/db/schema';
import { approverRoleForLevel, REVIEW_STATUSES } from '@/lib/ticket-status';
import { and, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const disabledAssigned = await db
    .select({ ticket: exceptionTickets, approver: users })
    .from(exceptionTickets)
    .innerJoin(users, eq(exceptionTickets.assignedApproverId, users.id))
    .where(and(eq(users.enabled, false), inArray(exceptionTickets.status, [...REVIEW_STATUSES])))
    .limit(50);

  let reassigned = 0;
  for (const row of disabledAssigned) {
    const ticket = row.ticket;
    let [replacement] = await db
      .select()
      .from(users)
      .where(and(eq(users.enabled, true), eq(users.role, approverRoleForLevel(ticket.currentLevel))))
      .limit(1);
    if (!replacement) {
      [replacement] = await db
        .select()
        .from(users)
        .where(and(eq(users.enabled, true), eq(users.role, 'admin')))
        .limit(1);
    }
    if (!replacement) continue;

    await db.transaction(async (tx) => {
      const updated = await tx.update(exceptionTickets).set({
        assignedApproverId: replacement.id,
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(and(
        eq(exceptionTickets.id, ticket.id),
        eq(exceptionTickets.version, ticket.version),
        inArray(exceptionTickets.status, [...REVIEW_STATUSES])
      )).returning({ id: exceptionTickets.id });
      if (!updated.length) return;

      await tx.insert(approvalRecords).values({
        ticketId: ticket.id,
        level: ticket.currentLevel,
        approverId: replacement.id,
        action: 'reassign_disabled_approver',
        opinion: `原审批人账号禁用，自动转交给 ${replacement.name}`,
        idempotencyKey: `reassign-disabled-${ticket.id}-${ticket.version}`,
        fromStatus: ticket.status,
        toStatus: ticket.status,
      }).onConflictDoNothing();
      reassigned++;
    });
  }

  const overdueQcHolds = await db
    .select()
    .from(exceptionTickets)
    .where(
      and(
        eq(exceptionTickets.category, 'quality_control'),
        isNotNull(exceptionTickets.qcHoldTimeoutAt),
        lt(exceptionTickets.qcHoldTimeoutAt, new Date()),
        eq(exceptionTickets.status, 'level1_review')
      )
    )
    .limit(50);

  let qcEscalated = 0;
  for (const ticket of overdueQcHolds) {
    await db.transaction(async (tx) => {
      let [replacement] = await tx
        .select()
        .from(users)
        .where(and(eq(users.enabled, true), eq(users.role, 'level2_approver')))
        .limit(1);
      if (!replacement) {
        [replacement] = await tx
          .select()
          .from(users)
          .where(and(eq(users.enabled, true), eq(users.role, 'admin')))
          .limit(1);
      }

      const updated = await tx.update(exceptionTickets).set({
        status: 'level2_review',
        currentLevel: 2,
        assignedApproverId: replacement?.id,
        qcHoldTimeoutAt: null,
        timeoutAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(and(
        eq(exceptionTickets.id, ticket.id),
        eq(exceptionTickets.version, ticket.version),
        eq(exceptionTickets.status, 'level1_review')
      )).returning({ id: exceptionTickets.id });
      if (!updated.length) return;

      await tx.insert(approvalRecords).values({
        ticketId: ticket.id,
        level: ticket.currentLevel,
        action: 'qc_hold_timeout_escalate',
        opinion: '品控暂扣超过 2 小时，自动强制升级二级审批',
        idempotencyKey: `qc-hold-timeout-${ticket.id}-${ticket.version}`,
        fromStatus: ticket.status,
        toStatus: 'level2_review',
      }).onConflictDoNothing();
      qcEscalated++;
    });
  }

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
      let replacement: typeof users.$inferSelect | undefined;
      if (ticket.currentLevel < 2) {
        [replacement] = await tx
          .select()
          .from(users)
          .where(and(eq(users.enabled, true), eq(users.role, 'level2_approver')))
          .limit(1);
        if (!replacement) {
          [replacement] = await tx
            .select()
            .from(users)
            .where(and(eq(users.enabled, true), eq(users.role, 'admin')))
            .limit(1);
        }
      }
      const updated = await tx.update(exceptionTickets).set({
        status: nextStatus,
        currentLevel: ticket.currentLevel < 2 ? 2 : ticket.currentLevel,
        assignedApproverId: ticket.currentLevel < 2 ? replacement?.id : ticket.assignedApproverId,
        timeoutAt: ticket.currentLevel < 2 ? new Date(Date.now() + 24 * 60 * 60 * 1000) : ticket.timeoutAt,
        closedAt: nextStatus === 'auto_rejected' ? new Date() : ticket.closedAt,
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(and(
        eq(exceptionTickets.id, ticket.id),
        eq(exceptionTickets.version, ticket.version),
        inArray(exceptionTickets.status, [...REVIEW_STATUSES])
      )).returning({ id: exceptionTickets.id });
      if (!updated.length) return;

      await tx.insert(approvalRecords).values({
        ticketId: ticket.id,
        level: ticket.currentLevel,
        action: 'timeout',
        opinion: ticket.currentLevel < 2 ? '超时自动升级二级审批' : '二级审批超时自动驳回',
        idempotencyKey: `timeout-${ticket.id}-${ticket.version}`,
        fromStatus: ticket.status,
        toStatus: nextStatus,
      }).onConflictDoNothing();
      changed++;
    });
  }

  return NextResponse.json({ changed, reassigned, qcEscalated });
}
