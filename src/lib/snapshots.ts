import { db } from '@/lib/db';
import { waybillSnapshots } from '@/lib/db/schema';
import type { V2OrderDetail } from '@/lib/types';
import { eq } from 'drizzle-orm';

export async function upsertSnapshot(order: V2OrderDetail) {
  const values = {
    externalCode: order.externalCode,
    v2OrderId: order.orderId,
    storeName: order.storeName,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    receiverAddress: order.receiverAddress,
    amount: order.amount,
    itemsJson: order.items,
    source: 'v2_realtime',
    syncedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(waybillSnapshots)
    .where(eq(waybillSnapshots.externalCode, order.externalCode))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(waybillSnapshots)
      .set(values)
      .where(eq(waybillSnapshots.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(waybillSnapshots).values(values).returning();
  return created;
}
