'use client';

import { Button, Textarea } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface Props {
  ticketId: string;
  status: string;
  source: string;
  version: number;
}

export function TicketActions({ ticketId, status, source, version }: Props) {
  const router = useRouter();
  const [actorId, setActorId] = useState('');
  const [opinion, setOpinion] = useState('');
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  async function post(path: string, body: Record<string, unknown>, confirmText: string) {
    if (!actorId.trim()) {
      setMessage('请填写操作人 ID');
      return;
    }
    if (!window.confirm(confirmText)) return;
    setLoading(path);
    setMessage('');
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(typeof json.error === 'string' ? json.error : '操作失败');
        return;
      }
      setMessage('操作成功');
      router.refresh();
    } finally {
      setLoading('');
    }
  }

  async function suggestApproval() {
    setLoading('ai');
    setAiMessage('');
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'approval', text: `${status} ${source} ${opinion}` }),
      });
      const json = await res.json();
      setAiMessage(json.suggestion ? `AI 建议，需人工确认：${json.suggestion}` : json.warning || json.message || 'AI 建议暂不可用，主流程不受影响');
    } catch {
      setAiMessage('AI 建议暂不可用，主流程不受影响');
    } finally {
      setLoading('');
    }
  }

  const canApprove = status === 'pending' || status === 'level1_review' || status === 'level2_review' || status === 'resubmitted';
  const canResubmit = status === 'rejected';
  const canFastRelease = source === 'scan_qc' && !['completed', 'closed', 'auto_rejected', 'fast_released'].includes(status);

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        操作人 ID
        <input
          className="mt-1 h-9 w-full rounded-md border border-[#dfe7e8] px-3 text-sm outline-none focus:border-[#0fc6c2]"
          value={actorId}
          onChange={(event) => setActorId(event.target.value)}
          placeholder="填写审批人/品控主管/上报人 ID"
        />
      </label>
      <label className="block text-sm">
        意见 / 原因
        <Textarea value={opinion} onChange={(event) => setOpinion(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <>
            <Button
              className="bg-[#5f5e5a] hover:bg-[#454440]"
              disabled={Boolean(loading)}
              onClick={suggestApproval}
            >
              {loading === 'ai' ? '分析中' : 'AI 审批建议'}
            </Button>
            <Button
              disabled={Boolean(loading)}
              onClick={() => post('/api/approvals', {
                ticketId,
                actorId,
                action: 'approve',
                opinion: opinion || '同意',
                expectedVersion: version,
                idempotencyKey: `${idempotencyKey}-approve`,
              }, '确认审批通过该工单？')}
            >
              {loading === '/api/approvals' ? '处理中' : '审批通过'}
            </Button>
            <Button
              className="bg-[#b42318] hover:bg-[#8f1d14]"
              disabled={Boolean(loading)}
              onClick={() => post('/api/approvals', {
                ticketId,
                actorId,
                action: 'reject',
                opinion: opinion || '拒绝',
                expectedVersion: version,
                idempotencyKey: `${idempotencyKey}-reject`,
              }, '确认拒绝该工单？')}
            >
              拒绝
            </Button>
          </>
        )}
        {canResubmit && (
          <Button
            disabled={Boolean(loading)}
            onClick={() => post(`/api/tickets/${ticketId}/resubmit`, {
              actorId,
              description: opinion || undefined,
              expectedVersion: version,
              idempotencyKey: `${idempotencyKey}-resubmit`,
            }, '确认重新提交该工单？')}
          >
            重新提交
          </Button>
        )}
        {canFastRelease && (
          <Button
            className="bg-[#5f5e5a] hover:bg-[#454440]"
            disabled={Boolean(loading)}
            onClick={() => post('/api/fast-release', {
              ticketId,
              actorId,
              reason: opinion || '品控主管确认误判',
              idempotencyKey: `${idempotencyKey}-fast-release`,
            }, '确认快速放行并解锁批次？')}
          >
            快速放行
          </Button>
        )}
      </div>
      {message && <div className="text-sm text-[#667780]">{message}</div>}
      {aiMessage && <div className="rounded-md border border-[#dfe7e8] bg-[#f5f8f8] p-3 text-sm text-[#4a5a63]">{aiMessage}</div>}
    </div>
  );
}
