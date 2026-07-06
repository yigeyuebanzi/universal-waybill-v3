import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { exceptionTickets, integrationLogs, scanRecords } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [ticketCount] = await db.select({ count: sql<number>`count(*)` }).from(exceptionTickets);
  const [approvalCount] = await db.select({ count: sql<number>`count(*)` }).from(exceptionTickets).where(eq(exceptionTickets.status, 'level1_review'));
  const [heldCount] = await db.select({ count: sql<number>`count(*)` }).from(scanRecords).where(eq(scanRecords.qcStatus, 'held'));
  const logs = await db.select().from(integrationLogs).limit(5);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工作台</h1>
          <p className="mt-1 text-sm text-[#667780]">扫描品控、异常审批、库存赔付和 V2 接口状态总览</p>
        </div>
        <Badge tone="ok">独立 V3 系统</Badge>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-sm text-[#667780]">异常工单总数</div>
          <div className="mt-3 text-3xl font-semibold">{Number(ticketCount?.count || 0)}</div>
        </Card>
        <Card>
          <div className="text-sm text-[#667780]">一级待审批</div>
          <div className="mt-3 text-3xl font-semibold">{Number(approvalCount?.count || 0)}</div>
        </Card>
        <Card>
          <div className="text-sm text-[#667780]">品控暂扣批次</div>
          <div className="mt-3 text-3xl font-semibold">{Number(heldCount?.count || 0)}</div>
        </Card>
      </div>
      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">最近 V2 接口调用</h2>
          <Badge>Request ID 可追踪</Badge>
        </div>
        <div className="overflow-hidden rounded-md border border-[#dfe7e8]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f8f8] text-[#667780]">
              <tr><th className="p-2">Request ID</th><th className="p-2">接口</th><th className="p-2">状态</th><th className="p-2">耗时</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[#edf2f2]">
                  <td className="p-2 font-mono text-xs">{log.requestId}</td>
                  <td className="p-2">{log.endpoint}</td>
                  <td className="p-2">{log.success ? <Badge tone="ok">成功</Badge> : <Badge tone="danger">失败</Badge>}</td>
                  <td className="p-2">{log.durationMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
