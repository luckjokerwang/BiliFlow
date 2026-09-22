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
import { UserSettings } from '../../../types';
import { ToggleSwitch } from '../../../components/common/ToggleSwitch';
import { SliderInput } from '../../../components/common/SliderInput';

export interface FeatureFlagsTabProps {
  isDark: boolean;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings, toastText?: string) => void;
}

export const FeatureFlagsTab: React.FC<FeatureFlagsTabProps> = ({
  isDark,
  settings,
  onSaveSettings,
}) => {
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
