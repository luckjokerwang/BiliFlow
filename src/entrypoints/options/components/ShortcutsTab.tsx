import React from 'react';
import { Keyboard } from 'lucide-react';
import { UserSettings } from '../../../types';

export interface ShortcutsTabProps {
  isDark: boolean;
  settings: UserSettings;
  recordingTarget: 'toggle' | 'prev' | 'next' | 'quotes' | null;
  setRecordingTarget: (target: 'toggle' | 'prev' | 'next' | 'quotes' | null) => void;
  onSaveSettings: (newSettings: UserSettings, toastText?: string) => void;
}

export const ShortcutsTab: React.FC<ShortcutsTabProps> = ({
  isDark,
  settings,
  recordingTarget,
  setRecordingTarget,
  onSaveSettings,
}) => {
  const shortcutItems = [
    {
      target: 'toggle' as const,
      title: '一键呼出 / 隐藏总结面板 (HUD)',
      desc: '在 B 站视频播放页快速呼出或隐藏 AI 总结浮层。',
      value: settings.shortcutToggle || 'Alt+S',
      defaultVal: 'Alt+S',
      saveKey: 'shortcutToggle' as const,
    },
    {
      target: 'next' as const,
      title: '切换至下一个亮点节点',
      desc: '向前步进下一个视频关键时间点并自动定位播放。',
      value: settings.shortcutNextNode || 'J',
      defaultVal: 'J',
      saveKey: 'shortcutNextNode' as const,
    },
    {
      target: 'prev' as const,
      title: '切换至上一个亮点节点',
      desc: '向后回退至上一个视频关键时间点并定位播放。',
      value: settings.shortcutPrevNode || 'K',
      defaultVal: 'K',
      saveKey: 'shortcutPrevNode' as const,
    },
    {
      target: 'quotes' as const,
      title: '展开 / 收起当前节点字幕依据',
      desc: '展开查看当前亮点对应的原文字幕并开启声画同步。',
      value: settings.shortcutToggleQuotes || 'O',
      defaultVal: 'O',
      saveKey: 'shortcutToggleQuotes' as const,
    },
  ];

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
            自由改绑 HUD 浮层交互、节点步进及字幕依据展开快捷键。点击“录制”后直接按下按键即可（支持单键或组合键，按 Esc 可取消）。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcutItems.map((item) => (
            <div
              key={item.target}
              className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                isDark
                  ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {item.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold tracking-wider border ${
                    recordingTarget === item.target
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400 animate-pulse'
                      : isDark
                      ? 'bg-slate-900 border-slate-700 text-sky-400'
                      : 'bg-white border-slate-200 text-sky-600'
                  }`}
                >
                  {recordingTarget === item.target ? '按下按键中...' : item.value}
                </div>

                <button
                  onClick={() => setRecordingTarget(item.target)}
                  disabled={recordingTarget !== null}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                    recordingTarget === item.target
                      ? 'bg-amber-500 text-white'
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm shadow-sky-500/20'
                  }`}
                >
                  {recordingTarget === item.target ? '正在录制...' : '点击录制'}
                </button>

                {item.value !== item.defaultVal && (
                  <button
                    onClick={() =>
                      onSaveSettings(
                        { ...settings, [item.saveKey]: item.defaultVal },
                        `已恢复默认快捷键 ${item.defaultVal}`
                      )
                    }
                    className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    恢复默认
                  </button>
                )}
              </div>
            </div>
          ))}
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
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-400 font-medium">一键呼出 / 隐藏 HUD</span>
            <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
              {settings.shortcutToggle || 'Alt+S'}
            </kbd>
          </div>

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
            <span className="text-slate-400 font-medium">切换上一个 / 下一个节点</span>
            <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
              {settings.shortcutPrevNode || 'K'} / {settings.shortcutNextNode || 'J'}
            </kbd>
          </div>

          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-400 font-medium">展开 / 收起原文字幕依据</span>
            <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
              {settings.shortcutToggleQuotes || 'O'}
            </kbd>
          </div>

          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between md:col-span-2 ${
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
