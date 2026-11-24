import React from 'react';
import { Zap, ShieldCheck, RefreshCw, Settings, X, Copy, BookOpen, HelpCircle } from 'lucide-react';
import type { UserSettings } from '../../../types/settings';
import { HudViewMode } from '../../../utils/hudNavigation';
import { resolveShortcut, type ShortcutAction } from '../../../utils/shortcutDefinitions';

export interface HUDHeaderProps {
  settings: UserSettings;
  isDark: boolean;
  loading: boolean;
  isFallbackUsed?: boolean;
  usedModel?: string;
  hasSummary?: boolean;
  viewMode: HudViewMode;
  categoryLabel?: string | null;

  onViewModeChange: (mode: HudViewMode) => void;
  onRefresh: () => void;
  onOpenOptions: () => void;
  onClose: () => void;
  onCopyMarkdown?: () => void;
  onToggleHelp: () => void;

  helpTriggerRef?: React.RefObject<HTMLButtonElement | null>;

  pendingNoteSyncCount?: number;
  onExportToBiliNote?: () => void;

  onRetryNoteSync?: () => void;
}

export const HUDHeader = React.memo<HUDHeaderProps>(({
  settings,
  isDark,
  loading,
  viewMode,
  isFallbackUsed,

  usedModel,
  hasSummary,
  onViewModeChange,
  categoryLabel,

  onOpenOptions,
  onClose,
  helpTriggerRef,

  onToggleHelp,

  onRefresh,

  onCopyMarkdown,
  onExportToBiliNote,
  pendingNoteSyncCount = 0,
  onRetryNoteSync,
}) => {
  const displayShortcut = (action: ShortcutAction): string => resolveShortcut(action, settings);
  const refreshLabel =
    viewMode === 'community'
      ? '重新加载社区精选'
      : viewMode === 'transcript'
      ? '重新加载全文字幕'
      : '重新提炼视频';

  return (
    <div
      className={`flex flex-col border-b select-none shrink-0 [&_button]:outline-none [&_button]:focus:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-sky-400/60 ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      }`}
    >
      <div className="p-3.5 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20 shrink-0">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
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
              <kbd
                className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
                title={`快捷键: ${displayShortcut('toggle')} (按快捷键可随时唤起/隐藏)`}
              >
                {displayShortcut('toggle')}
              </kbd>
              {categoryLabel && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                    isDark
                      ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                      : 'text-sky-600 bg-sky-50 border-sky-200'
                  }`}
                  title="当前视频所属 B 站主分区"
                >
                  {categoryLabel}
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
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 cursor-pointer"
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
            onClick={onToggleHelp}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={`快捷键帮助 (${displayShortcut('help')})`}
            aria-label="打开快捷键帮助"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
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
      {isFallbackUsed && (
        <div className="px-3.5 pb-1.5 -mt-0.5">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold whitespace-nowrap"
            title={`容灾兜底生效中 (${usedModel || '备用模型'})`}
          >
            <ShieldCheck className="w-2.5 h-2.5 shrink-0" /> 容灾兜底 · {usedModel || '备用模型'}
          </span>
        </div>
      )}


      <div className="px-3.5 pb-2.5 flex items-center gap-1">
        {(['summary', 'transcript', 'community'] as const).map((mode) => {
          const isActive = viewMode === mode;
          const label =
            mode === 'summary'
              ? '⚡ AI 精读要点'
              : mode === 'transcript'
              ? '📜 全文字幕心流'
              : '💬 社区精选';
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              aria-pressed={isActive}
              aria-keyshortcuts={mode === 'summary' ? '[' : ']'}
              title={`${label} · 按 ${displayShortcut('prevView')} / ${displayShortcut('nextView')} 切换视图`}
              className={`flex-1 min-w-0 px-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
