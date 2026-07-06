import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getActor(actorId?: string | null) {
  if (!actorId) {
    const [fallback] = await db.select().from(users).where(eq(users.role, 'operator')).limit(1);
    return fallback;
  }

  const [actor] = await db.select().from(users).where(eq(users.id, actorId)).limit(1);
  return actor;
}

export function canApprove(role: string, level: number) {
  if (role === 'admin') return true;
  if (level === 1) return role === 'level1_approver';
  if (level === 2) return role === 'level2_approver';
  return false;
}

export function canFastRelease(role: string) {
  return role === 'qc_supervisor' || role === 'admin';
}
