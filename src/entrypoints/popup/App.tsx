import React, { useEffect, useState } from 'react';
import {
  Zap,
  Cpu,
  Settings,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Keyboard,
} from 'lucide-react';
import { UserSettings, ExtensionResponse } from '../../types';
import { DEFAULT_SETTINGS } from '../background';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  // Load current settings
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res.success && res.data) {
          setSettings(res.data);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openOptionsPage = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const activeProvider =
    settings.providers.find((p) => p.id === settings.activeProviderId) ||
    settings.providers[0];

  const handleSwitchProvider = async (providerId: string) => {
    const target = settings.providers.find((p) => p.id === providerId);
    if (!target) return;

    const nextModel = target.selectedModel || target.models[0] || '';
    const updated: UserSettings = {
      ...settings,
      activeProviderId: providerId,
      activeModel: nextModel,
    };
    setSettings(updated);

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: updated,
    });
  };

  const handleSwitchModel = async (model: string) => {
    const updated: UserSettings = {
      ...settings,
      activeModel: model,
      providers: settings.providers.map((p) =>
        p.id === activeProvider.id ? { ...p, selectedModel: model } : p
      ),
    };
    setSettings(updated);

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: updated,
    });
  };

  if (loading) {
    return <div className="p-5 text-center text-xs text-slate-400">加载配置中...</div>;
  }

  const isConfigured = Boolean(activeProvider?.apiKey);

  return (
    <div className="p-4 space-y-3.5 text-slate-200 w-[340px] bg-slate-900 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-md shadow-sky-500/20">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              BiliFlow
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 font-normal">
                v0.1.0
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">极速心流 · B站视频提炼</p>
          </div>
        </div>

        <button
          onClick={openOptionsPage}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="打开完整设置面板"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Provider Quick Switcher */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
          <span>当前活跃服务商</span>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Key 已就绪
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
              <AlertCircle className="w-3 h-3" /> 待填 Key
            </span>
          )}
        </label>
        <select
          value={settings.activeProviderId}
          onChange={(e) => handleSwitchProvider(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
        >
          {settings.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon || '⚡'} {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Model Quick Switcher */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>提炼所用模型</span>
        </label>
        <select
          value={settings.activeModel || activeProvider.selectedModel}
          onChange={(e) => handleSwitchModel(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500 transition-colors"
        >
          {activeProvider.models?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Big Action: Open Full Options Page */}
      <button
        onClick={openOptionsPage}
        className="w-full py-2.5 px-3.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 active:scale-[0.98] text-white font-medium rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
      >
        <Settings className="w-4 h-4" />
        <span>打开高级设置 (拉取模型 / 改快捷键)</span>
        <ExternalLink className="w-3 h-3" />
      </button>

      {/* Shortcut Quick Cheatsheet */}
      <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-1.5 text-[10px] font-mono text-slate-400">
        <div className="flex items-center justify-between">
          <span>呼出/隐藏 HUD:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-sky-300 font-bold">
            {settings.shortcutToggle || 'Alt+S'}
          </kbd>
        </div>
        <div className="flex items-center justify-between">
          <span>1~9: 直达节点 · J/K: 上下选择 · Esc: 退出</span>
        </div>
      </div>
    </div>
  );
};
