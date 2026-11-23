import React from 'react';
import { Keyboard } from 'lucide-react';
import type { UserSettings } from '../../../types';
import {
  resolveShortcut,
  SHORTCUT_DEFINITIONS,
  type ShortcutAction,
} from '../../../utils/shortcutDefinitions';

export interface ShortcutsTabProps {
  isDark: boolean;
  settings: UserSettings;
  onClearShortcut: (action: ShortcutAction) => void;

  recordingTarget: ShortcutAction | null;
  setRecordingTarget: (target: ShortcutAction | null) => void;
  onSaveSettings: (newSettings: UserSettings, toastText?: string) => void;
  onRestoreDefault: (action: ShortcutAction) => void;
}

export const ShortcutsTab: React.FC<ShortcutsTabProps> = ({
  onClearShortcut,

  isDark,
  settings,
  recordingTarget,
  setRecordingTarget,
  onRestoreDefault,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Global Shortcut Recorders Grid */}
      <div
        className={`p-6 rounded-2xl border space-y-5 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2
            className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Keyboard className="w-4 h-4 text-sky-500" />
            <span>自定义全键盘交互快捷键</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            自由改绑 HUD 浮层交互、视图切换、字幕搜索及一键 B站笔记快捷键。点击“录制”后直接按下按键即可（支持单键或组合键，按 Esc 可取消；Tab / Enter / 空格 / 裸数字 1~9 为保留键）。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SHORTCUT_DEFINITIONS.map((definition) => {
            const value = resolveShortcut(definition.action, settings);
            return (
              <div
                key={definition.action}
                className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                  isDark
                    ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {definition.label}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {definition.description}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold tracking-wider border ${
                      recordingTarget === definition.action
                        ? 'bg-sky-500/20 border-sky-500 text-sky-400 animate-pulse'
                        : isDark
                        ? 'bg-slate-900 border-slate-700 text-sky-400'
                        : 'bg-white border-slate-200 text-sky-600'
                    }`}
                  >
                    {recordingTarget === definition.action ? '按下按键中...' : value}
                  </div>

                  <button
                    onClick={() => setRecordingTarget(definition.action)}
                    disabled={recordingTarget !== null}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                      recordingTarget === definition.action
                        ? 'bg-amber-500 text-white'
                        : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm shadow-sky-500/20'
                    }`}
                  >
                    {recordingTarget === definition.action ? '正在录制...' : '点击录制'}
                  </button>
                  {value && (
                    <button
                      onClick={() => onClearShortcut(definition.action)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      禁用
                    </button>
                  )}


                  {value !== definition.defaultValue && (
                    <button
                      onClick={() => onRestoreDefault(definition.action)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      恢复默认
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cheatsheet */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <h2
          className={`text-sm font-semibold ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          HUD 键盘流全景速查表
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {SHORTCUT_DEFINITIONS.map((definition) => (
            <div
              key={definition.action}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                isDark
                  ? 'bg-slate-900/60 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className="text-slate-400 font-medium">{definition.label}</span>
              <kbd className="shrink-0 px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
                {resolveShortcut(definition.action, settings)}
              </kbd>
            </div>
          ))}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-400 font-medium">直达核心亮点 (1~9)</span>
            <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
              1 ~ 9
            </kbd>
          </div>
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-400 font-medium">退出浮层 (无打扰)</span>
            <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
