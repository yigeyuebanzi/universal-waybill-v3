import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets } from '@/lib/db/schema';
import { canApprove, getActor } from '@/lib/auth-context';
import { executeTicket } from '@/lib/execution';
import { REVIEW_STATUSES, isClosedStatus } from '@/lib/ticket-status';
import { eq, and, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const approvalSchema = z.object({
  ticketId: z.string().uuid(),
  actorId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  opinion: z.string().min(1),
  expectedVersion: z.coerce.number(),
  idempotencyKey: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = approvalSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const actor = await getActor(input.actorId);
  if (!actor || !actor.enabled) return NextResponse.json({ error: '审批人不存在或已禁用' }, { status: 403 });

  const [ticket] = await db.select().from(exceptionTickets).where(eq(exceptionTickets.id, input.ticketId)).limit(1);
  if (!ticket) return NextResponse.json({ error: '工单不存在' }, { status: 404 });
  if (isClosedStatus(ticket.status) || !REVIEW_STATUSES.includes(ticket.status as (typeof REVIEW_STATUSES)[number])) {
    return NextResponse.json({ error: '当前工单状态不可审批，请刷新' }, { status: 409 });
  }
  if (ticket.reporterId === actor.id) return NextResponse.json({ error: '上报人不能审批自己的工单' }, { status: 403 });
  if (!canApprove(actor.role, ticket.currentLevel)) return NextResponse.json({ error: '无当前审批层级权限' }, { status: 403 });
  if (ticket.version !== input.expectedVersion) return NextResponse.json({ error: '该工单已被处理，请刷新' }, { status: 409 });

  const existing = await db
    .select()
    .from(approvalRecords)
    .where(and(eq(approvalRecords.ticketId, ticket.id), eq(approvalRecords.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing.length) return NextResponse.json({ data: existing[0], idempotent: true });

  const result = await db.transaction(async (tx) => {
    const toStatus = input.action === 'reject' ? 'rejected' : 'executing';
    const [record] = await tx.insert(approvalRecords).values({
      ticketId: ticket.id,
      level: ticket.currentLevel,
      approverId: actor.id,
      action: input.action,
      opinion: input.opinion,
      idempotencyKey: input.idempotencyKey,
      fromStatus: ticket.status,
      toStatus,
    }).returning();

    if (input.action === 'reject') {
      const nextResubmitCount = ticket.resubmitCount + 1;
      const toStatusAfterReject = nextResubmitCount > ticket.maxResubmitCount ? 'auto_rejected' : 'rejected';
      const updated = await tx.update(exceptionTickets).set({
        status: toStatusAfterReject,
        resubmitCount: nextResubmitCount,
        closedAt: toStatusAfterReject === 'auto_rejected' ? new Date() : null,
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(and(
        eq(exceptionTickets.id, ticket.id),
        eq(exceptionTickets.version, input.expectedVersion),
        inArray(exceptionTickets.status, [...REVIEW_STATUSES])
      )).returning({ id: exceptionTickets.id });
      if (!updated.length) throw new Error('该工单已被处理，请刷新');

      await tx.update(approvalRecords).set({ toStatus: toStatusAfterReject }).where(eq(approvalRecords.id, record.id));
    } else {
      const updated = await tx.update(exceptionTickets).set({
        status: 'executing',
        updatedAt: new Date(),
        version: ticket.version + 1,
      }).where(and(
        eq(exceptionTickets.id, ticket.id),
        eq(exceptionTickets.version, input.expectedVersion),
        inArray(exceptionTickets.status, [...REVIEW_STATUSES])
      )).returning({ id: exceptionTickets.id });
      if (!updated.length) throw new Error('该工单已被处理，请刷新');
      await executeTicket(tx, ticket, record.id);
    }

    return record;
  }).catch((error) => {
    if (error instanceof Error && error.message.includes('该工单已被处理')) {
      return { conflict: true as const };
    }
    throw error;
  });

  if ('conflict' in result) {
    return NextResponse.json({ error: '该工单已被处理，请刷新' }, { status: 409 });
  }

  return NextResponse.json({ data: result });
}
