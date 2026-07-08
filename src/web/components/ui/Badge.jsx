import React from 'react';
import { cn } from '../../utils/utils';

export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'border-transparent bg-slate-50 text-slate-900 hover:bg-slate-50/80',
    secondary: 'border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-800/80',
    destructive: 'border-transparent bg-red-900 text-zinc-50 hover:bg-red-900/80',
    outline: 'text-zinc-350 border border-zinc-800 bg-transparent hover:bg-zinc-800/20',
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
