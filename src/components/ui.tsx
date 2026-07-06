import { clsx } from 'clsx';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx('rounded-lg border border-[#dfe7e8] bg-white p-4 shadow-sm', className)}>{children}</section>;
}

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx('inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#0fc6c2] px-4 text-sm font-medium text-white hover:bg-[#0aa6a3] disabled:cursor-not-allowed disabled:opacity-60', className)}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('h-9 rounded-md border border-[#dfe7e8] bg-white px-3 text-sm outline-none focus:border-[#0fc6c2]', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('h-9 rounded-md border border-[#dfe7e8] bg-white px-3 text-sm outline-none focus:border-[#0fc6c2]', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('min-h-24 rounded-md border border-[#dfe7e8] bg-white px-3 py-2 text-sm outline-none focus:border-[#0fc6c2]', props.className)} />;
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warn' | 'danger' | 'ok' }) {
  const styles = {
    default: 'bg-[#eafbfa] text-[#0aa6a3]',
    warn: 'bg-[#faeeda] text-[#9a5b00]',
    danger: 'bg-[#fcebea] text-[#b42318]',
    ok: 'bg-[#e1f5ee] text-[#047857]',
  };
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', styles[tone])}>{children}</span>;
}
