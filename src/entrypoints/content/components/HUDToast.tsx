import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface HUDToastProps {
  message: string | null;
  showToasts: boolean;
}

export const HUDToast: React.FC<HUDToastProps> = ({ message, showToasts }) => {
  if (!showToasts || !message) {
    return null;
  }

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2147483647] flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-2xl shadow-xl shadow-sky-500/25 animate-fade-in pointer-events-auto">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
