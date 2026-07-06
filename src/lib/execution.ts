import { compensationRecords, exceptionTickets, inventoryItems, inventoryMovements, scanRecords, waybillSnapshots } from '@/lib/db/schema';
import type { CompensationDirection } from '@/lib/types';
import { and, eq } from 'drizzle-orm';

export function compensationDirection(category: string): CompensationDirection {
  return category === 'quality_control' ? 'claim_supplier' : 'pay_customer';
}

type Transaction = Parameters<Parameters<typeof import('@/lib/db').db.transaction>[0]>[0];

function shouldCreateCompensation(ticket: typeof exceptionTickets.$inferSelect) {
  if (ticket.category === 'quality_control') return true;
  return ['lost', 'damage', 'timeout'].includes(ticket.exceptionType) && Number(ticket.amount || 0) > 0;
}

function movementTypeForTicket(ticket: typeof exceptionTickets.$inferSelect) {
  if (ticket.category === 'quality_control') return 'unlock_after_qc_execution';
  if (ticket.exceptionType === 'rejected') return 'return_to_stock';
  if (ticket.exceptionType === 'address_error') return 'reship_address_fix';
  if (ticket.exceptionType === 'lost') return 'reship_after_lost';
  if (ticket.exceptionType === 'damage') return 'return_or_reship_after_damage';
  return 'exception_execution';
}

function movementDirection(type: string) {
  if (type === 'return_to_stock') return 'increase';
  return 'decrease';
}

function snapshotItems(snapshot: typeof waybillSnapshots.$inferSelect | undefined) {
  const raw = snapshot?.itemsJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const skuCode = String(record.skuCode || '').trim();
      const skuName = String(record.skuName || skuCode || '未知商品');
      const quantity = Math.max(1, Math.round(Number(record.skuQuantity || 1) || 1));
      if (!skuCode) return null;
      return { skuCode, skuName, quantity };
    })
    .filter((item): item is { skuCode: string; skuName: string; quantity: number } => Boolean(item));
}

export async function executeTicket(tx: Transaction, ticket: typeof exceptionTickets.$inferSelect, approvalRecordId: string) {
  const shouldCompensate = shouldCreateCompensation(ticket);
  if (shouldCompensate) {
    await tx.insert(compensationRecords).values({
      ticketId: ticket.id,
      approvalRecordId,
      direction: compensationDirection(ticket.category),
      amount: ticket.category === 'quality_control' && Number(ticket.amount || 0) === 0 ? '0.00' : ticket.amount,
      status: 'recorded',
      reconciliationRef: `REC-${ticket.ticketNo}`,
    });
  }

  if (ticket.category === 'quality_control') {
    const scans = await tx.select().from(scanRecords).where(eq(scanRecords.ticketId, ticket.id));
    await tx.update(scanRecords).set({ qcStatus: 'released' }).where(eq(scanRecords.ticketId, ticket.id));

    const batches = new Map<string, { skuCode: string; batchNo: string }>();
    for (const scan of scans) {
      batches.set(`${scan.skuCode}\u0000${scan.batchNo}`, { skuCode: scan.skuCode, batchNo: scan.batchNo });
    }

    for (const batch of batches.values()) {
      const [inventory] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.skuCode, batch.skuCode), eq(inventoryItems.batchNo, batch.batchNo)))
        .limit(1);

      if (inventory) {
        const unlocked = Math.max(0, inventory.lockedQty - 1);
        await tx
          .update(inventoryItems)
          .set({ lockedQty: unlocked, status: unlocked > 0 ? 'held' : 'available', updatedAt: new Date() })
          .where(eq(inventoryItems.id, inventory.id));
        await tx.insert(inventoryMovements).values({
          ticketId: ticket.id,
          approvalRecordId,
          skuCode: batch.skuCode,
          batchNo: batch.batchNo,
          movementType: movementTypeForTicket(ticket),
          quantity: 1,
          beforeQty: inventory.availableQty,
          afterQty: inventory.availableQty,
        });
      }
    }
  } else if (['lost', 'damage', 'rejected', 'address_error'].includes(ticket.exceptionType)) {
    const [snapshot] = ticket.snapshotId
      ? await tx.select().from(waybillSnapshots).where(eq(waybillSnapshots.id, ticket.snapshotId)).limit(1)
      : [];
    const movementType = movementTypeForTicket(ticket);
    const direction = movementDirection(movementType);

    for (const item of snapshotItems(snapshot)) {
      const batchNo = `V2-${ticket.externalCode}`;
      const [inventory] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.skuCode, item.skuCode), eq(inventoryItems.batchNo, batchNo)))
        .limit(1);
      const beforeQty = inventory?.availableQty || 0;
      const afterQty = direction === 'increase'
        ? beforeQty + item.quantity
        : Math.max(0, beforeQty - item.quantity);

      if (inventory) {
        await tx
          .update(inventoryItems)
          .set({ availableQty: afterQty, updatedAt: new Date() })
          .where(eq(inventoryItems.id, inventory.id));
      } else {
        await tx.insert(inventoryItems).values({
          skuCode: item.skuCode,
          skuName: item.skuName,
          batchNo,
          availableQty: afterQty,
          lockedQty: 0,
          status: 'available',
        });
      }

      await tx.insert(inventoryMovements).values({
        ticketId: ticket.id,
        approvalRecordId,
        skuCode: item.skuCode,
        batchNo,
        movementType,
        quantity: item.quantity,
        beforeQty,
        afterQty,
      });
    }
  }

  await tx
    .update(exceptionTickets)
    .set({ status: 'completed', updatedAt: new Date(), closedAt: new Date(), version: ticket.version + 1 })
    .where(eq(exceptionTickets.id, ticket.id));
}
