import { db } from '@/lib/db';
import { approvalRules } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1),
  minAmount: z.coerce.number().min(0),
  maxAmount: z.coerce.number().min(0).optional(),
  targetLevel: z.coerce.number().min(1).max(2),
  timeoutHours: z.coerce.number().min(1),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const data = await db.select().from(approvalRules).orderBy(asc(approvalRules.minAmount));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const [rule] = await db.insert(approvalRules).values({
    ...input,
    minAmount: input.minAmount.toFixed(2),
    maxAmount: input.maxAmount === undefined ? null : input.maxAmount.toFixed(2),
  }).returning();
  return NextResponse.json({ data: rule }, { status: 201 });
}
