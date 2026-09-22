import React from 'react';
import { Sun, Moon, CheckCircle2 } from 'lucide-react';

export interface OptionsHeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  savedToast: string | null;
}

export const OptionsHeader: React.FC<OptionsHeaderProps> = ({
  isDark,
  onToggleTheme,
  savedToast,
}) => {
  return (
    <>
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-6 right-8 z-50 flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white text-xs font-semibold rounded-2xl shadow-xl shadow-sky-500/25 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* Header Brand + Theme Switch */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-48.png"
            alt="BiliFlow Logo"
            className="w-8 h-8 rounded-xl object-contain shadow-sm"
          />
          <div>
            <h1
              className={`text-base font-bold tracking-tight flex items-center gap-1.5 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              BiliFlow
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500">
                v2.0.4
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">极速心流 · 模型工作台</p>
          </div>
        </div>

        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            isDark
              ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700'
              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
          title={isDark ? '切换为柔和浅色模式 (Light)' : '切换为暗黑夜间模式 (Dark)'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
};
