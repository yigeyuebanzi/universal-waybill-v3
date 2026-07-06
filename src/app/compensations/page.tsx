import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { compensationRecords } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export default async function CompensationsPage() {
  const records = await db.select().from(compensationRecords).limit(100);
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">赔付记录</h1>
      <Card className="mt-4">
        {records.map((record) => <div key={record.id} className="flex justify-between border-t py-2 text-sm first:border-t-0"><span>{record.reconciliationRef}</span><span><Badge>{record.direction === 'claim_supplier' ? '供应商追偿' : '赔付客户'}</Badge> {record.amount}</span></div>)}
      </Card>
    </AppShell>
  );
}
