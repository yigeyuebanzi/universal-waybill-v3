import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { exceptionTickets } from '@/lib/db/schema';
import { or, eq, desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const tickets = await db
    .select()
    .from(exceptionTickets)
    .where(or(eq(exceptionTickets.status, 'level1_review'), eq(exceptionTickets.status, 'level2_review')))
    .orderBy(desc(exceptionTickets.createdAt))
    .limit(100);
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">审批工作台</h1>
      <Card className="mt-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="flex items-center justify-between border-t py-3 first:border-t-0">
            <div>
              <Link className="font-medium text-[#0aa6a3]" href={`/tickets/${ticket.id}`}>{ticket.ticketNo}</Link>
              <div className="text-sm text-[#667780]">{ticket.externalCode} · {ticket.exceptionType} · {ticket.description}</div>
            </div>
            <div className="flex items-center gap-3"><Badge>{ticket.currentLevel} 级审批</Badge><span className="text-sm">{ticket.amount}</span></div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}
