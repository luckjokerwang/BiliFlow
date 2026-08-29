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
  Plus,
  Trash2,
  Activity,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Sun,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { ProviderConfig, UserSettings, ExtensionResponse, ThemeMode } from '../../types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from '../../constants';

type TabType = 'providers' | 'shortcuts' | 'backup';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabType>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('sensenova');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);
  const [fetchingModels, setFetchingModels] = useState<boolean>(false);
  const [fetchModelMsg, setFetchModelMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');

  // Load Settings
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res.success && res.data) {
          setSettings(res.data);
          if (res.data.activeProviderId) {
            setSelectedProviderId(res.data.activeProviderId);
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    })();
  }, []);

  const triggerToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2200);
  };

  const saveSettings = async (newSettings: UserSettings, toastText = '配置已自动同步') => {
    setSettings(newSettings);
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: newSettings,
      });
      triggerToast(toastText);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const isDark = settings.theme !== 'light';

  const toggleTheme = () => {
    const nextTheme: ThemeMode = isDark ? 'light' : 'dark';
    saveSettings({ ...settings, theme: nextTheme }, `已切换为 ${nextTheme === 'light' ? '浅色' : '暗色'} 主题`);
  };

  const selectedProvider =
    settings.providers.find((p) => p.id === selectedProviderId) ||
    settings.providers[0] ||
    DEFAULT_PROVIDERS[0];

  const updateSelectedProvider = (partial: Partial<ProviderConfig>) => {
    const updatedProviders = settings.providers.map((p) =>
      p.id === selectedProvider.id ? { ...p, ...partial } : p
    );
    const updatedSettings: UserSettings = {
      ...settings,
      providers: updatedProviders,
      ...(selectedProvider.id === settings.activeProviderId && partial.selectedModel
        ? { activeModel: partial.selectedModel }
        : {}),
    };
    saveSettings(updatedSettings);
  };

  // Test Provider Connection (Ping)
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res: ExtensionResponse<{
        success: boolean;
        latencyMs: number;
        error?: string;
      }> = await chrome.runtime.sendMessage({
        type: 'TEST_PROVIDER_CONNECTION',
        payload: {
          baseUrl: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey,
          model: selectedProvider.selectedModel || selectedProvider.models[0],
        },
      });

      if (res.success && res.data) {
        setTestResult(res.data);
      } else {
        setTestResult({
          success: false,
          latencyMs: 0,
          error: res.error || '测试请求失败',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: e?.message || '连接失败',
      });
    } finally {
      setTesting(false);
    }
  };

  // Fetch Models via /v1/models
  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchModelMsg(null);
    try {
      const res: ExtensionResponse<string[]> = await chrome.runtime.sendMessage({
        type: 'FETCH_PROVIDER_MODELS',
        payload: {
          baseUrl: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey,
        },
      });

      if (res.success && res.data && res.data.length > 0) {
        const fetched = res.data;
        updateSelectedProvider({
          models: fetched,
          selectedModel: fetched.includes(selectedProvider.selectedModel)
            ? selectedProvider.selectedModel
            : fetched[0],
        });
        setFetchModelMsg({ text: `成功获取 ${fetched.length} 个可用模型！`, isError: false });
      } else {
        setFetchModelMsg({ text: `拉取失败: ${res.error || '返回列表为空'}`, isError: true });
      }
    } catch (e: any) {
      setFetchModelMsg({ text: `拉取异常: ${e?.message || '请求失败'}`, isError: true });
    } finally {
      setFetchingModels(false);
      setTimeout(() => setFetchModelMsg(null), 4000);
    }
  };

  // Set Active Provider
  const handleSetActiveProvider = (pId: string) => {
    const target = settings.providers.find((p) => p.id === pId);
    if (!target) return;
    saveSettings(
      {
        ...settings,
        activeProviderId: pId,
        activeModel: target.selectedModel || target.models[0] || '',
      },
      `已将【${target.name}】设为当前使用厂商`
    );
  };

  // Add Custom Provider
  const handleAddCustomProvider = () => {
    const newId = `custom_${Date.now()}`;
    const newProvider: ProviderConfig = {
      id: newId,
      name: '自定义大模型厂商',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      enabled: true,
      models: ['gpt-4o-mini', 'deepseek-chat'],
      selectedModel: 'gpt-4o-mini',
      isCustom: true,
      icon: '✨',
    };

    const updated = [...settings.providers, newProvider];
    setSelectedProviderId(newId);
    saveSettings({ ...settings, providers: updated }, '已创建自定义厂商');
  };

  // Delete Custom Provider
  const handleDeleteProvider = (pId: string) => {
    const updated = settings.providers.filter((p) => p.id !== pId);
    let nextActiveId = settings.activeProviderId;
    if (nextActiveId === pId) {
      nextActiveId = updated[0]?.id || 'deepseek';
    }
    setSelectedProviderId(nextActiveId);
    saveSettings(
      {
        ...settings,
        providers: updated,
        activeProviderId: nextActiveId,
      },
      '已删除该厂商'
    );
  };

  // Keyboard shortcut recorder
  useEffect(() => {
    if (!recordingKey) return;

    const handleKeydown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const keys: string[] = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');

      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      keys.push(keyName);

      const combo = keys.join('+');
      saveSettings({ ...settings, shortcutToggle: combo }, `快捷键已更新为: ${combo}`);
      setRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [recordingKey, settings]);

  // Export / Import
  const handleExportConfig = () => {
    const jsonStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biliflow-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('配置已成功导出为 JSON 文件');
  };

  const handleImportConfig = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.providers && Array.isArray(parsed.providers)) {
        saveSettings(parsed, '配置已成功恢复！');
        setImportJsonText('');
      } else {
        alert('导入失败：JSON 格式不符合规范，缺少 providers 数组。');
      }
    } catch (err: any) {
      alert(`导入异常: ${err.message}`);
    }
  };

  const filteredModels = (selectedProvider.models || []).filter((m) =>
    m.toLowerCase().includes(modelSearchQuery.trim().toLowerCase())
  );

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#080d1a] text-slate-100' : 'bg-[#f4f6fb] text-slate-800'
      }`}
    >
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-6 right-8 z-50 flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white text-xs font-semibold rounded-2xl shadow-xl shadow-sky-500/25 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* Left Sidebar */}
      <div
        className={`w-72 flex flex-col justify-between shrink-0 border-r transition-colors ${
          isDark
            ? 'bg-[#0f172a]/95 border-slate-800/80 text-slate-200'
            : 'bg-white border-slate-200 text-slate-700 shadow-sm'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Header Brand + Theme Switch */}
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h1
                  className={`text-base font-bold tracking-tight flex items-center gap-1.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  BiliFlow
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500">
                    v0.2.0
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">极速心流 · 设置中心</p>
              </div>
            </div>

            {/* Light / Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
              title={isDark ? '切换为明亮模式 (Light)' : '切换为暗黑模式 (Dark)'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="space-y-1 pt-1">
            <button
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'providers'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>模型服务商 (Providers)</span>
            </button>

            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>快捷键与交互 (Shortcuts)</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileJson className="w-4 h-4" />
              <span>配置备份与恢复 (Backup)</span>
            </button>
          </div>

          {/* Provider List Navigation */}
          {activeTab === 'providers' && (
            <div
              className={`pt-3 border-t space-y-2 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
                <span>厂商列表 ({settings.providers.length})</span>
                <button
                  onClick={handleAddCustomProvider}
                  className="flex items-center gap-1 text-sky-500 hover:text-sky-400 transition-colors cursor-pointer"
                  title="添加自定义 OpenAI 兼容接口"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加厂商</span>
                </button>
              </div>

              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                {settings.providers.map((p) => {
                  const isSelected = p.id === selectedProvider.id;
                  const isActive = p.id === settings.activeProviderId;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? isDark
                            ? 'bg-slate-800/90 border-sky-500/60 text-white shadow-sm'
                            : 'bg-sky-50/80 border-sky-400/80 text-sky-900 shadow-sm'
                          : isDark
                          ? 'bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{p.icon || '⚡'}</span>
                        <div className="truncate">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {p.name}
                            {isActive && (
                              <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-500 font-bold">
                                当前
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[10px] truncate font-mono ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {p.selectedModel || p.models[0]}
                          </div>
                        </div>
                      </div>

                      {p.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProvider(p.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all"
                          title="删除此厂商"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          className={`p-4 border-t text-[11px] space-y-0.5 ${
            isDark
              ? 'border-slate-800/80 text-slate-500'
              : 'border-slate-200 text-slate-400 bg-slate-50/50'
          }`}
        >
          <p className="font-medium">BiliFlow 设置工作台</p>
          <p className="text-[10px] font-mono">BYOK · 所有数据严格存储于本地</p>
        </div>
      </div>

      {/* Right Main Dashboard */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        {/* TAB 1: PROVIDERS & MODEL HUB (High density 2-column layout) */}
        {activeTab === 'providers' && (
          <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
            {/* Top Provider Hero Banner */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200 shadow-slate-100'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-700 text-white'
                      : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {selectedProvider.icon || '⚡'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      disabled={!selectedProvider.isCustom}
                      value={selectedProvider.name}
                      onChange={(e) => updateSelectedProvider({ name: e.target.value })}
                      className={`text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-400 focus:border-sky-500 focus:outline-none transition-colors ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    />
                    {selectedProvider.id === settings.activeProviderId ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" /> 正在使用
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActiveProvider(selectedProvider.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
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
                    配置并管理该厂商的 API 连接与可用模型
                  </p>
                </div>
              </div>

              {selectedProvider.docUrl && (
                <a
                  href={selectedProvider.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 transition-colors"
                >
                  <span>获取 Key / 官网</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* 2-Column Responsive Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Column 1: Connection & Authentication (5 Cols) */}
              <div
                className={`lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between space-y-4 shadow-sm ${
                  isDark
                    ? 'bg-[#111a2e]/80 border-slate-800/80'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2.5 border-slate-700/40">
                    <h2
                      className={`text-sm font-semibold flex items-center gap-2 ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4 text-sky-500" />
                      <span>连接与认证 (Connection)</span>
                    </h2>
                  </div>

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
                          updateSelectedProvider({ apiKey: e.target.value.trim() })
                        }
                        placeholder="sk-..."
                        className={`w-full px-3.5 py-2 pr-10 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
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
                        updateSelectedProvider({ baseUrl: e.target.value.trim() })
                      }
                      placeholder="https://token.sensenova.cn/v1"
                      className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                        isDark
                          ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400">
                      支持商汤、硅基流动、DeepSeek 或任意 OpenAI 兼容端点。
                    </p>
                  </div>
                </div>

                {/* Ping Connection Test Button & Diagnostics */}
                <div className="pt-2 space-y-2 border-t border-slate-700/40">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testing || !selectedProvider.apiKey}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 disabled:opacity-40'
                      }`}
                    >
                      <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                      <span>{testing ? '正在测试连接...' : '测试连通性 (Ping)'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-fade-in ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                      }`}
                    >
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">连通性正常</p>
                            <p className="text-[11px] opacity-90 font-mono">
                              响应延迟: {testResult.latencyMs} ms
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold">连接失败</p>
                            <p className="text-[11px] opacity-90 break-all">{testResult.error}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Model Management & Matrix (7 Cols) */}
              <div
                className={`lg:col-span-7 p-5 rounded-2xl border flex flex-col justify-between space-y-4 shadow-sm ${
                  isDark
                    ? 'bg-[#111a2e]/80 border-slate-800/80'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2.5 border-slate-700/40">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-sky-500" />
                      <h2
                        className={`text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        模型管理与矩阵 (Model Hub)
                      </h2>
                    </div>

                    <button
                      onClick={handleFetchModels}
                      disabled={fetchingModels || !selectedProvider.apiKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 text-xs font-semibold rounded-xl border border-sky-500/30 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${fetchingModels ? 'animate-spin' : ''}`}
                      />
                      <span>{fetchingModels ? '拉取中...' : '自动拉取模型列表'}</span>
                    </button>
                  </div>

                  {fetchModelMsg && (
                    <div
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                        fetchModelMsg.isError
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                      }`}
                    >
                      {fetchModelMsg.text}
                    </div>
                  )}

                  {/* Current Active Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">当前选定提炼模型</label>
                    <input
                      type="text"
                      value={selectedProvider.selectedModel}
                      onChange={(e) =>
                        updateSelectedProvider({ selectedModel: e.target.value.trim() })
                      }
                      placeholder="输入或选择模型名，如 SenseChat-5"
                      className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 transition-colors ${
                        isDark
                          ? 'bg-slate-900/90 border-slate-700/80 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  {/* Model Search & Chip Matrix */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">
                        可用模型标签 ({filteredModels.length}/{selectedProvider.models?.length || 0})
                      </span>
                      {selectedProvider.models && selectedProvider.models.length > 5 && (
                        <div className="relative w-44">
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="筛选模型..."
                            className={`w-full pl-6 pr-2 py-1 text-[11px] rounded-lg border focus:outline-none focus:border-sky-500 ${
                              isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          />
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        </div>
                      )}
                    </div>

                    <div
                      className={`flex flex-wrap gap-1.5 max-h-52 overflow-y-auto p-2 rounded-xl border ${
                        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {filteredModels.map((m) => {
                        const isModelActive = selectedProvider.selectedModel === m;
                        return (
                          <button
                            key={m}
                            onClick={() => updateSelectedProvider({ selectedModel: m })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                              isModelActive
                                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                                : isDark
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                      {filteredModels.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 w-full">
                          未匹配到模型，可点击右上角“自动拉取模型列表”或直接手动输入。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SHORTCUTS & INTERACTION */}
        {activeTab === 'shortcuts' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Global Shortcut Recorder */}
            <div
              className={`p-6 rounded-2xl border space-y-4 shadow-sm ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200'
              }`}
            >
              <h2
                className={`text-sm font-semibold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <Keyboard className="w-4 h-4 text-sky-500" />
                <span>自定义 HUD 唤起快捷键</span>
              </h2>
              <p className="text-xs text-slate-400">
                在 B 站任意视频播放页按下此快捷键，可毫秒级一键呼出 / 隐藏总结浮层。
              </p>

              <div className="flex items-center gap-4 pt-2">
                <div
                  className={`px-5 py-3 rounded-2xl font-mono text-base font-bold tracking-wider border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-sky-400'
                      : 'bg-slate-50 border-slate-200 text-sky-600'
                  }`}
                >
                  {recordingKey ? '请在键盘上按下组合键...' : settings.shortcutToggle}
                </div>

                <button
                  onClick={() => setRecordingKey(true)}
                  disabled={recordingKey}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer disabled:opacity-50"
                >
                  {recordingKey ? '正在录制中...' : '点击录制新快捷键'}
                </button>

                {settings.shortcutToggle !== 'Alt+S' && (
                  <button
                    onClick={() => saveSettings({ ...settings, shortcutToggle: 'Alt+S' }, '已恢复默认快捷键 Alt+S')}
                    className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    恢复默认 (Alt+S)
                  </button>
                )}
              </div>
            </div>

            {/* Cheatsheet */}
            <div
              className={`p-6 rounded-2xl border space-y-4 shadow-sm ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200'
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
                    {settings.shortcutToggle}
                  </kbd>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-medium">直达核心亮点</span>
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
                    J / K 或 ↑ / ↓
                  </kbd>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-medium">瞬间退场 (无打扰)</span>
                  <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BACKUP & DATA */}
        {activeTab === 'backup' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div
              className={`p-6 rounded-2xl border space-y-3 shadow-sm ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200'
              }`}
            >
              <h2
                className={`text-sm font-semibold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <Download className="w-4 h-4 text-sky-500" />
                <span>配置导出备份</span>
              </h2>
              <p className="text-xs text-slate-400">
                将当前全部厂商、自定义 API Key 与偏好设置导出为 JSON 文件。
              </p>
              <button
                onClick={handleExportConfig}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>导出配置 (.json)</span>
              </button>
            </div>

            <div
              className={`p-6 rounded-2xl border space-y-3 shadow-sm ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200'
              }`}
            >
              <h2
                className={`text-sm font-semibold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4 text-sky-500" />
                <span>导入配置文件 (Cherry Studio / JSON)</span>
              </h2>
              <p className="text-xs text-slate-400">粘贴 JSON 字符串一键导入：</p>
              <textarea
                rows={5}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='在此粘贴 {"providers": [...], "activeProviderId": "..."}...'
                className={`w-full p-3 rounded-xl text-xs font-mono border focus:outline-none focus:border-sky-500 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                onClick={handleImportConfig}
                disabled={!importJsonText.trim()}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 disabled:opacity-40'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 disabled:opacity-40'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>执行导入</span>
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-3">
              <h2 className="text-sm font-semibold text-rose-500">重置出厂配置</h2>
              <p className="text-xs text-rose-400">恢复出厂预设配置（将清空所有已填 Key）。</p>
              <button
                onClick={() => {
                  if (confirm('确定要重置所有设置回初始状态吗？此操作将清除自定义 Key。')) {
                    saveSettings(DEFAULT_SETTINGS, '已恢复系统出厂设置');
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                重置所有设置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
