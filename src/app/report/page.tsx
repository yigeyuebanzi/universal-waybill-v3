'use client';

import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { useState } from 'react';

export default function ReportPage() {
  const [form, setForm] = useState({ externalCode: '', exceptionType: 'lost', amount: '0', description: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, category: 'logistics', amount: Number(form.amount) }),
      });
      const json = await res.json();
      setMessage(res.ok ? `已创建工单：${json.data.ticketNo}` : json.error || '创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">异常上报</h1>
      <Card className="mt-4 max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1 text-sm">运单号<Input value={form.externalCode} onChange={(e) => setForm({ ...form, externalCode: e.target.value })} /></label>
          <label className="space-y-1 text-sm">异常类型<Select value={form.exceptionType} onChange={(e) => setForm({ ...form, exceptionType: e.target.value })}>
            <option value="lost">丢件</option><option value="damage">破损</option><option value="rejected">客户拒收</option><option value="timeout">超时未签收</option><option value="address_error">地址错误</option>
          </Select></label>
          <label className="space-y-1 text-sm">申诉金额<Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <div />
          <label className="col-span-2 space-y-1 text-sm">异常描述<Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={loading} onClick={submit}>{loading ? '提交中' : '提交上报'}</Button>
          <span className="text-sm text-[#667780]">{message}</span>
        </div>
      </Card>
    </AppShell>
  );
}
