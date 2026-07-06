'use client';

import { AppShell } from '@/components/app-shell';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { useState } from 'react';

export default function ScanPage() {
  const [form, setForm] = useState({ externalCode: '', skuCode: '', batchNo: '', quantityDiffPercent: '0', damageLevel: '0', specDeviationPercent: '0', description: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantityDiffPercent: Number(form.quantityDiffPercent),
          damageLevel: Number(form.damageLevel),
          specDeviationPercent: Number(form.specDeviationPercent),
        }),
      });
      const json = await res.json();
      setMessage(res.ok ? `扫描结果：${json.result}${json.ticket ? `，工单 ${json.ticket.ticketNo}` : ''}` : json.error || '扫描失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">扫描品控</h1>
      <Card className="mt-4 max-w-4xl">
        <div className="grid grid-cols-3 gap-4">
          <label className="space-y-1 text-sm">运单号<Input value={form.externalCode} onChange={(e) => setForm({ ...form, externalCode: e.target.value })} /></label>
          <label className="space-y-1 text-sm">SKU<Input value={form.skuCode} onChange={(e) => setForm({ ...form, skuCode: e.target.value })} /></label>
          <label className="space-y-1 text-sm">批次<Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} /></label>
          <label className="space-y-1 text-sm">数量差异 %<Input type="number" value={form.quantityDiffPercent} onChange={(e) => setForm({ ...form, quantityDiffPercent: e.target.value })} /></label>
          <label className="space-y-1 text-sm">破损等级<Input type="number" value={form.damageLevel} onChange={(e) => setForm({ ...form, damageLevel: e.target.value })} /></label>
          <label className="space-y-1 text-sm">规格偏差 %<Input type="number" value={form.specDeviationPercent} onChange={(e) => setForm({ ...form, specDeviationPercent: e.target.value })} /></label>
          <label className="col-span-3 space-y-1 text-sm">扫描描述<Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={loading} onClick={submit}>{loading ? '检测中' : '提交扫描'}</Button>
          <span className="text-sm text-[#667780]">{message}</span>
        </div>
      </Card>
    </AppShell>
  );
}
