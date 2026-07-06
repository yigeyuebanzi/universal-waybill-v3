import { db } from '@/lib/db';
import { approvalRules } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).nullable().optional(),
  targetLevel: z.coerce.number().min(1).max(2).optional(),
  timeoutHours: z.coerce.number().min(1).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const [rule] = await db.update(approvalRules).set({
    ...input,
    minAmount: input.minAmount === undefined ? undefined : input.minAmount.toFixed(2),
    maxAmount: input.maxAmount === undefined ? undefined : input.maxAmount === null ? null : input.maxAmount.toFixed(2),
    updatedAt: new Date(),
  }).where(eq(approvalRules.id, id)).returning();
  if (!rule) return NextResponse.json({ error: '审批规则不存在' }, { status: 404 });
  return NextResponse.json({ data: rule });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rule] = await db.delete(approvalRules).where(eq(approvalRules.id, id)).returning();
  if (!rule) return NextResponse.json({ error: '审批规则不存在' }, { status: 404 });
  return NextResponse.json({ data: rule });
}
