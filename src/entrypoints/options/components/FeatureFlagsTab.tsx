import React from 'react';
import {
  Zap,
  Clock,
  Activity,
  Eye,
  Keyboard,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import type { UserSettings, VideoCategoryKey } from '../../../types';
import { VIDEO_CATEGORY_ROOTS } from '../../../constants/videoCategories';
import { ToggleSwitch } from '../../../components/common/ToggleSwitch';
import { SliderInput } from '../../../components/common/SliderInput';

export interface FeatureFlagsTabProps {
  isDark: boolean;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings, toastText?: string) => void;
}

type AutoSummaryCategoryMode = UserSettings['autoSummaryCategoryMode'];

const CATEGORY_MODES: ReadonlyArray<{
  value: AutoSummaryCategoryMode;
  label: string;
  description: string;
}> = [
  { value: 'all', label: '全部自动', description: '所有视频按全局开关与时长规则自动总结' },
  { value: 'include', label: '仅选中分区', description: '只对白名单中的分区自动总结' },
  { value: 'exclude', label: '排除选中分区', description: '黑名单分区不自动总结，其他分区照常' },
];

export const FeatureFlagsTab: React.FC<FeatureFlagsTabProps> = ({
  isDark,
  settings,
  onSaveSettings,
}) => {
  const categoryMode = settings.autoSummaryCategoryMode ?? 'all';
  const selectedCategorySet = new Set<VideoCategoryKey>(settings.autoSummarizeCategories ?? []);

  const saveCategoryMode = (mode: AutoSummaryCategoryMode) => {
    const label = CATEGORY_MODES.find((item) => item.value === mode)?.label ?? mode;
    onSaveSettings(
      { ...settings, autoSummaryCategoryMode: mode },
      `自动总结规则已设为「${label}」`
    );
  };

  const toggleCategory = (key: VideoCategoryKey) => {
    const next = new Set<VideoCategoryKey>(settings.autoSummarizeCategories ?? []);
    const label = VIDEO_CATEGORY_ROOTS.find((item) => item.key === key)?.label ?? key;
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSaveSettings(
      { ...settings, autoSummarizeCategories: Array.from(next) },
      `已${next.has(key) ? '加入' : '移出'}「${label}」分区`
    );
  };

  const clearCategories = () => {
    onSaveSettings({ ...settings, autoSummarizeCategories: [] }, '已清空分区选择');
  };

  const categoryHint =
    categoryMode === 'include'
      ? selectedCategorySet.size === 0
        ? '不会自动总结任何视频，仍可手动生成。'
        : '仅上述分区会自动总结，其他分区可手动生成。'
      : selectedCategorySet.size === 0
        ? '不会排除任何分区，所有视频按全局规则自动总结。'
        : '上述分区不会自动总结，仍可手动生成。';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Section 1: Automation & Token Control */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2
            className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 text-sky-500" />
            <span>自动化与智能触发控制</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            控制扩展是否在打开 B 站视频时自动请求大模型分析，自主管理 Token 消耗。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <ToggleSwitch
            label="打开视频自动提炼总结"
            description="进入视频页后自动拉取字幕并生成结构化亮点。关闭后转为纯手动触发模式。"
            badge={settings.autoSummarize ? '自动提炼' : '手动按需'}
            checked={settings.autoSummarize}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, autoSummarize: val },
                `已${val ? '开启' : '关闭'}自动提炼总结`
              )
            }
            icon={<Zap className="w-4 h-4" />}
          />

          <SliderInput
            label="自动触发最短视频时长"
            description="短于此时长的短视频将忽略自动总结，以手动触发卡片形式呈现，避免浪费 Token。"
            unit="秒"
            min={0}
            max={300}
            step={10}
            value={settings.minDurationForAutoSec}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, minDurationForAutoSec: val },
                `最小触发时长已设为 ${val} 秒`
              )
            }
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

        {/* 分区自动总结策略（只影响自动触发，缓存读取与手动生成不受限） */}
        <div className="space-y-3">
          <div>
            <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              按分区控制自动总结
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              规则只限制自动生成；已缓存结果仍可读取，手动生成始终可用。
            </p>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-2.5"
            role="radiogroup"
            aria-label="自动总结分区规则"
          >
            {CATEGORY_MODES.map((mode) => {
              const active = categoryMode === mode.value;
              return (
                <label
                  key={mode.value}
                  className={`flex gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-sky-500/60 ${
                    active
                      ? isDark
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-sky-500 bg-sky-50'
                      : isDark
                        ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 hover:border-sky-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="autoSummaryCategoryMode"
                    value={mode.value}
                    checked={active}
                    onChange={() => saveCategoryMode(mode.value)}
                    className="mt-0.5 accent-sky-500"
                  />
                  <span className="space-y-0.5">
                    <span
                      className={`block text-xs font-semibold ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {mode.label}
                    </span>
                    <span className="block text-[11px] leading-4 text-slate-400">
                      {mode.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {categoryMode !== 'all' && (
            <div
              className={`rounded-xl border p-3.5 space-y-3 ${
                isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p
                    className={`text-xs font-medium ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {categoryMode === 'include' ? '自动总结白名单' : '自动总结排除名单'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    已选 {selectedCategorySet.size} 个分区
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCategories}
                  disabled={selectedCategorySet.size === 0}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/60 ${
                    selectedCategorySet.size === 0
                      ? isDark
                        ? 'cursor-not-allowed border-slate-700 text-slate-500'
                        : 'cursor-not-allowed border-slate-200 text-slate-400'
                      : isDark
                        ? 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-600 hover:border-sky-400 hover:bg-sky-50'
                  }`}
                >
                  清空选择
                </button>
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
                aria-label="主分区选择"
              >
                {VIDEO_CATEGORY_ROOTS.map(({ key, label }) => {
                  const selected = selectedCategorySet.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCategory(key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/60 ${
                        selected
                          ? isDark
                            ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                            : 'border-sky-500 bg-sky-50 text-sky-600'
                          : isDark
                            ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-700/60'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] leading-4 text-slate-400">{categoryHint}</p>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Player Timeline Enhancements */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2
            className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 text-sky-500" />
            <span>播放器进度条增强</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            控制进度条高能打点与鼠标划过时弹出的并排 AI 深度要点卡片。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <ToggleSwitch
            label="进度条高能亮点打点"
            description="在 B 站播放器进度条正中平齐嵌入经典亮蓝微条，直观标注高能时间戳。"
            checked={settings.showTimelineMarkers}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, showTimelineMarkers: val },
                `已${val ? '开启' : '关闭'}进度条高能打点`
              )
            }
            icon={<Activity className="w-4 h-4" />}
          />

          <ToggleSwitch
            label="鼠标划过展示并排 AI 卡片"
            description="鼠标在进度条滑动时，与 B 站原生画面缩略图并排展示 Slate-900 风格 AI 要点卡片。"
            checked={settings.showHoverCard}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, showHoverCard: val },
                `已${val ? '开启' : '关闭'}悬浮要点卡片`
              )
            }
            icon={<Eye className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Section 3: Interaction & Hotkeys */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
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
            <span>交互与按键响应</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            提升视频观看效率的高级快捷键与全屏适配选项。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <ToggleSwitch
            label="键盘数字键 1~9 秒切对应亮点"
            description="在观看视频时按下数字按键 1~9，即可瞬间定位跳转到对应亮点（打字时自动忽略）。"
            checked={settings.enableNumberKeySeek}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, enableNumberKeySeek: val },
                `已${val ? '开启' : '关闭'}数字键快速跳转`
              )
            }
            icon={<Keyboard className="w-4 h-4" />}
          />

          <ToggleSwitch
            label="全屏时自动挂载侧边栏 HUD"
            description="在普通全屏或网页全屏切换时，自动维护 HUD 宿主层级，保证浮层始终可用。"
            checked={settings.autoFullscreenHud}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, autoFullscreenHud: val },
                `已${val ? '开启' : '关闭'}全屏自动挂载`
              )
            }
            icon={<ShieldCheck className="w-4 h-4" />}
          />


          <ToggleSwitch
            label="HUD 收起后显示“心流”快捷按钮"
            description="默认关闭；开启后即使收起 HUD，也会在播放器右上角保留一个可点击的重新打开入口。"
            checked={settings.showClosedHudLauncher ?? false}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, showClosedHudLauncher: val },
                `已${val ? '开启' : '关闭'}收起态快捷按钮`
              )
            }
            icon={<Eye className="w-4 h-4" />}
          />
        </div>


      </div>

      {/* Section 4: Visual & UX */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <h2
            className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-sky-500" />
            <span>视觉反馈与默认状态</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            微调侧边栏显示方式与轻提示反馈气泡。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <ToggleSwitch
            label="操作与跳转 Toast 轻提示"
            description="执行快捷键跳转或刷新时，在页面顶部弹出轻量级成功反馈气泡。"
            checked={settings.showToasts}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, showToasts: val },
                `已${val ? '开启' : '关闭'}操作 Toast 提示`
              )
            }
            icon={<CheckCircle2 className="w-4 h-4" />}
          />

          <ToggleSwitch
            label="打开视频页默认展开 HUD"
            description="打开 B 站视频时，侧边栏 HUD 默认处于展开状态；关闭后默认隐藏，按快捷键展开。"
            checked={settings.defaultHudOpen}
            onChange={(val) =>
              onSaveSettings(
                { ...settings, defaultHudOpen: val },
                `已${val ? '开启' : '关闭'}进入视频默认展开`
              )
            }
            icon={<SlidersHorizontal className="w-4 h-4" />}
          />
        </div>
      </div>
    </div>
  );
};
