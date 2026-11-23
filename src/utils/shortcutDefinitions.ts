import type { UserSettings } from '../types/settings';

export type ShortcutAction =
  | 'toggle'
  | 'quickNote'
  | 'prev'
  | 'next'
  | 'quotes'
  | 'refresh'
  | 'copyMarkdown'
  | 'searchTranscript'
  | 'help'
  | 'prevView'
  | 'nextView'
  | 'prevHighlightArrow'
  | 'nextHighlightArrow';

export type ShortcutSettingKey =
  | 'shortcutToggle'
  | 'shortcutQuickNote'
  | 'shortcutPrevNode'
  | 'shortcutNextNode'
  | 'shortcutToggleQuotes'
  | 'shortcutRefresh'
  | 'shortcutCopyMarkdown'
  | 'shortcutSearchTranscript'
  | 'shortcutHelp'
  | 'shortcutPrevView'
  | 'shortcutNextView'
  | 'shortcutPrevHighlightArrow'
  | 'shortcutNextHighlightArrow';

export interface ShortcutDefinition {
  action: ShortcutAction;
  label: string;
  description: string;
  settingKey: ShortcutSettingKey;
  defaultValue: string;
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    action: 'toggle',
    label: '呼出 / 隐藏 HUD',
    description: '在 B 站视频播放页快速呼出或隐藏 AI 总结浮层。',
    settingKey: 'shortcutToggle',
    defaultValue: 'Alt+S',
  },
  {
    action: 'quickNote',
    label: '一键截图并插入时间戳至 B 站笔记',
    description: '自动唤起 B 站笔记，插入原生时间戳并抓取当前画面截图。',
    settingKey: 'shortcutQuickNote',
    defaultValue: 'Alt+N',
  },
  {
    action: 'prev',
    label: '上一个亮点节点',
    description: '回退至上一个关键时间点并定位播放。',
    settingKey: 'shortcutPrevNode',
    defaultValue: 'K',
  },
  {
    action: 'next',
    label: '下一个亮点节点',
    description: '前进至下一个关键时间点并定位播放。',
    settingKey: 'shortcutNextNode',
    defaultValue: 'J',
  },
  {
    action: 'quotes',
    label: '展开 / 收起当前节点字幕依据',
    description: '查看当前亮点对应的原文字幕并开启声画同步。',
    settingKey: 'shortcutToggleQuotes',
    defaultValue: 'O',
  },
  {
    action: 'refresh',
    label: '刷新当前视图',
    description: '手动生成 / 重新提炼总结，或重新加载字幕与社区精选。',
    settingKey: 'shortcutRefresh',
    defaultValue: 'Alt+R',
  },
  {
    action: 'copyMarkdown',
    label: '复制 Markdown 笔记',
    description: '将当前总结与感悟复制为 Markdown 文本。',
    settingKey: 'shortcutCopyMarkdown',
    defaultValue: 'Alt+C',
  },
  {
    action: 'searchTranscript',
    label: '搜索全文字幕',
    description: '在全文字幕视图聚焦搜索框。',
    settingKey: 'shortcutSearchTranscript',
    defaultValue: '/',
  },
  {
    action: 'help',
    label: '打开 / 关闭快捷键帮助',
    description: '在 HUD 内查看所有实时快捷键与键盘操作提示。',
    settingKey: 'shortcutHelp',
    defaultValue: 'Alt+H',
  },
  {
    action: 'prevView',
    label: '上一个 HUD 视图',
    description: '循环切换到上一个视图（要点 / 字幕 / 社区）。',
    settingKey: 'shortcutPrevView',
    defaultValue: '[',
  },
  {
    action: 'prevHighlightArrow',
    label: '上一个亮点节点（方向键）',
    description: 'HUD 展开时按 ↑ 导航上一个亮点，并阻止 B 站播放器调高音量。',
    settingKey: 'shortcutPrevHighlightArrow',
    defaultValue: 'ArrowUp',
  },
  {
    action: 'nextHighlightArrow',
    label: '下一个亮点节点（方向键）',
    description: 'HUD 展开时按 ↓ 导航下一个亮点，并阻止 B 站播放器调低音量。',
    settingKey: 'shortcutNextHighlightArrow',
    defaultValue: 'ArrowDown',
  },
  {
    action: 'nextView',
    label: '下一个 HUD 视图',
    description: '循环切换到下一个视图（要点 / 字幕 / 社区）。',
    settingKey: 'shortcutNextView',
    defaultValue: ']',
  },
];

const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const;
const MODIFIER_ALIASES: Record<string, string> = {
  control: 'ctrl',
  option: 'alt',
  cmd: 'meta',
  command: 'meta',
};

export function resolveShortcut(action: ShortcutAction, settings: UserSettings): string {
  const definition = SHORTCUT_DEFINITIONS.find((item) => item.action === action);
  if (!definition) return '';
  const configured = settings[definition.settingKey];
  return typeof configured === 'string' ? configured : definition.defaultValue;
}

function normalizeBinding(binding: string): string {
  const tokens = binding
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .map((token) => MODIFIER_ALIASES[token] ?? token);
  const modifiers = MODIFIER_ORDER.filter((modifier) => tokens.includes(modifier));
  const keys = tokens
    .filter((token) => !MODIFIER_ORDER.includes(token as (typeof MODIFIER_ORDER)[number]))
    .filter(Boolean)
    .sort();
  return [...modifiers, ...keys].join('+');
}

export type ShortcutBindingResult =
  | { ok: true }
  | { ok: false; reason: 'reserved' | 'conflict'; message: string };

export function validateShortcutBinding({
  action,
  binding,
  settings,
}: {
  action: ShortcutAction;
  binding: string;
  settings: UserSettings;
}): ShortcutBindingResult {
  const normalized = normalizeBinding(binding);
  const parts = normalized.split('+').filter(Boolean);
  const hasModifier = parts.some((part) => MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number]));
  const keys = parts.filter((part) => !MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number]));

  // 录制器收到的空格键是 ' '，trim 后为空片段，同样视为保留键。
  if (binding.split('+').some((part) => part.length > 0 && part.trim().length === 0)) {
    return {
      ok: false,
      reason: 'reserved',
      message: '空格键保留用于键盘激活按钮，不能绑定为快捷键',
    };
  }
  if (keys.includes('escape')) {
    return {
      ok: false,
      reason: 'reserved',
      message: 'Escape 键保留用于取消录制和关闭浮层，不能绑定为快捷键',
    };
  }
  if (keys.some((key) => ['tab', 'enter'].includes(key))) {
    return {
      ok: false,
      reason: 'reserved',
      message: 'Tab / Enter 键保留用于焦点导航，不能绑定为快捷键',
    };
  }
  if (!hasModifier && keys.length === 1 && /^[1-9]$/.test(keys[0])) {
    return {
      ok: false,
      reason: 'reserved',
      message: '裸数字 1~9 保留用于快速跳转亮点，不能绑定为快捷键',
    };
  }

  for (const definition of SHORTCUT_DEFINITIONS) {
    if (definition.action === action || definition.action === 'prevHighlightArrow' || definition.action === 'nextHighlightArrow') continue;
    if (normalizeBinding(resolveShortcut(definition.action, settings)) !== normalized) continue;
    return {
      ok: false,
      reason: 'conflict',
      message: `该组合已被「${definition.label}」占用（${resolveShortcut(definition.action, settings)}），请换一个组合`,
    };
  }

  return { ok: true };
}
