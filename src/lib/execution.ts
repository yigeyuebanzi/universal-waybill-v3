import { compensationRecords, exceptionTickets, inventoryItems, inventoryMovements, scanRecords } from '@/lib/db/schema';
import type { CompensationDirection } from '@/lib/types';
import { eq } from 'drizzle-orm';

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
  return 'exception_execution';
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
        movementType: movementTypeForTicket(ticket),
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
