import React, { useEffect, useState } from 'react';
import {
  Zap,
  Cpu,
  Settings,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { UserSettings, ExtensionResponse } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  // Load current settings & listen for live changes
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

    const handleStorageChange = (changes: any) => {
      if (changes.user_settings?.newValue) {
        setSettings(changes.user_settings.newValue);
      }
    };
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  const openOptionsPage = () => {
    if (chrome.runtime?.openOptionsPage) {
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

  const isDark = settings.theme !== 'light';

  if (loading) {
    return (
      <div
        className={`p-5 text-center text-xs ${
          isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'
        }`}
      >
        加载配置中...
      </div>
    );
  }

  const isConfigured = Boolean(activeProvider?.apiKey);

  return (
    <div
      className={`p-4 space-y-3.5 w-[340px] select-none transition-colors ${
        isDark ? 'bg-[#0f172a] text-slate-200' : 'bg-white text-slate-800'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b pb-2.5 ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h1
              className={`text-sm font-bold flex items-center gap-1.5 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              BiliFlow
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500 font-bold">
                v0.2.0
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">极速心流 · B站视频提炼</p>
          </div>
        </div>

        <button
          onClick={openOptionsPage}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="打开设置中心"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Provider Quick Switcher */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
          <span>当前活跃服务商</span>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Key 已就绪
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
              <AlertCircle className="w-3 h-3" /> 待填 Key
            </span>
          )}
        </label>
        <select
          value={settings.activeProviderId}
          onChange={(e) => handleSwitchProvider(e.target.value)}
          className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-sky-500 transition-colors ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
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
        <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-sky-500" />
          <span>提炼所用模型</span>
        </label>
        <select
          value={settings.activeModel || activeProvider.selectedModel}
          onChange={(e) => handleSwitchModel(e.target.value)}
          className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-sky-500 transition-colors ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
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
        className="w-full py-2.5 px-3.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
      >
        <Settings className="w-4 h-4" />
        <span>打开高级设置中心 (拉取模型 / 改快捷键)</span>
        <ExternalLink className="w-3 h-3" />
      </button>

      {/* Shortcut Quick Cheatsheet */}
      <div
        className={`p-2.5 border rounded-xl space-y-1.5 text-[10px] font-mono ${
          isDark
            ? 'bg-slate-800/40 border-slate-700/50 text-slate-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <span>呼出/隐藏 HUD:</span>
          <kbd
            className={`px-1.5 py-0.5 rounded border font-bold ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-sky-400'
                : 'bg-white border-slate-200 text-sky-600'
            }`}
          >
            {settings.shortcutToggle || 'Alt+S'}
          </kbd>
        </div>
        <div className="flex items-center justify-between opacity-80">
          <span>1~9: 直达节点 · J/K: 上下选择 · Esc: 退出</span>
        </div>
      </div>
    </div>
  );
};
