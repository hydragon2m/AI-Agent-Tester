import React from 'react';
import { cn } from '../../utils/utils';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    default: 'bg-slate-50 text-slate-900 hover:bg-slate-50/90 shadow font-semibold',
    destructive: 'bg-red-900/90 text-slate-50 hover:bg-red-900 shadow-sm',
    outline: 'border border-slate-800 bg-transparent hover:bg-slate-800 hover:text-slate-50 text-slate-300',
    secondary: 'bg-slate-800 text-slate-50 hover:bg-slate-800/80 shadow-sm',
    ghost: 'hover:bg-slate-800 hover:text-slate-50 text-slate-400',
    link: 'text-slate-300 underline-offset-4 hover:underline',
  };

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-8 w-8',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = 'Button';
