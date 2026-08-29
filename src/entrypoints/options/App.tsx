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
  Sliders,
  CheckCircle2,
  AlertCircle,
  Radio,
  FileJson,
  Layers,
} from 'lucide-react';
import { ProviderConfig, UserSettings, ExtensionResponse } from '../../types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from '../../constants';

type TabType = 'providers' | 'shortcuts' | 'backup';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabType>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);
  const [fetchingModels, setFetchingModels] = useState<boolean>(false);
  const [fetchModelMsg, setFetchModelMsg] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [recordingKey, setRecordingKey] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

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

  const saveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: newSettings,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const selectedProvider =
    settings.providers.find((p) => p.id === selectedProviderId) ||
    settings.providers[0] ||
    DEFAULT_PROVIDERS[0];

  const updateSelectedProvider = (partial: Partial<ProviderConfig>) => {
    const updatedProviders = settings.providers.map((p) =>
      p.id === selectedProvider.id ? { ...p, ...partial } : p
    );
    const updatedSettings = {
      ...settings,
      providers: updatedProviders,
      // If updating active provider's selected model, sync activeModel
      ...(selectedProvider.id === settings.activeProviderId && partial.selectedModel
        ? { activeModel: partial.selectedModel }
        : {}),
    };
    saveSettings(updatedSettings);
  };

  // Test Provider Connection
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
        setFetchModelMsg(`成功拉取 ${fetched.length} 个模型！`);
      } else {
        setFetchModelMsg(`拉取失败: ${res.error || '未找到有效模型'}`);
      }
    } catch (e: any) {
      setFetchModelMsg(`拉取异常: ${e?.message || '请求失败'}`);
    } finally {
      setFetchingModels(false);
      setTimeout(() => setFetchModelMsg(null), 3000);
    }
  };

  // Set Active Provider
  const handleSetActiveProvider = (pId: string) => {
    const target = settings.providers.find((p) => p.id === pId);
    if (!target) return;
    saveSettings({
      ...settings,
      activeProviderId: pId,
      activeModel: target.selectedModel || target.models[0] || '',
    });
  };

  // Add Custom Provider
  const handleAddCustomProvider = () => {
    const newId = `custom_${Date.now()}`;
    const newProvider: ProviderConfig = {
      id: newId,
      name: '自定义厂商',
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
    saveSettings({ ...settings, providers: updated });
  };

  // Delete Custom Provider
  const handleDeleteProvider = (pId: string) => {
    const updated = settings.providers.filter((p) => p.id !== pId);
    let nextActiveId = settings.activeProviderId;
    if (nextActiveId === pId) {
      nextActiveId = updated[0]?.id || 'deepseek';
    }
    setSelectedProviderId(nextActiveId);
    saveSettings({
      ...settings,
      providers: updated,
      activeProviderId: nextActiveId,
    });
  };

  // Keyboard shortcut recorder
  useEffect(() => {
    if (!recordingKey) return;

    const handleKeydown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record modifier keys alone
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
      saveSettings({ ...settings, shortcutToggle: combo });
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
  };

  const handleImportConfig = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.providers && Array.isArray(parsed.providers)) {
        saveSettings(parsed);
        alert('配置导入成功！');
        setImportJsonText('');
      } else {
        alert('格式不正确，缺少 providers 字段');
      }
    } catch (err: any) {
      alert(`导入失败: ${err.message}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-5 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>配置已自动保存并生效</span>
        </div>
      )}

      {/* Left Sidebar */}
      <div className="w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-5">
          {/* Header Brand */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-lg shadow-sky-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                BiliFlow
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300">
                  v0.1.0
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">大模型管理与偏好设置</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'providers'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>模型服务商 (Providers)</span>
            </button>

            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>快捷键与交互 (Shortcuts)</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <FileJson className="w-4 h-4" />
              <span>备份与导入导出 (Backup)</span>
            </button>
          </div>

          {/* Providers List (Under Providers Tab) */}
          {activeTab === 'providers' && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-slate-400">
                <span>厂商列表</span>
                <button
                  onClick={handleAddCustomProvider}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                  title="添加自定义 OpenAI 兼容接口"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加</span>
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
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-sky-500/60 text-white shadow-sm'
                          : 'bg-slate-900/50 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base">{p.icon || '⚡'}</span>
                        <div className="truncate">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {p.name}
                            {isActive && (
                              <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                当前使用
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate font-mono">
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
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-all"
                          title="删除该厂商"
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
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
          <p>BiliFlow 扩展设置中心</p>
          <p className="text-[10px] font-mono text-slate-600">
            BYOK · 数据仅保留在本地 Chrome 存储
          </p>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 bg-slate-950 overflow-y-auto p-8 max-w-4xl">
        {/* TAB 1: PROVIDERS & MODELS */}
        {activeTab === 'providers' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Provider Header Card */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-slate-700">
                  {selectedProvider.icon || '⚡'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!selectedProvider.isCustom}
                      value={selectedProvider.name}
                      onChange={(e) => updateSelectedProvider({ name: e.target.value })}
                      className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-sky-500 focus:outline-none transition-colors"
                    />
                    {selectedProvider.id === settings.activeProviderId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> 当前活跃厂商
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetActiveProvider(selectedProvider.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                      >
                        设为当前使用
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    配置并选择该厂商的大语言模型用于提炼 B 站视频总结。
                  </p>
                </div>
              </div>

              {selectedProvider.docUrl && (
                <a
                  href={selectedProvider.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                >
                  获取 API Key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Connection & Key Form */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>连接参数配置</span>
              </h2>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-400" />
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
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Base URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>API 接口地址 (Base URL)</span>
                </label>
                <input
                  type="text"
                  value={selectedProvider.baseUrl}
                  onChange={(e) =>
                    updateSelectedProvider({ baseUrl: e.target.value.trim() })
                  }
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Test Button & Status */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !selectedProvider.apiKey}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-all cursor-pointer"
                >
                  <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? '正在测试连接...' : '测试连通性 (Ping)'}</span>
                </button>

                {testResult && (
                  <div
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>连接正常 · 延迟 {testResult.latencyMs}ms</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="truncate max-w-sm">{testResult.error}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Model Management Section */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    <span>模型选择与管理</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    从该厂商可用模型中选择或自动拉取最新模型列表
                  </p>
                </div>

                <button
                  onClick={handleFetchModels}
                  disabled={fetchingModels || !selectedProvider.apiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-medium rounded-xl border border-sky-500/30 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingModels ? 'animate-spin' : ''}`} />
                  <span>{fetchingModels ? '拉取中...' : '自动拉取模型列表'}</span>
                </button>
              </div>

              {fetchModelMsg && (
                <p className="text-xs font-medium text-sky-400 animate-fade-in">
                  {fetchModelMsg}
                </p>
              )}

              {/* Current Selected Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">当前使用模型</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedProvider.selectedModel}
                    onChange={(e) =>
                      updateSelectedProvider({ selectedModel: e.target.value.trim() })
                    }
                    placeholder="输入或选择模型名，如 deepseek-chat"
                    className="flex-1 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Available Model Chips / Dropdown */}
              {selectedProvider.models && selectedProvider.models.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    可用模型列表 ({selectedProvider.models.length} 个) · 点击快速选择:
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                    {selectedProvider.models.map((m) => {
                      const isModelActive = selectedProvider.selectedModel === m;
                      return (
                        <button
                          key={m}
                          onClick={() => updateSelectedProvider({ selectedModel: m })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                            isModelActive
                              ? 'bg-sky-500 text-white font-semibold shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SHORTCUTS & INTERACTION */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-sky-400" />
                <span>自定义全局呼出快捷键</span>
              </h2>
              <p className="text-xs text-slate-400">
                在 B 站视频播放页面按下此快捷键可一键切换 HUD 浮层的显隐。
              </p>

              <div className="flex items-center gap-4 pt-2">
                <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm text-sky-300 font-bold tracking-wide">
                  {recordingKey ? '请在键盘上按下目标快捷键...' : settings.shortcutToggle}
                </div>

                <button
                  onClick={() => setRecordingKey(true)}
                  disabled={recordingKey}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {recordingKey ? '正在录制...' : '点击录制新快捷键'}
                </button>

                {settings.shortcutToggle !== 'Alt+S' && (
                  <button
                    onClick={() => saveSettings({ ...settings, shortcutToggle: 'Alt+S' })}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    恢复默认 (Alt+S)
                  </button>
                )}
              </div>
            </div>

            {/* Shortcuts Cheatsheet */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white">HUD 键盘流交互表</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">一键呼出 / 隐藏 HUD</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded font-mono text-sky-300 border border-slate-700">
                    {settings.shortcutToggle}
                  </kbd>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">秒级跳转对应亮点 (1~9)</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded font-mono text-sky-300 border border-slate-700">
                    1 ~ 9
                  </kbd>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">上一个亮点 / 下一个亮点</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded font-mono text-sky-300 border border-slate-700">
                    J / K 或 ↑ / ↓
                  </kbd>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">快速退场 (心流不中断)</span>
                  <kbd className="px-2 py-1 bg-slate-800 rounded font-mono text-sky-300 border border-slate-700">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BACKUP & IMPORT/EXPORT */}
        {activeTab === 'backup' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-sky-400" />
                <span>配置备份与导出</span>
              </h2>
              <p className="text-xs text-slate-400">
                将你的所有厂商配置、自定义 API Key 与偏好设置导出为 JSON 文件进行安全备份。
              </p>
              <button
                onClick={handleExportConfig}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>导出全部配置 (.json)</span>
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>导入外部配置 (Cherry Studio / JSON)</span>
              </h2>
              <p className="text-xs text-slate-400">
                粘贴 JSON 配置文件一键恢复或导入多厂商设置：
              </p>
              <textarea
                rows={6}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='在此粘贴 {"providers": [...], "activeProviderId": "deepseek"}...'
                className="w-full p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 transition-colors"
              />
              <button
                onClick={handleImportConfig}
                disabled={!importJsonText.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>执行导入</span>
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-3">
              <h2 className="text-sm font-semibold text-rose-300">重置设置</h2>
              <p className="text-xs text-rose-200/80">
                将所有厂商预设与快捷键恢复为系统出厂初始状态。
              </p>
              <button
                onClick={() => {
                  if (confirm('确定要重置所有设置回初始状态吗？此操作将清除自定义 Key。')) {
                    saveSettings(DEFAULT_SETTINGS);
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                重置为默认配置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
