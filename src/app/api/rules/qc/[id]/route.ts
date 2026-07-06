import { db } from '@/lib/db';
import { qcRules } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).optional(),
  subType: z.string().min(1).optional(),
  conditionType: z.string().min(1).optional(),
  conditionConfig: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  severity: z.string().optional(),
  targetApprovalLevel: z.coerce.number().min(1).max(2).optional(),
  priority: z.coerce.number().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [rule] = await db.update(qcRules).set({
    ...parsed.data,
    updatedAt: new Date(),
  }).where(eq(qcRules.id, id)).returning();
  if (!rule) return NextResponse.json({ error: '品控规则不存在' }, { status: 404 });
  return NextResponse.json({ data: rule });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rule] = await db.delete(qcRules).where(eq(qcRules.id, id)).returning();
  if (!rule) return NextResponse.json({ error: '品控规则不存在' }, { status: 404 });
  return NextResponse.json({ data: rule });
}
