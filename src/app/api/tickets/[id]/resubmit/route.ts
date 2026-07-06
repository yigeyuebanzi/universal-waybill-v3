import { getActor } from '@/lib/auth-context';
import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets } from '@/lib/db/schema';
import { resolveApproval } from '@/lib/approval-engine';
import { fetchV2Order } from '@/lib/v2-client';
import { upsertSnapshot } from '@/lib/snapshots';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  actorId: z.string().uuid().optional(),
  description: z.string().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().min(8),
  expectedVersion: z.coerce.number(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const actor = await getActor(input.actorId);
  if (!actor || !actor.enabled) return NextResponse.json({ error: '上报人不存在或已禁用' }, { status: 403 });

  const [ticket] = await db.select().from(exceptionTickets).where(eq(exceptionTickets.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: '工单不存在' }, { status: 404 });
  if (ticket.reporterId !== actor.id && actor.role !== 'admin') return NextResponse.json({ error: '仅原上报人或管理员可重提' }, { status: 403 });
  if (ticket.status !== 'rejected') return NextResponse.json({ error: '仅已拒绝工单可重提' }, { status: 409 });
  if (ticket.resubmitCount > ticket.maxResubmitCount) return NextResponse.json({ error: '已超过重提次数上限' }, { status: 409 });
  if (ticket.version !== input.expectedVersion) return NextResponse.json({ error: '该工单已被处理，请刷新' }, { status: 409 });

  const existing = await db
    .select()
    .from(approvalRecords)
    .where(and(eq(approvalRecords.ticketId, ticket.id), eq(approvalRecords.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing.length) return NextResponse.json({ data: existing[0], idempotent: true });

  let snapshot;
  try {
    const order = await fetchV2Order(ticket.externalCode);
    snapshot = await upsertSnapshot(order);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'V2 实时校验失败，请稍后重试',
    }, { status: 502 });
  }
  const amount = input.amount ?? Number(ticket.amount || 0);
  const approval = await resolveApproval(amount);

  const result = await db.transaction(async (tx) => {
    const updated = await tx.update(exceptionTickets).set({
      snapshotId: snapshot.id,
      amount: amount.toFixed(2),
      description: input.description || ticket.description,
      status: approval.status,
      currentLevel: approval.targetLevel,
      assignedApproverId: approval.approverId,
      timeoutAt: approval.timeoutAt,
      updatedAt: new Date(),
      version: ticket.version + 1,
    }).where(and(eq(exceptionTickets.id, ticket.id), eq(exceptionTickets.version, input.expectedVersion)))
      .returning();

    if (!updated.length) throw new Error('该工单已被处理，请刷新');

    const [record] = await tx.insert(approvalRecords).values({
      ticketId: ticket.id,
      level: ticket.currentLevel,
      approverId: actor.id,
      action: 'resubmit',
      opinion: input.description || '重新提交',
      idempotencyKey: input.idempotencyKey,
      fromStatus: ticket.status,
      toStatus: approval.status,
    }).returning();

    return { ticket: updated[0], record };
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
