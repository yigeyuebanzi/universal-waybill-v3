'use client';

import { Button, Input, Select } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ApprovalRuleForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  async function submit(formData: FormData) {
    setMessage('');
    const body = {
      name: String(formData.get('name') || ''),
      minAmount: Number(formData.get('minAmount') || 0),
      maxAmount: formData.get('maxAmount') ? Number(formData.get('maxAmount')) : undefined,
      targetLevel: Number(formData.get('targetLevel') || 1),
      timeoutHours: Number(formData.get('timeoutHours') || 24),
      enabled: true,
    };
    const res = await fetch('/api/rules/approval', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(res.ok ? '已新增审批规则' : '新增失败');
    if (res.ok) router.refresh();
  }

  return (
    <form action={submit} className="grid grid-cols-6 gap-3">
      <Input name="name" placeholder="规则名称" required />
      <Input name="minAmount" type="number" placeholder="最小金额" required />
      <Input name="maxAmount" type="number" placeholder="最大金额，可空" />
      <Select name="targetLevel" defaultValue="1"><option value="1">一级</option><option value="2">二级</option></Select>
      <Input name="timeoutHours" type="number" placeholder="超时小时" defaultValue={24} required />
      <Button>新增</Button>
      {message && <div className="col-span-6 text-sm text-[#667780]">{message}</div>}
    </form>
  );
}

export function QcRuleForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  async function submit(formData: FormData) {
    setMessage('');
    const conditionType = String(formData.get('conditionType') || '');
    const threshold = Number(formData.get('threshold') || 0);
    const conditionConfig = conditionType === 'damage_level'
      ? { minLevel: threshold }
      : conditionType === 'label_mismatch' || conditionType === 'batch_risk'
        ? { expected: true }
        : { threshold };
    const body = {
      name: String(formData.get('name') || ''),
      subType: String(formData.get('subType') || ''),
      conditionType,
      conditionConfig,
      severity: String(formData.get('severity') || 'medium'),
      targetApprovalLevel: Number(formData.get('targetApprovalLevel') || 2),
      priority: Number(formData.get('priority') || 100),
      enabled: true,
    };
    const res = await fetch('/api/rules/qc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(res.ok ? '已新增品控规则' : '新增失败');
    if (res.ok) router.refresh();
  }

  return (
    <form action={submit} className="grid grid-cols-7 gap-3">
      <Input name="name" placeholder="规则名称" required />
      <Input name="subType" placeholder="异常子类型" required />
      <Select name="conditionType" defaultValue="quantity_diff_percent">
        <option value="quantity_diff_percent">数量差异%</option>
        <option value="damage_level">破损等级</option>
        <option value="spec_deviation_percent">规格偏差%</option>
        <option value="label_mismatch">标签错误</option>
        <option value="batch_risk">批次风险</option>
      </Select>
      <Input name="threshold" type="number" placeholder="阈值" defaultValue={5} />
      <Select name="severity" defaultValue="medium"><option value="medium">中</option><option value="high">高</option></Select>
      <Input name="priority" type="number" placeholder="优先级" defaultValue={100} />
      <Button>新增</Button>
      {message && <div className="col-span-7 text-sm text-[#667780]">{message}</div>}
    </form>
  );
}
