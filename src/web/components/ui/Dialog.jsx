import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/utils';

// Root: quản lý backdrop + container
export function Dialog({ isOpen, onClose, children, className }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/60',
          'animate-in fade-in zoom-in-95 duration-150',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Close button góc phải trên
export function DialogClose({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
      aria-label="Đóng"
    >
      <X className="w-4 h-4" />
    </button>
  );
}

// Header với icon + tiêu đề + mô tả
export function DialogHeader({ className, children, ...props }) {
  return (
    <div
      className={cn('flex items-start gap-3 px-5 pt-5 pb-4 border-b border-zinc-800 pr-12', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogIcon({ className, children }) {
  return (
    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children, ...props }) {
  return (
    <h2
      className={cn('text-sm font-semibold text-slate-100 leading-tight', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-[11px] text-zinc-500 mt-0.5', className)} {...props}>
      {children}
    </p>
  );
}

// Body
export function DialogBody({ className, children, ...props }) {
  return (
    <div className={cn('px-5 py-5 space-y-4', className)} {...props}>
      {children}
    </div>
  );
}

// Footer actions
export function DialogFooter({ className, children, ...props }) {
  return (
    <div className={cn('flex items-center gap-2 px-5 pb-5', className)} {...props}>
      {children}
    </div>
  );
}

// Label + input wrapper
export function DialogField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-zinc-300">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}
