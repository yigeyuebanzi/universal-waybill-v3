import { AppShell } from '@/components/app-shell';
import { Badge, Card } from '@/components/ui';
import { QcRuleForm } from '@/components/rule-create-forms';
import { QcRuleRowActions } from '@/components/rule-row-actions';
import { db } from '@/lib/db';
import { qcRules } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function QcRulesPage() {
  const rules = await db.select().from(qcRules).orderBy(asc(qcRules.priority));
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">品控规则</h1>
      <Card className="mt-4">
        <QcRuleForm />
      </Card>
      <Card className="mt-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f5f8f8] text-[#667780]"><tr><th className="p-2">名称</th><th className="p-2">子类型</th><th className="p-2">条件</th><th className="p-2">严重度</th><th className="p-2">状态</th><th className="p-2">操作</th></tr></thead>
          <tbody>{rules.map((rule) => <tr key={rule.id} className="border-t align-top"><td className="p-2">{rule.name}</td><td className="p-2">{rule.subType}</td><td className="p-2">{rule.conditionType}</td><td className="p-2">{rule.severity}</td><td className="p-2"><Badge tone={rule.enabled ? 'ok' : 'warn'}>{rule.enabled ? '启用' : '停用'}</Badge></td><td className="p-2"><QcRuleRowActions rule={{
            id: rule.id,
            name: rule.name,
            subType: rule.subType,
            conditionType: rule.conditionType,
            conditionConfig: rule.conditionConfig,
            severity: rule.severity,
            targetApprovalLevel: rule.targetApprovalLevel,
            priority: rule.priority,
            enabled: rule.enabled,
          }} /></td></tr>)}</tbody>
        </table>
      </Card>
    </AppShell>
  );
}
