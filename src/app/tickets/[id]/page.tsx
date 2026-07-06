import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { TicketActions } from '@/components/ticket-actions';
import { db } from '@/lib/db';
import { approvalRecords, compensationRecords, exceptionTickets, scanRecords, waybillSnapshots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ticket] = await db.select().from(exceptionTickets).where(eq(exceptionTickets.id, id)).limit(1);
  if (!ticket) return <AppShell><Card>工单不存在</Card></AppShell>;
  const [snapshot] = ticket.snapshotId ? await db.select().from(waybillSnapshots).where(eq(waybillSnapshots.id, ticket.snapshotId)).limit(1) : [];
  const approvals = await db.select().from(approvalRecords).where(eq(approvalRecords.ticketId, id));
  const scans = await db.select().from(scanRecords).where(eq(scanRecords.ticketId, id));
  const compensations = await db.select().from(compensationRecords).where(eq(compensationRecords.ticketId, id));
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3"><h1 className="text-2xl font-semibold">{ticket.ticketNo}</h1><Badge>{ticket.status}</Badge></div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="mb-3 font-semibold">工单信息</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm"><dt>运单</dt><dd>{ticket.externalCode}</dd><dt>类型</dt><dd>{ticket.exceptionType}</dd><dt>来源</dt><dd>{ticket.source}</dd><dt>金额</dt><dd>{ticket.amount}</dd><dt>审批超时</dt><dd>{ticket.timeoutAt?.toLocaleString() || '-'}</dd><dt>品控暂扣超时</dt><dd>{ticket.qcHoldTimeoutAt?.toLocaleString() || '-'}</dd><dt>描述</dt><dd>{ticket.description}</dd></dl>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">运单快照</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm"><dt>来源</dt><dd>{snapshot ? `本地缓存，同步于 ${snapshot.syncedAt?.toLocaleString()}` : '无快照'}</dd><dt>收件人</dt><dd>{snapshot?.receiverName || '-'}</dd><dt>电话</dt><dd>{snapshot?.receiverPhone || '-'}</dd><dt>地址</dt><dd>{snapshot?.receiverAddress || '-'}</dd></dl>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">操作</h2>
        <TicketActions ticketId={ticket.id} status={ticket.status} source={ticket.source} version={ticket.version} />
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">审批记录</h2>
        {approvals.map((approval) => (
          <div key={approval.id} className="border-t py-2 text-sm first:border-t-0">
            <div className="font-medium">{approval.level} 级 {approval.action} · {approval.fromStatus} → {approval.toStatus}</div>
            <div className="text-[#667780]">{approval.opinion}</div>
            <div className="text-xs text-[#88979e]">{approval.createdAt?.toLocaleString()} · {approval.idempotencyKey}</div>
          </div>
        ))}
        {!approvals.length && <div className="text-sm text-[#667780]">暂无审批记录</div>}
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">扫描记录</h2>
        {scans.map((scan) => (
          <div key={scan.id} className="border-t py-2 text-sm first:border-t-0">
            <div>{scan.scanNo} · {scan.skuCode} · {scan.batchNo}</div>
            <div className="text-[#667780]">{scan.qcResult} / {scan.qcStatus} · 命中规则 {scan.matchedRuleId || '-'}</div>
          </div>
        ))}
        {!scans.length && <div className="text-sm text-[#667780]">暂无扫描记录</div>}
      </Card>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">赔付记录</h2>
        {compensations.map((item) => (
          <div key={item.id} className="border-t py-2 text-sm first:border-t-0">
            <div>{item.direction} · {item.amount} · {item.status}</div>
            <div className="text-xs text-[#88979e]">审批记录 {item.approvalRecordId}</div>
          </div>
        ))}
        {!compensations.length && <div className="text-sm text-[#667780]">暂无赔付记录</div>}
      </Card>
    </AppShell>
  );
}
