import { AppShell } from '@/components/app-shell';
import { Badge, Card, Input } from '@/components/ui';
import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets, users } from '@/lib/db/schema';
import { canApprove } from '@/lib/auth-context';
import { or, eq, desc, sql, getTableColumns, and, type SQL } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actorId = typeof params?.actorId === 'string' ? params.actorId.trim() : '';
  const [actor] = actorId ? await db.select().from(users).where(eq(users.id, actorId)).limit(1) : [];
  const pendingConditions: SQL[] = [
    or(eq(exceptionTickets.status, 'level1_review'), eq(exceptionTickets.status, 'level2_review'))!,
  ];
  if (actor) {
    pendingConditions.push(eq(exceptionTickets.assignedApproverId, actor.id));
    pendingConditions.push(sql<boolean>`${exceptionTickets.reporterId} is distinct from ${actor.id}`);
    pendingConditions.push(actor.role === 'admin'
      ? sql<boolean>`true`
      : sql<boolean>`(${exceptionTickets.currentLevel} = 1 and ${actor.role} = 'level1_approver') or (${exceptionTickets.currentLevel} = 2 and ${actor.role} = 'level2_approver')`);
  }
  const pending = await db
    .select({
      ...getTableColumns(exceptionTickets),
      isDueSoon: sql<boolean>`
        ${exceptionTickets.timeoutAt} is not null
        and ${exceptionTickets.timeoutAt} < now() + interval '2 hours'
      `,
    })
    .from(exceptionTickets)
    .where(and(...pendingConditions))
    .orderBy(desc(exceptionTickets.createdAt))
    .limit(100);
  const handled = await db
    .select({ ticket: exceptionTickets, approval: approvalRecords })
    .from(approvalRecords)
    .innerJoin(exceptionTickets, eq(approvalRecords.ticketId, exceptionTickets.id))
    .where(and(
      or(eq(approvalRecords.action, 'approve'), eq(approvalRecords.action, 'reject'), eq(approvalRecords.action, 'fast_release')),
      actor ? eq(approvalRecords.approverId, actor.id) : sql<boolean>`true`
    ))
    .orderBy(desc(approvalRecords.createdAt))
    .limit(30);
  const risk = pending.filter((ticket) => ticket.isDueSoon);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">审批工作台</h1>
      <Card className="mt-4">
        <form className="mb-4 grid grid-cols-[1fr_auto] gap-3">
          <Input name="actorId" defaultValue={actorId} placeholder="审批人 ID，留空查看全部待审" />
          <button className="h-9 rounded-md bg-[#0fc6c2] px-4 text-sm font-medium text-white hover:bg-[#0aa6a3]">筛选</button>
          {actorId && !actor && <div className="col-span-2 text-sm text-[#b42318]">审批人不存在</div>}
          {actor && !['admin', 'level1_approver', 'level2_approver'].some((role) => role === actor.role) && (
            <div className="col-span-2 text-sm text-[#b42318]">当前角色无审批权限</div>
          )}
        </form>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{actor ? `待 ${actor.name} 审批` : '待审批'}</h2>
          <Badge>{pending.length} 条</Badge>
        </div>
        {pending.map((ticket) => (
          <div key={ticket.id} className="flex items-center justify-between border-t py-3 first:border-t-0">
            <div>
              <Link className="font-medium text-[#0aa6a3]" href={`/tickets/${ticket.id}`}>{ticket.ticketNo}</Link>
              <div className="text-sm text-[#667780]">{ticket.externalCode} · {ticket.exceptionType} · {ticket.description}</div>
            </div>
            <div className="flex items-center gap-3">{ticket.isDueSoon && <Badge tone="warn">即将超时</Badge>}<Badge>{ticket.currentLevel} 级审批</Badge><span className="text-sm">{ticket.amount}</span></div>
          </div>
        ))}
        {!pending.length && <div className="text-sm text-[#667780]">{actor && (canApprove(actor.role, 1) || canApprove(actor.role, 2)) ? '暂无待审批工单' : '暂无可处理工单'}</div>}
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">超时风险</h2>
            <Badge tone={risk.length ? 'warn' : 'ok'}>{risk.length} 条</Badge>
          </div>
          {risk.map((ticket) => (
            <div key={ticket.id} className="border-t py-3 text-sm first:border-t-0">
              <Link className="font-medium text-[#0aa6a3]" href={`/tickets/${ticket.id}`}>{ticket.ticketNo}</Link>
              <div className="text-[#667780]">{ticket.timeoutAt?.toLocaleString()} · {ticket.currentLevel} 级审批</div>
            </div>
          ))}
          {!risk.length && <div className="text-sm text-[#667780]">暂无即将超时工单</div>}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">我已处理</h2>
            <Badge>{handled.length} 条</Badge>
          </div>
          {handled.map(({ ticket, approval }) => (
            <div key={approval.id} className="border-t py-3 text-sm first:border-t-0">
              <Link className="font-medium text-[#0aa6a3]" href={`/tickets/${ticket.id}`}>{ticket.ticketNo}</Link>
              <div className="text-[#667780]">{approval.action} · {approval.opinion}</div>
            </div>
          ))}
          {!handled.length && <div className="text-sm text-[#667780]">暂无处理记录</div>}
        </Card>
      </div>
    </AppShell>
  );
}
