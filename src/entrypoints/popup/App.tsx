import React, { useEffect, useState } from 'react';
import {
  Zap,
  Key,
  Globe,
  Cpu,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Keyboard,
  Info,
} from 'lucide-react';
import { LLMConfig, UserSettings, ExtensionResponse } from '../../types';

interface Preset {
  name: string;
  provider: 'deepseek' | 'gemini' | 'openai' | 'custom';
  baseUrl: string;
  model: string;
  docUrl: string;
}

const PRESETS: Preset[] = [
  {
    name: 'DeepSeek (官方)',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    docUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    name: 'SiliconFlow (硅基流动)',
    provider: 'custom',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    docUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    name: 'Google Gemini',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    name: 'OpenAI (官方)',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    docUrl: 'https://platform.openai.com/api-keys',
  },
  {
    name: '自定义 (Custom)',
    provider: 'custom',
    baseUrl: '',
    model: '',
    docUrl: '',
  },
];

export const App: React.FC = () => {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  });
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Load existing settings
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res.success && res.data?.llmConfig) {
          const loaded = res.data.llmConfig;
          setConfig(loaded);

          const presetIdx = PRESETS.findIndex(
            (p) => p.baseUrl === loaded.baseUrl && p.model === loaded.model
          );
          if (presetIdx !== -1) {
            setSelectedPresetIndex(presetIdx);
          } else {
            setSelectedPresetIndex(PRESETS.length - 1); // Custom
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    const preset = PRESETS[idx];
    if (preset.baseUrl || preset.model) {
      setConfig((prev) => ({
        ...prev,
        provider: preset.provider,
        baseUrl: preset.baseUrl,
        model: preset.model,
      }));
    }
  };

  const handleSave = async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: { llmConfig: config },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const currentPreset = PRESETS[selectedPresetIndex];

  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-400">加载配置中...</div>;
  }

  return (
    <div className="p-4 space-y-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">BiliFlow 设置</h1>
            <p className="text-[10px] text-slate-400">极速心流 · B站视频总结与导航</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          v0.1.0
        </span>
      </div>

      {/* Preset Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300">选择服务商 / 预设</label>
        <select
          value={selectedPresetIndex}
          onChange={(e) => handleSelectPreset(Number(e.target.value))}
          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
        >
          {PRESETS.map((p, idx) => (
            <option key={idx} value={idx}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-sky-400" />
            API Key
          </label>
          {currentPreset.docUrl && (
            <a
              href={currentPreset.docUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
            >
              获取 Key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value.trim() })}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-9 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          API 接口地址 (Base URL)
        </label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => setConfig({ ...config, baseUrl: e.target.value.trim() })}
          placeholder="https://api.deepseek.com/v1"
          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Model Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          模型名称 (Model)
        </label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value.trim() })}
          placeholder="deepseek-chat"
          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 cursor-pointer"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4 text-white" />
            <span>配置已保存！</span>
          </>
        ) : (
          <span>保存设置</span>
        )}
      </button>

      {/* Shortcuts Card */}
      <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-2 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Keyboard className="w-3.5 h-3.5 text-sky-400" />
          <span>常用键盘流快捷键</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-400">
          <div>
            <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
              Alt+S
            </kbd>{' '}
            呼出/隐藏 HUD
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
              1 ~ 9
            </kbd>{' '}
            直达对应亮点
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
              J / K
            </kbd>{' '}
            切换上下节点
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
              Esc
            </kbd>{' '}
            极速退场
          </div>
        </div>
      </div>
    </div>
  );
};
