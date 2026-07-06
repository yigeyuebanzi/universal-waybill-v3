import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { exceptionTickets } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const tickets = await db.select().from(exceptionTickets).orderBy(desc(exceptionTickets.createdAt)).limit(200);
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">工单追踪</h1>
      <Card className="mt-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f5f8f8] text-[#667780]">
            <tr><th className="p-2">工单号</th><th className="p-2">运单</th><th className="p-2">来源</th><th className="p-2">类型</th><th className="p-2">状态</th><th className="p-2">金额</th></tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-t border-[#edf2f2]">
                <td className="p-2"><Link className="text-[#0aa6a3]" href={`/tickets/${ticket.id}`}>{ticket.ticketNo}</Link></td>
                <td className="p-2">{ticket.externalCode}</td>
                <td className="p-2"><Badge>{ticket.source === 'scan_qc' ? '扫描触发' : '手工上报'}</Badge></td>
                <td className="p-2">{ticket.exceptionType}</td>
                <td className="p-2">{ticket.status}</td>
                <td className="p-2">{ticket.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
