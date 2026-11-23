import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { resolveShortcut, SHORTCUT_DEFINITIONS } from '../../../utils/shortcutDefinitions';
import type { UserSettings } from '../../../types/settings';

export interface ShortcutHelpPanelProps {
  isDark: boolean;
  settings: UserSettings;
  onClose: () => void;
}

export const ShortcutHelpPanel: React.FC<ShortcutHelpPanelProps> = ({
  isDark,
  settings,
  onClose,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-sky-500" />
          <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            快捷键速查
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title="关闭快捷键帮助 (Esc)"
          aria-label="关闭快捷键帮助"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {SHORTCUT_DEFINITIONS.map((definition) => (
          <div
            key={definition.action}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${
              isDark
                ? 'bg-slate-800/40 border-slate-700/50'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {definition.label}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">{definition.description}</p>
            </div>
            <kbd
              className={`shrink-0 px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                isDark
                  ? 'bg-slate-900/80 text-sky-400 border border-slate-700'
                  : 'bg-white text-sky-600 border border-slate-200'
              }`}
            >
              {resolveShortcut(definition.action, settings)}
            </kbd>
          </div>
        ))}
      </div>

      <div
        className={`p-3 rounded-xl border text-[11px] leading-relaxed space-y-1 ${
          isDark
            ? 'bg-sky-950/30 border-sky-800/40 text-slate-300'
            : 'bg-sky-50 border-sky-200 text-slate-600'
        }`}
      >
        <p>· Enter / Space：激活当前聚焦的按钮或卡片</p>
        <p>· Tab / Shift+Tab：HUD 展开时切换视图</p>

        <p>· ↑ / ↓：HUD 展开时由 HUD 接管（要点视图导航亮点，其他视图滚动内容），收起时保留 B 站音量控制</p>
        <p>· Esc：先关闭本帮助，再按可关闭整个 HUD</p>
        <p>· 设置中把任意快捷键留空即可禁用该项</p>
      </div>
    </div>
  );
};
