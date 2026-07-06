import Link from 'next/link';
import { Boxes, ClipboardCheck, Gauge, ListChecks, Radar, ScanLine, Settings2, WalletCards } from 'lucide-react';

const nav = [
  { href: '/', label: '工作台', icon: Gauge },
  { href: '/scan', label: '扫描品控', icon: ScanLine },
  { href: '/report', label: '异常上报', icon: ClipboardCheck },
  { href: '/tickets', label: '工单追踪', icon: ListChecks },
  { href: '/approvals', label: '审批台', icon: ClipboardCheck },
  { href: '/rules/qc', label: '品控规则', icon: Settings2 },
  { href: '/monitor', label: '接口监控', icon: Radar },
  { href: '/inventory', label: '库存赔付', icon: Boxes },
  { href: '/compensations', label: '赔付记录', icon: WalletCards },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 w-64 border-r border-[#dfe7e8] bg-white">
        <div className="border-b border-[#dfe7e8] px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0aa6a3]">Jingtian V3</div>
          <div className="mt-2 text-lg font-semibold">运单全流程管理</div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#4a5a63] hover:bg-[#eafbfa] hover:text-[#0aa6a3]">
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="ml-64 min-h-screen px-8 py-6">
        {children}
      </main>
    </div>
  );
}
