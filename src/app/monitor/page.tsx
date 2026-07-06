import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { db } from '@/lib/db';
import { integrationLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function MonitorPage() {
  const logs = await db.select().from(integrationLogs).orderBy(desc(integrationLogs.createdAt)).limit(50);
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">接口同步监控</h1>
      <Card className="mt-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f5f8f8] text-[#667780]"><tr><th className="p-2">Request ID</th><th className="p-2">接口</th><th className="p-2">状态码</th><th className="p-2">结果</th><th className="p-2">耗时</th><th className="p-2">错误</th></tr></thead>
          <tbody>{logs.map((log) => <tr key={log.id} className="border-t"><td className="p-2 font-mono text-xs">{log.requestId}</td><td className="p-2">{log.endpoint}</td><td className="p-2">{log.statusCode}</td><td className="p-2"><Badge tone={log.success ? 'ok' : 'danger'}>{log.success ? '成功' : '失败'}</Badge></td><td className="p-2">{log.durationMs}ms</td><td className="p-2">{log.errorMessage || '-'}</td></tr>)}</tbody>
        </table>
      </Card>
    </AppShell>
  );
}
