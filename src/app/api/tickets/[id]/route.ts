import { db } from '@/lib/db';
import { approvalRecords, compensationRecords, exceptionTickets, inventoryMovements, scanRecords, waybillSnapshots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ticket] = await db.select().from(exceptionTickets).where(eq(exceptionTickets.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const [snapshot] = ticket.snapshotId
    ? await db.select().from(waybillSnapshots).where(eq(waybillSnapshots.id, ticket.snapshotId)).limit(1)
    : [];
  const approvals = await db.select().from(approvalRecords).where(eq(approvalRecords.ticketId, id));
  const scans = await db.select().from(scanRecords).where(eq(scanRecords.ticketId, id));
  const compensations = await db.select().from(compensationRecords).where(eq(compensationRecords.ticketId, id));
  const movements = await db.select().from(inventoryMovements).where(eq(inventoryMovements.ticketId, id));

  return NextResponse.json({ ticket, snapshot, approvals, scans, compensations, movements });
}
