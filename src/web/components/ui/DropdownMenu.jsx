import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/utils';

export function DropdownMenu({ trigger, children, className, align = 'left' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative inline-block text-left", isOpen ? "z-50" : "z-10")} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      
      {isOpen && (
        <div 
          className={cn(
            "absolute z-[150] mt-2 min-w-[200px] w-max rounded-md p-1.5 shadow-xl focus:outline-none",
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
          style={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({ className, children, onClick, destructive, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5 whitespace-nowrap",
        destructive ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-slate-200 hover:text-white",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

