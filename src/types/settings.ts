import { ProviderConfig, ThemeMode } from './index';

// ==========================================
// Feature Flags Matrix (统一功能开关矩阵)
// ==========================================

export interface FeatureFlags {
  // 自动化控制
  autoSummarize: boolean;        // 是否进入页面后自动总结（关闭时转为纯手动触发，HUD 展示醒目的“生成总结”按钮）
  minDurationForAutoSec: number; // 自动总结的最小视频时长阈值（单位：秒，默认 60s，短于此时长不自动总结以节约 Token）

  // 播放器进度条增强
  showTimelineMarkers: boolean;  // 是否在进度条轨道渲染高能亮点打点
  showHoverCard: boolean;        // 是否在鼠标悬浮时展示并排 AI 要点卡片

  // 交互与快捷键
  enableNumberKeySeek: boolean;  // 是否启用 1~9 数字按键快速跳转对应高能亮点
  autoFullscreenHud: boolean;    // 视频全屏时是否自动挂载侧边栏 HUD

  // 视觉与体验
  showToasts: boolean;           // 是否弹出跳转与提示气泡
  defaultHudOpen: boolean;       // 进入视频页时 HUD 默认展开还是收起
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  autoSummarize: true,
  minDurationForAutoSec: 60,
  showTimelineMarkers: true,
  showHoverCard: true,
  enableNumberKeySeek: true,
  autoFullscreenHud: true,
  showToasts: true,
  defaultHudOpen: false,
};

// ==========================================
// Complete User Settings Tree (完整用户设置)
// ==========================================

export interface UserSettings extends FeatureFlags {
  providers: ProviderConfig[];
  activeProviderId: string;
  activeModel?: string;
  enableFallback?: boolean;
  autoFetch?: boolean;           // 向下兼容保留字段（旧版 autoFetch 自动迁移到 autoSummarize）
  shortcutToggle?: string;
  shortcutPrevNode?: string;
  shortcutNextNode?: string;
  shortcutToggleQuotes?: string;
  theme?: ThemeMode;
}
