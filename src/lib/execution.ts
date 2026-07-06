import { compensationRecords, exceptionTickets, inventoryItems, inventoryMovements, scanRecords } from '@/lib/db/schema';
import type { CompensationDirection } from '@/lib/types';
import { eq } from 'drizzle-orm';

export function compensationDirection(category: string): CompensationDirection {
  return category === 'quality_control' ? 'claim_supplier' : 'pay_customer';
}

type Transaction = Parameters<Parameters<typeof import('@/lib/db').db.transaction>[0]>[0];

export async function executeTicket(tx: Transaction, ticket: typeof exceptionTickets.$inferSelect, approvalRecordId: string) {
  const shouldCompensate = Number(ticket.amount || 0) > 0;
  if (shouldCompensate) {
    await tx.insert(compensationRecords).values({
      ticketId: ticket.id,
      approvalRecordId,
      direction: compensationDirection(ticket.category),
      amount: ticket.amount,
      status: 'recorded',
      reconciliationRef: `REC-${ticket.ticketNo}`,
    });
  }

  const [scan] = await tx.select().from(scanRecords).where(eq(scanRecords.ticketId, ticket.id)).limit(1);
  if (scan) {
    const [inventory] = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.skuCode, scan.skuCode))
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
        skuCode: scan.skuCode,
        batchNo: scan.batchNo,
        movementType: 'unlock_after_execution',
        quantity: 1,
        beforeQty: inventory.availableQty,
        afterQty: inventory.availableQty,
      });
    }
  }

  await tx
    .update(exceptionTickets)
    .set({ status: 'completed', updatedAt: new Date(), closedAt: new Date(), version: ticket.version + 1 })
    .where(eq(exceptionTickets.id, ticket.id));
}
