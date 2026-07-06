import { db } from '@/lib/db';
import { exceptionTickets, inventoryItems, scanRecords } from '@/lib/db/schema';
import { resolveApproval } from '@/lib/approval-engine';
import { getActor } from '@/lib/auth-context';
import { evaluateQc } from '@/lib/qc-engine';
import { fetchV2Order, validateV2Sku } from '@/lib/v2-client';
import { upsertSnapshot } from '@/lib/snapshots';
import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const scanSchema = z.object({
  externalCode: z.string().min(1),
  skuCode: z.string().min(1),
  batchNo: z.string().min(1),
  operatorId: z.string().uuid().optional(),
  deviceId: z.string().optional(),
  description: z.string().optional(),
  quantityDiffPercent: z.coerce.number().optional(),
  damageLevel: z.coerce.number().optional(),
  specDeviationPercent: z.coerce.number().optional(),
  labelMismatch: z.boolean().optional(),
  batchRisk: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = scanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const actor = await getActor(input.operatorId);
  if (!actor || !actor.enabled) return NextResponse.json({ error: 'Operator is disabled or missing' }, { status: 403 });

  await validateV2Sku(input.externalCode, input.skuCode);
  const order = await fetchV2Order(input.externalCode);
  const snapshot = await upsertSnapshot(order);
  const qc = await evaluateQc(input);

  if (qc.passed) {
    const [record] = await db.insert(scanRecords).values({
      scanNo: `S${Date.now()}`,
      externalCode: input.externalCode,
      skuCode: input.skuCode,
      batchNo: input.batchNo,
      operatorId: actor.id,
      deviceId: input.deviceId,
      qcResult: 'passed',
      qcStatus: 'passed',
      description: input.description,
      evidence: input,
    }).returning();
    return NextResponse.json({ result: 'passed', record }, { status: 201 });
  }

  const [existing] = await db
    .select()
    .from(scanRecords)
    .innerJoin(exceptionTickets, eq(scanRecords.ticketId, exceptionTickets.id))
    .where(
      and(
        eq(scanRecords.skuCode, input.skuCode),
        eq(scanRecords.batchNo, input.batchNo),
        eq(exceptionTickets.category, 'quality_control'),
        ne(exceptionTickets.status, 'completed'),
        ne(exceptionTickets.status, 'closed')
      )
    )
    .limit(1);

  if (existing?.exception_tickets) {
    const [record] = await db.insert(scanRecords).values({
      scanNo: `S${Date.now()}`,
      externalCode: input.externalCode,
      skuCode: input.skuCode,
      batchNo: input.batchNo,
      operatorId: actor.id,
      deviceId: input.deviceId,
      qcResult: 'failed',
      qcStatus: 'held',
      matchedRuleId: qc.rule?.id,
      ruleSnapshot: qc.rule,
      evidence: input,
      description: input.description,
      ticketId: existing.exception_tickets.id,
    }).returning();
    return NextResponse.json({ result: 'duplicate_held', message: '该批次已存在未关闭品控工单', record }, { status: 200 });
  }

  const approval = await resolveApproval(999999);
  const [ticket] = await db.transaction(async (tx) => {
    const [createdTicket] = await tx.insert(exceptionTickets).values({
      ticketNo: `Q${Date.now()}`,
      externalCode: input.externalCode,
      snapshotId: snapshot.id,
      source: 'scan_qc',
      category: 'quality_control',
      exceptionType: qc.rule?.subType || 'batch_exception',
      severity: qc.rule?.severity || 'high',
      amount: '0',
      description: input.description || qc.reason,
      status: approval.status,
      currentLevel: approval.targetLevel,
      reporterId: actor.id,
      assignedApproverId: approval.approverId,
      timeoutAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    }).returning();

    await tx.insert(scanRecords).values({
      scanNo: `S${Date.now()}`,
      externalCode: input.externalCode,
      skuCode: input.skuCode,
      batchNo: input.batchNo,
      operatorId: actor.id,
      deviceId: input.deviceId,
      qcResult: 'failed',
      qcStatus: 'held',
      matchedRuleId: qc.rule?.id,
      ruleSnapshot: qc.rule,
      evidence: input,
      description: input.description,
      ticketId: createdTicket.id,
    });

    const [inventory] = await tx
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.skuCode, input.skuCode), eq(inventoryItems.batchNo, input.batchNo)))
      .limit(1);

    if (inventory) {
      await tx
        .update(inventoryItems)
        .set({ lockedQty: inventory.lockedQty + 1, status: 'held', updatedAt: new Date() })
        .where(eq(inventoryItems.id, inventory.id));
    } else {
      await tx.insert(inventoryItems).values({
        skuCode: input.skuCode,
        skuName: input.skuCode,
        batchNo: input.batchNo,
        availableQty: 0,
        lockedQty: 1,
        status: 'held',
      });
    }

    return [createdTicket];
  });

  return NextResponse.json({ result: 'held', ticket }, { status: 201 });
}
