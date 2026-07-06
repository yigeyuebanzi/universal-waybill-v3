'use client';

import { Button, Input, Select } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ApprovalRule {
  id: string;
  name: string;
  minAmount: string;
  maxAmount: string | null;
  targetLevel: number;
  timeoutHours: number;
  enabled: boolean;
}

interface QcRule {
  id: string;
  name: string;
  subType: string;
  conditionType: string;
  conditionConfig: unknown;
  severity: string;
  targetApprovalLevel: number;
  priority: number;
  enabled: boolean;
}

function configThreshold(config: unknown) {
  if (!config || typeof config !== 'object') return 0;
  const record = config as Record<string, unknown>;
  return Number(record.threshold ?? record.minLevel ?? 1);
}

function configFor(conditionType: string, threshold: number) {
  if (conditionType === 'damage_level') return { minLevel: threshold };
  if (conditionType === 'label_mismatch' || conditionType === 'batch_risk') return { expected: true };
  return { threshold };
}

export function ApprovalRuleRowActions({ rule }: { rule: ApprovalRule }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  async function save(formData: FormData) {
    setMessage('');
    const body = {
      name: String(formData.get('name') || ''),
      minAmount: Number(formData.get('minAmount') || 0),
      maxAmount: formData.get('maxAmount') ? Number(formData.get('maxAmount')) : null,
      targetLevel: Number(formData.get('targetLevel') || 1),
      timeoutHours: Number(formData.get('timeoutHours') || 24),
    };
    const res = await fetch(`/api/rules/approval/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(res.ok ? '已保存' : '保存失败');
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function patchEnabled(enabled: boolean) {
    const res = await fetch(`/api/rules/approval/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setMessage(res.ok ? '已更新状态' : '更新失败');
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm('确认删除该审批规则？')) return;
    const res = await fetch(`/api/rules/approval/${rule.id}`, { method: 'DELETE' });
    setMessage(res.ok ? '已删除' : '删除失败');
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form action={save} className="grid grid-cols-6 gap-2">
        <Input name="name" defaultValue={rule.name} required />
        <Input name="minAmount" type="number" defaultValue={rule.minAmount} required />
        <Input name="maxAmount" type="number" defaultValue={rule.maxAmount || ''} />
        <Select name="targetLevel" defaultValue={String(rule.targetLevel)}><option value="1">一级</option><option value="2">二级</option></Select>
        <Input name="timeoutHours" type="number" defaultValue={rule.timeoutHours} required />
        <Button>保存</Button>
        <button type="button" className="text-sm text-[#667780]" onClick={() => setEditing(false)}>取消</button>
        {message && <span className="col-span-6 text-sm text-[#667780]">{message}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button className="rounded-md border border-[#dfe7e8] px-3 py-1.5 text-sm hover:bg-[#eafbfa]" onClick={() => setEditing(true)}>编辑</button>
      <button className="rounded-md border border-[#dfe7e8] px-3 py-1.5 text-sm hover:bg-[#eafbfa]" onClick={() => patchEnabled(!rule.enabled)}>{rule.enabled ? '停用' : '启用'}</button>
      <button className="rounded-md border border-[#f1c6c1] px-3 py-1.5 text-sm text-[#b42318] hover:bg-[#fcebea]" onClick={remove}>删除</button>
      {message && <span className="text-sm text-[#667780]">{message}</span>}
    </div>
  );
}

export function QcRuleRowActions({ rule }: { rule: QcRule }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  async function save(formData: FormData) {
    setMessage('');
    const conditionType = String(formData.get('conditionType') || '');
    const threshold = Number(formData.get('threshold') || 0);
    const body = {
      name: String(formData.get('name') || ''),
      subType: String(formData.get('subType') || ''),
      conditionType,
      conditionConfig: configFor(conditionType, threshold),
      severity: String(formData.get('severity') || 'medium'),
      targetApprovalLevel: Number(formData.get('targetApprovalLevel') || 2),
      priority: Number(formData.get('priority') || 100),
    };
    const res = await fetch(`/api/rules/qc/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(res.ok ? '已保存' : '保存失败');
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function patchEnabled(enabled: boolean) {
    const res = await fetch(`/api/rules/qc/${rule.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setMessage(res.ok ? '已更新状态' : '更新失败');
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm('确认删除该品控规则？')) return;
    const res = await fetch(`/api/rules/qc/${rule.id}`, { method: 'DELETE' });
    setMessage(res.ok ? '已删除' : '删除失败');
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form action={save} className="grid grid-cols-7 gap-2">
        <Input name="name" defaultValue={rule.name} required />
        <Input name="subType" defaultValue={rule.subType} required />
        <Select name="conditionType" defaultValue={rule.conditionType}>
          <option value="quantity_diff_percent">数量差异%</option>
          <option value="damage_level">破损等级</option>
          <option value="spec_deviation_percent">规格偏差%</option>
          <option value="label_mismatch">标签错误</option>
          <option value="batch_risk">批次风险</option>
        </Select>
        <Input name="threshold" type="number" defaultValue={configThreshold(rule.conditionConfig)} />
        <Select name="severity" defaultValue={rule.severity}><option value="medium">中</option><option value="high">高</option></Select>
        <Input name="priority" type="number" defaultValue={rule.priority} />
        <Button>保存</Button>
        <button type="button" className="text-sm text-[#667780]" onClick={() => setEditing(false)}>取消</button>
        {message && <span className="col-span-7 text-sm text-[#667780]">{message}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button className="rounded-md border border-[#dfe7e8] px-3 py-1.5 text-sm hover:bg-[#eafbfa]" onClick={() => setEditing(true)}>编辑</button>
      <button className="rounded-md border border-[#dfe7e8] px-3 py-1.5 text-sm hover:bg-[#eafbfa]" onClick={() => patchEnabled(!rule.enabled)}>{rule.enabled ? '停用' : '启用'}</button>
      <button className="rounded-md border border-[#f1c6c1] px-3 py-1.5 text-sm text-[#b42318] hover:bg-[#fcebea]" onClick={remove}>删除</button>
      {message && <span className="text-sm text-[#667780]">{message}</span>}
    </div>
  );
}
