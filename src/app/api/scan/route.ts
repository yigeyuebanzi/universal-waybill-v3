import { db } from '@/lib/db';
import { exceptionTickets, inventoryItems, scanRecords } from '@/lib/db/schema';
import { resolveInitialApproval } from '@/lib/approval-engine';
import { getActor } from '@/lib/auth-context';
import { evaluateQc } from '@/lib/qc-engine';
import { fetchV2Order, validateV2Sku } from '@/lib/v2-client';
import { upsertSnapshot } from '@/lib/snapshots';
import { CLOSED_STATUSES } from '@/lib/ticket-status';
import { and, eq, notInArray, sql } from 'drizzle-orm';
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

  let snapshot;
  try {
    await validateV2Sku(input.externalCode, input.skuCode);
    const order = await fetchV2Order(input.externalCode);
    snapshot = await upsertSnapshot(order);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'V2 SKU 实时校验失败，请稍后重试',
    }, { status: 502 });
  }
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

  const approval = await resolveInitialApproval(999999, qc.rule?.targetApprovalLevel || 2);
  const qcHoldTimeoutAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const result = await db.transaction(async (tx) => {
    await tx.insert(inventoryItems).values({
      skuCode: input.skuCode,
      skuName: input.skuCode,
      batchNo: input.batchNo,
      availableQty: 0,
      lockedQty: 0,
      status: 'available',
    }).onConflictDoNothing();

    await tx.execute(sql`
      select id from ${inventoryItems}
      where ${inventoryItems.skuCode} = ${input.skuCode}
        and ${inventoryItems.batchNo} = ${input.batchNo}
      for update
    `);

    const [existing] = await tx
      .select()
      .from(scanRecords)
      .innerJoin(exceptionTickets, eq(scanRecords.ticketId, exceptionTickets.id))
      .where(
        and(
          eq(scanRecords.skuCode, input.skuCode),
          eq(scanRecords.batchNo, input.batchNo),
          eq(exceptionTickets.category, 'quality_control'),
          notInArray(exceptionTickets.status, [...CLOSED_STATUSES])
        )
      )
      .limit(1);

    if (existing?.exception_tickets) {
      const [record] = await tx.insert(scanRecords).values({
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
      return { result: 'duplicate_held' as const, record };
    }

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
      qcHoldTimeoutAt,
      timeoutAt: approval.timeoutAt,
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

    await tx
      .update(inventoryItems)
      .set({ lockedQty: (inventory?.lockedQty || 0) + 1, status: 'held', updatedAt: new Date() })
      .where(eq(inventoryItems.id, inventory.id));

    return { result: 'held' as const, ticket: createdTicket };
  });

  if (result.result === 'duplicate_held') {
    return NextResponse.json({ result: result.result, message: '该批次已存在未关闭品控工单', record: result.record }, { status: 200 });
  }

  return NextResponse.json({ result: 'held', ticket: result.ticket }, { status: 201 });
}
