import type { ComponentProps, ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100"
    />
  );
}

export function Button({
  variant = 'primary',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    />
  );
}
