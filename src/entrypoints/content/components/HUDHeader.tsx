import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Settings, X } from 'lucide-react';

export interface HUDHeaderProps {
  isDark: boolean;
  loading: boolean;
  isFallbackUsed?: boolean;
  usedModel?: string;
  onRefresh: () => void;
  onOpenOptions: () => void;
  onClose: () => void;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  isDark,
  loading,
  isFallbackUsed,
  usedModel,
  onRefresh,
  onOpenOptions,
  onClose,
}) => {
  return (
    <div
      className={`p-3.5 border-b flex items-center justify-between select-none ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20">
          <Zap className="w-4 h-4 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              BiliFlow
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500 font-bold">
              HUD
            </span>
            {isFallbackUsed && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold"
                title={`容灾兜底生效中 (${usedModel || '备用模型'})`}
              >
                <ShieldCheck className="w-2.5 h-2.5" /> 容灾兜底
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="重新提炼视频"
          aria-label="重新提炼视频"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onOpenOptions}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="打开设置工作台"
          aria-label="打开设置工作台"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="关闭 (Esc)"
          aria-label="关闭浮层"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
