import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Settings, X, Copy, BookOpen } from 'lucide-react';

export interface HUDHeaderProps {
  isDark: boolean;
  loading: boolean;
  isFallbackUsed?: boolean;
  usedModel?: string;
  hasSummary?: boolean;
  shortcut?: string;
  onRefresh: () => void;
  onOpenOptions: () => void;
  onClose: () => void;
  onCopyMarkdown?: () => void;
  onExportToBiliNote?: () => void;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  isDark,
  loading,
  isFallbackUsed,
  usedModel,
  hasSummary,
  shortcut,
  onRefresh,
  onOpenOptions,
  onClose,
  onCopyMarkdown,
  onExportToBiliNote,
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
            {shortcut && (
              <kbd
                className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
                title={`快捷键: ${shortcut} (按快捷键可随时唤起/隐藏)`}
              >
                {shortcut}
              </kbd>
            )}
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
        {hasSummary && !loading && onExportToBiliNote && (
          <button
            type="button"
            onClick={onExportToBiliNote}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-sky-400 hover:text-sky-200 hover:bg-slate-800'
                : 'text-sky-600 hover:text-sky-800 hover:bg-slate-100'
            }`}
            title="将整篇 AI 精读与感悟完整导入 B站官方笔记"
            aria-label="导入整篇笔记至 B站官方笔记"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
        )}
        {hasSummary && !loading && onCopyMarkdown && (
          <button
            type="button"
            onClick={onCopyMarkdown}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="一键复制 Markdown 笔记 (兼容 B 站评论区)"
            aria-label="一键复制 Markdown 笔记"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
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
