import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { ApprovalRuleForm } from '@/components/rule-create-forms';
import { db } from '@/lib/db';
import { approvalRules } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function ApprovalRulesPage() {
  const rules = await db.select().from(approvalRules).orderBy(asc(approvalRules.minAmount));
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">审批规则</h1>
      <Card className="mt-4">
        <ApprovalRuleForm />
      </Card>
      <Card className="mt-4">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between border-t py-3 first:border-t-0">
            <div><div className="font-medium">{rule.name}</div><div className="text-sm text-[#667780]">{rule.minAmount} - {rule.maxAmount || '无限'} 元</div></div>
            <div className="flex gap-3"><Badge>{rule.targetLevel} 级审批</Badge><Badge tone="warn">{rule.timeoutHours} 小时超时</Badge></div>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}
