import { AppShell } from '@/components/app-shell';
import { Badge, Card, Input, Select } from '@/components/ui';
import { db } from '@/lib/db';
import { exceptionTickets } from '@/lib/db/schema';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value)) query.set(key, String(value));
  });
  return `?${query.toString()}`;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params?.status === 'string' ? params.status : '';
  const source = typeof params?.source === 'string' ? params.source : '';
  const exceptionType = typeof params?.exceptionType === 'string' ? params.exceptionType : '';
  const externalCode = typeof params?.externalCode === 'string' ? params.externalCode.trim() : '';
  const page = Math.max(1, Number(typeof params?.page === 'string' ? params.page : 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(typeof params?.pageSize === 'string' ? params.pageSize : 20) || 20));
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(exceptionTickets.status, status));
  if (source) conditions.push(eq(exceptionTickets.source, source));
  if (exceptionType) conditions.push(eq(exceptionTickets.exceptionType, exceptionType));
  if (externalCode) conditions.push(eq(exceptionTickets.externalCode, externalCode));
  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(exceptionTickets).where(where);
  const total = Number(totalRow?.count || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const tickets = await db
    .select()
    .from(exceptionTickets)
    .where(where)
    .orderBy(desc(exceptionTickets.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const baseQuery = { status, source, exceptionType, externalCode, pageSize };
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工单追踪</h1>
          <p className="mt-1 text-sm text-[#667780]">按状态、来源、类型和运单号筛选异常工单</p>
        </div>
        <Badge>{total} 条记录</Badge>
      </div>
      <Card className="mt-4">
        <form className="mb-4 grid grid-cols-5 gap-3">
          <Select name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="level1_review">一级待审</option>
            <option value="level2_review">二级待审</option>
            <option value="rejected">已拒绝</option>
            <option value="executing">执行中</option>
            <option value="completed">已完成</option>
            <option value="auto_rejected">自动拒绝</option>
            <option value="fast_released">快速放行</option>
          </Select>
          <Select name="source" defaultValue={source}>
            <option value="">全部来源</option>
            <option value="manual_report">手工上报</option>
            <option value="scan_qc">扫描触发</option>
          </Select>
          <Input name="exceptionType" defaultValue={exceptionType} placeholder="异常类型" />
          <Input name="externalCode" defaultValue={externalCode} placeholder="运单号" />
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className="h-9 rounded-md bg-[#0fc6c2] px-4 text-sm font-medium text-white hover:bg-[#0aa6a3]">筛选</button>
        </form>
        <div className="overflow-hidden rounded-md border border-[#dfe7e8]">
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
              {!tickets.length && (
                <tr>
                  <td className="p-6 text-center text-[#667780]" colSpan={6}>暂无匹配工单</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-[#667780]">
          <span>第 {currentPage} / {totalPages} 页，每页 {pageSize} 条</span>
          <div className="flex items-center gap-2">
            <Link
              className={`rounded-md border border-[#dfe7e8] px-3 py-1.5 ${currentPage <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-[#eafbfa]'}`}
              href={`/tickets${toQuery({ ...baseQuery, page: currentPage - 1 })}`}
            >
              上一页
            </Link>
            <Link
              className={`rounded-md border border-[#dfe7e8] px-3 py-1.5 ${currentPage >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-[#eafbfa]'}`}
              href={`/tickets${toQuery({ ...baseQuery, page: currentPage + 1 })}`}
            >
              下一页
            </Link>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
