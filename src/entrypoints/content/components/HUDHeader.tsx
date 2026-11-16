import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Settings, X, Copy, BookOpen } from 'lucide-react';

export type HudViewMode = 'summary' | 'transcript';

export interface HUDHeaderProps {
  isDark: boolean;
  loading: boolean;
  isFallbackUsed?: boolean;
  usedModel?: string;
  hasSummary?: boolean;
  shortcut?: string;
  viewMode: HudViewMode;
  onViewModeChange: (mode: HudViewMode) => void;
  onRefresh: () => void;
  onOpenOptions: () => void;
  onClose: () => void;
  onCopyMarkdown?: () => void;
  onExportToBiliNote?: () => void;
  pendingNoteSyncCount?: number;
  onRetryNoteSync?: () => void;
}

export const HUDHeader = React.memo<HUDHeaderProps>(({
  isDark,
  loading,
  isFallbackUsed,
  usedModel,
  hasSummary,
  shortcut,
  viewMode,
  onViewModeChange,
  onRefresh,
  onOpenOptions,
  onClose,
  onCopyMarkdown,
  onExportToBiliNote,
  pendingNoteSyncCount = 0,
  onRetryNoteSync,
}) => {
  const refreshLabel = viewMode === 'transcript' ? '重新加载全文字幕' : '重新提炼视频';

  return (
    <div
      className={`flex flex-col border-b select-none shrink-0 ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}
    >
      <div className="p-3.5 flex items-center justify-between">
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
          {pendingNoteSyncCount > 0 && onRetryNoteSync && (
            <button
              type="button"
              onClick={onRetryNoteSync}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 cursor-pointer"
              title="重试将本地待同步笔记写入 B站官方笔记"
              aria-label={`待同步 ${pendingNoteSyncCount} 条，点击重试`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>待同步 {pendingNoteSyncCount} 条</span>
            </button>
          )}
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
            title={refreshLabel}
            aria-label={refreshLabel}
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

      <div className="px-3.5 pb-2.5 flex items-center gap-1">
        {(['summary', 'transcript'] as const).map((mode) => {
          const isActive = viewMode === mode;
          const label = mode === 'summary' ? '⚡ AI 精读要点' : '📜 全文字幕心流';
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              aria-pressed={isActive}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-sky-500 text-white'
                  : isDark
                  ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
