import React from 'react';
import {
  Check,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  Cpu,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ProviderConfig, UserSettings } from '../../../types';
import { ProviderLogo } from '../../../components/ProviderIcons';

export interface ProviderConfigTabProps {
  isDark: boolean;
  settings: UserSettings;
  selectedProvider: ProviderConfig;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
  isCurrentTesting: boolean;
  isCurrentFetching: boolean;
  activeTestResult?: {
    success: boolean;
    latencyMs: number;
    error?: string;
  };
  onUpdateSelectedProvider: (partial: Partial<ProviderConfig>) => void;
  onSaveSettings: (newSettings: UserSettings, toastText?: string) => void;
  onTestConnection: () => void;
  onOpenModelPicker: (forceFetch?: boolean) => void;
}

export const ProviderConfigTab: React.FC<ProviderConfigTabProps> = ({
  isDark,
  settings,
  selectedProvider,
  showApiKey,
  setShowApiKey,
  isCurrentTesting,
  isCurrentFetching,
  activeTestResult,
  onUpdateSelectedProvider,
  onSaveSettings,
  onTestConnection,
  onOpenModelPicker,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Top Provider Hero Banner */}
      <div
        className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-colors ${
          isDark
            ? 'bg-[#111a2e]/90 border-slate-800/80'
            : 'bg-white border-slate-200 shadow-slate-100'
        }`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border shrink-0 ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <ProviderLogo
              providerId={selectedProvider.id}
              icon={selectedProvider.icon}
              className="w-7 h-7"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <input
                type="text"
                disabled={!selectedProvider.isCustom}
                value={selectedProvider.name}
                onChange={(e) => onUpdateSelectedProvider({ name: e.target.value })}
                placeholder={selectedProvider.isCustom ? '点击输入自定义厂商名称...' : '厂商名称'}
                className={`text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-400 focus:border-sky-500 focus:outline-none transition-colors truncate max-w-sm ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              />
              {selectedProvider.id === settings.activeProviderId ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shrink-0">
                  <Check className="w-3.5 h-3.5" /> 正在使用
                </span>
              ) : (
                <button
                  onClick={() =>
                    onSaveSettings(
                      {
                        ...settings,
                        activeProviderId: selectedProvider.id,
                        activeModel:
                          selectedProvider.selectedModel ||
                          (selectedProvider.models && selectedProvider.models[0]) ||
                          '',
                      },
                      `已将【${selectedProvider.name || selectedProvider.id}】设为当前使用`
                    )
                  }
                  className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  设为当前使用
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              配置并管理该厂商的 API 连接、主用提炼模型与兜底容灾策略
            </p>
          </div>
        </div>

        {selectedProvider.docUrl && (
          <a
            href={selectedProvider.docUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 transition-colors shrink-0 ml-3"
          >
            <span>获取 Key / 官网</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* UNIFIED FULL-WIDTH CARD (Top to Bottom Flow) */}
      <div
        className={`p-6 rounded-2xl border space-y-6 shadow-sm transition-colors ${
          isDark
            ? 'bg-[#111a2e]/80 border-slate-800/80'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* SECTION 1: CONNECTION & AUTHENTICATION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-700/40">
            <h2
              className={`text-sm font-semibold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-sky-500" />
              <span>连接与认证 (Connection & Auth)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-500" />
                <span>API Key</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={selectedProvider.apiKey}
                  onChange={(e) =>
                    onUpdateSelectedProvider({ apiKey: e.target.value.trim() })
                  }
                  placeholder="sk-..."
                  className={`w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                    isDark
                      ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Base URL Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span>API 接口地址 (Base URL)</span>
              </label>
              <input
                type="text"
                value={selectedProvider.baseUrl}
                onChange={(e) =>
                  onUpdateSelectedProvider({ baseUrl: e.target.value.trim() })
                }
                placeholder="https://api.openai.com/v1 或 http://localhost:11434/v1"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Ping Connection Test Button & Diagnostics Inline */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <button
              onClick={onTestConnection}
              disabled={isCurrentTesting || !selectedProvider.apiKey}
              className={`flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 disabled:opacity-40'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${isCurrentTesting ? 'animate-spin' : ''}`} />
              <span>{isCurrentTesting ? '正在测试连接中...' : '测试连通性 (Ping)'}</span>
            </button>

            {activeTestResult && (
              <div
                className={`flex-1 p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-fade-in ${
                  activeTestResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                }`}
              >
                {activeTestResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">连通性正常</span>
                    <span className="opacity-90 font-mono text-[11px]">
                      · 响应延迟: {activeTestResult.latencyMs} ms
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold shrink-0">连接异常:</span>
                    <span className="opacity-90 break-all truncate text-[11px]">
                      {activeTestResult.error}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: TWO-TIER MODEL HUB & FALLBACK POLICY */}
        <div className="space-y-4 pt-4 border-t border-slate-700/40">
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-700/40">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-500" />
              <h2
                className={`text-sm font-semibold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                模型池与容灾策略 (Model Hub & Fallback)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenModelPicker(true)}
                disabled={isCurrentFetching || !selectedProvider.apiKey}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 text-xs font-semibold rounded-xl border border-sky-500/30 transition-all cursor-pointer disabled:opacity-40"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCurrentFetching ? 'animate-spin' : ''}`}
                />
                <span>{isCurrentFetching ? '拉取中...' : '自动拉取模型列表'}</span>
              </button>

              {selectedProvider.models && selectedProvider.models.length > 0 && (
                <button
                  onClick={() => onOpenModelPicker(false)}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl border border-slate-700/60 transition-all cursor-pointer"
                >
                  <span>管理 / 勾选模型池</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Model & Fallback Model Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>主用提炼模型 (Primary)</span>
                <span className="text-[10px] text-sky-500 font-semibold">首选</span>
              </label>
              <input
                type="text"
                value={selectedProvider.selectedModel}
                onChange={(e) =>
                  onUpdateSelectedProvider({ selectedModel: e.target.value.trim() })
                }
                placeholder="请先拉取模型或在此手动输入模型名"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Fallback Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>兜底备用模型 (Fallback)</span>
                <span className="text-[10px] text-amber-500 font-semibold">
                  报错时自动切换
                </span>
              </label>
              <input
                type="text"
                value={selectedProvider.fallbackModel || ''}
                onChange={(e) =>
                  onUpdateSelectedProvider({ fallbackModel: e.target.value.trim() })
                }
                placeholder="可选，故障时自动切换的备用模型名"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Fallback Failover Toggle */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold">自动容灾故障转移</p>
                <p className="text-[11px] text-slate-400">
                  当主用模型遭遇限流 (429)、余额不足 (402) 或服务器错误时，自动无感切换至兜底模型重试
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.enableFallback ?? true}
              onChange={(e) =>
                onSaveSettings(
                  { ...settings, enableFallback: e.target.checked },
                  e.target.checked ? '已开启故障自动容灾转移' : '已关闭故障自动容灾转移'
                )
              }
              className="w-4 h-4 accent-sky-500 cursor-pointer"
            />
          </div>

          {/* Curated Active Models Chips */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                精选激活模型标签 ({selectedProvider.models?.length || 0} 款 · 点击快速选为主模型)
              </span>
            </div>

            <div
              className={`flex flex-wrap gap-2 min-h-[90px] p-3 rounded-xl border ${
                isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {selectedProvider.models && selectedProvider.models.length > 0 ? (
                selectedProvider.models.map((m) => {
                  const isPrimary = selectedProvider.selectedModel === m;
                  const isFallback = selectedProvider.fallbackModel === m;

                  return (
                    <button
                      key={m}
                      onClick={() => onUpdateSelectedProvider({ selectedModel: m })}
                      className={`group relative px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                        isPrimary
                          ? 'bg-sky-500 text-white font-semibold shadow-sm'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>{m}</span>
                      {isPrimary && (
                        <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-bold">
                          主用
                        </span>
                      )}
                      {isFallback && !isPrimary && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.2 rounded font-bold">
                          兜底
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 w-full flex flex-col items-center justify-center gap-2">
                  <Cpu className="w-6 h-6 text-slate-500 opacity-60" />
                  <p className="font-medium text-slate-300">当前厂商尚未选择任何模型</p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    请在上方填入 API Key，然后点击【⚡ 自动拉取模型列表】一键拉取并勾选需要的模型，避免过时模型污染界面。
                  </p>
                  <button
                    onClick={() => onOpenModelPicker(true)}
                    disabled={!selectedProvider.apiKey}
                    className="mt-1 inline-flex items-center gap-1.5 px-4 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 text-sky-400 text-xs font-semibold rounded-xl border border-sky-500/30 transition-all cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isCurrentFetching ? 'animate-spin' : ''}`}
                    />
                    <span>{isCurrentFetching ? '正在拉取中...' : '点击拉取并勾选可用模型'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
