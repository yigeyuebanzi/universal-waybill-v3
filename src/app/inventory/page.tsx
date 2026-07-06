import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { inventoryItems, inventoryMovements } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const items = await db.select().from(inventoryItems).limit(100);
  const movements = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(20);
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">库存联动</h1>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">库存批次</h2>
        {items.map((item) => <div key={item.id} className="flex justify-between border-t py-2 text-sm first:border-t-0"><span>{item.skuCode} / {item.batchNo}</span><span>可用 {item.availableQty}，锁定 {item.lockedQty} <Badge>{item.status}</Badge></span></div>)}
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">库存流水</h2>
        {movements.map((m) => <div key={m.id} className="border-t py-2 text-sm first:border-t-0">{m.skuCode} {m.batchNo} {m.movementType} {m.quantity}</div>)}
      </Card>
    </AppShell>
  );
}
