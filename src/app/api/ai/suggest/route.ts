import { db } from '@/lib/db';
import { approvalRecords, exceptionTickets } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  text: z.string().min(1),
  mode: z.enum(['classify', 'approval']).default('classify'),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const baseUrl = process.env.DEEPSEEK_BASE_URL;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL;
  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json({ aiAvailable: false, suggestion: null, message: 'AI service is not configured' });
  }

  const history = await db
    .select({
      ticketNo: exceptionTickets.ticketNo,
      exceptionType: exceptionTickets.exceptionType,
      action: approvalRecords.action,
      opinion: approvalRecords.opinion,
    })
    .from(approvalRecords)
    .innerJoin(exceptionTickets, eq(approvalRecords.ticketId, exceptionTickets.id))
    .orderBy(desc(approvalRecords.createdAt))
    .limit(5)
    .catch(() => []);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是运单异常审批助手。只输出 JSON，必须标注 AI 建议需人工确认，并给出依据。',
          },
          {
            role: 'user',
            content: JSON.stringify({ mode: input.mode, text: input.text, history }),
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    const json = await response.json();
    return NextResponse.json({
      aiAvailable: response.ok,
      warning: 'AI 建议，需人工确认',
      suggestion: json.choices?.[0]?.message?.content || null,
      basis: history,
    });
  } catch (error) {
    return NextResponse.json({
      aiAvailable: false,
      warning: 'AI 建议不可用，主流程不受影响',
      suggestion: null,
      error: error instanceof Error ? error.message : 'AI request failed',
    });
  } finally {
    clearTimeout(timer);
  }
}
