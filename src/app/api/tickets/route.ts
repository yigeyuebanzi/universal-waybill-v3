import { db } from '@/lib/db';
import { exceptionTickets } from '@/lib/db/schema';
import { resolveApproval } from '@/lib/approval-engine';
import { getActor } from '@/lib/auth-context';
import { fetchV2Order } from '@/lib/v2-client';
import { upsertSnapshot } from '@/lib/snapshots';
import { and, desc, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createTicketSchema = z.object({
  externalCode: z.string().min(1),
  exceptionType: z.string().min(1),
  category: z.enum(['logistics', 'quality_control']).default('logistics'),
  description: z.string().min(1),
  amount: z.coerce.number().min(0).default(0),
  reporterId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const externalCode = searchParams.get('externalCode');
  const conditions = [];
  if (status) conditions.push(eq(exceptionTickets.status, status));
  if (externalCode) conditions.push(eq(exceptionTickets.externalCode, externalCode));

  const data = await db
    .select()
    .from(exceptionTickets)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(exceptionTickets.createdAt))
    .limit(100);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const parsed = createTicketSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const actor = await getActor(input.reporterId);
  if (!actor || !actor.enabled) {
    return NextResponse.json({ error: 'Reporter is disabled or missing' }, { status: 403 });
  }

  const order = await fetchV2Order(input.externalCode);
  const snapshot = await upsertSnapshot(order);

  const [duplicate] = await db
    .select()
    .from(exceptionTickets)
    .where(
      and(
        eq(exceptionTickets.externalCode, input.externalCode),
        eq(exceptionTickets.exceptionType, input.exceptionType),
        ne(exceptionTickets.status, 'completed'),
        ne(exceptionTickets.status, 'closed')
      )
    )
    .limit(1);
  if (duplicate) {
    return NextResponse.json({ error: '同一运单同类型异常已有未关闭工单', ticket: duplicate }, { status: 409 });
  }

  const approval = await resolveApproval(input.amount);
  const [ticket] = await db
    .insert(exceptionTickets)
    .values({
      ticketNo: `T${Date.now()}`,
      externalCode: input.externalCode,
      snapshotId: snapshot.id,
      source: 'manual_report',
      category: input.category,
      exceptionType: input.exceptionType,
      severity: input.amount > 500 ? 'high' : 'medium',
      amount: input.amount.toFixed(2),
      description: input.description,
      status: approval.status,
      currentLevel: approval.targetLevel,
      reporterId: actor.id,
      assignedApproverId: approval.approverId,
      timeoutAt: approval.timeoutAt,
    })
    .returning();

  return NextResponse.json({ data: ticket }, { status: 201 });
}
