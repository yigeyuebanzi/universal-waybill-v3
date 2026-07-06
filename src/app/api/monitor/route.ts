import { db } from '@/lib/db';
import { integrationLogs } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const logs = await db.select().from(integrationLogs).orderBy(desc(integrationLogs.createdAt)).limit(30);
  const [summary] = await db
    .select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when success then 1 else 0 end)`,
    })
    .from(integrationLogs);

  return NextResponse.json({
    latestSyncAt: logs[0]?.createdAt || null,
    successRate: Number(summary?.total || 0) === 0 ? 1 : Number(summary.success || 0) / Number(summary.total || 1),
    logs,
  });
}
