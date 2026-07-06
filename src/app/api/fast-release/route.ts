import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets, inventoryItems, inventoryMovements, scanRecords } from '@/lib/db/schema';
import { canFastRelease, getActor } from '@/lib/auth-context';
import { CLOSED_STATUSES, isClosedStatus } from '@/lib/ticket-status';
import { and, eq, notInArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  ticketId: z.string().uuid(),
  actorId: z.string().uuid(),
  reason: z.string().min(3),
  idempotencyKey: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const actor = await getActor(input.actorId);
  if (!actor || !canFastRelease(actor.role)) return NextResponse.json({ error: '仅品控主管可快速放行' }, { status: 403 });
  const [ticket] = await db.select().from(exceptionTickets).where(eq(exceptionTickets.id, input.ticketId)).limit(1);
  if (!ticket || ticket.source !== 'scan_qc') return NextResponse.json({ error: '仅品控工单可快速放行' }, { status: 400 });
  if (isClosedStatus(ticket.status)) return NextResponse.json({ error: '工单已关闭，不可重复放行' }, { status: 409 });
  const idempotencyKey = input.idempotencyKey || `fast-release-${ticket.id}-${ticket.version}`;

  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(approvalRecords)
      .where(and(eq(approvalRecords.ticketId, ticket.id), eq(approvalRecords.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing.length) return { idempotent: true, record: existing[0] };

    const updated = await tx.update(exceptionTickets).set({
      status: 'fast_released',
      description: `${ticket.description}\n快速放行原因：${input.reason}`,
      closedAt: new Date(),
      updatedAt: new Date(),
      version: ticket.version + 1,
    }).where(and(
      eq(exceptionTickets.id, ticket.id),
      eq(exceptionTickets.version, ticket.version),
      notInArray(exceptionTickets.status, [...CLOSED_STATUSES])
    )).returning({ id: exceptionTickets.id });
    if (!updated.length) return { conflict: true as const };

    const [record] = await tx.insert(approvalRecords).values({
      ticketId: ticket.id,
      level: ticket.currentLevel,
      approverId: actor.id,
      action: 'fast_release',
      opinion: input.reason,
      idempotencyKey,
      fromStatus: ticket.status,
      toStatus: 'fast_released',
    }).returning();

    const scans = await tx.select().from(scanRecords).where(eq(scanRecords.ticketId, ticket.id));
    for (const scan of scans) {
      await tx.update(scanRecords).set({ qcStatus: 'released' }).where(eq(scanRecords.id, scan.id));
      const [inventory] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.skuCode, scan.skuCode), eq(inventoryItems.batchNo, scan.batchNo)))
        .limit(1);
      if (inventory) {
        const lockedQty = Math.max(0, inventory.lockedQty - 1);
        await tx.update(inventoryItems).set({
          lockedQty,
          status: inventory.lockedQty > 1 ? 'held' : 'available',
          updatedAt: new Date(),
        }).where(eq(inventoryItems.id, inventory.id));
        await tx.insert(inventoryMovements).values({
          ticketId: ticket.id,
          approvalRecordId: record.id,
          skuCode: scan.skuCode,
          batchNo: scan.batchNo,
          movementType: 'fast_release_unlock',
          quantity: 1,
          beforeQty: inventory.availableQty,
          afterQty: inventory.availableQty,
        });
      }
    }
    return { idempotent: false, record };
  });

  if ('conflict' in result) {
    return NextResponse.json({ error: '工单已被处理，请刷新' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, ...result });
}
