import { db } from '@/lib/db';
import { qcRules } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1),
  subType: z.string().min(1),
  conditionType: z.string().min(1),
  conditionConfig: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  severity: z.string().default('medium'),
  targetApprovalLevel: z.coerce.number().default(2),
  priority: z.coerce.number().default(100),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const data = await db.select().from(qcRules).orderBy(asc(qcRules.priority));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [rule] = await db.insert(qcRules).values(parsed.data).returning();
  return NextResponse.json({ data: rule }, { status: 201 });
}
