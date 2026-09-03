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
  ShieldCheck,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { browser } from 'wxt/browser';
import { ProviderConfig, UserSettings, ExtensionResponse, ThemeMode } from '../../types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from '../../constants';
import { ProviderLogo } from '../../components/ProviderIcons';

type TabType = 'providers' | 'shortcuts' | 'backup';

interface TestResultMap {
  [providerId: string]: {
    success: boolean;
    latencyMs: number;
    error?: string;
  };
}

// Request host permissions if not already granted (especially for Firefox / Gecko MV3 & strict mode)
async function requestHostPermissions(): Promise<boolean> {
  try {
    if (browser.permissions?.contains && browser.permissions?.request) {
      const hasPerm = await browser.permissions.contains({
        origins: ['https://*/*', 'http://*/*'],
      });
      if (!hasPerm) {
        const granted = await browser.permissions.request({
          origins: ['https://*/*', 'http://*/*'],
        });
        return Boolean(granted);
      }
    }
    return true;
  } catch (e) {
    console.warn('Host permission check/request error:', e);
    return true;
  }
}

// Ensure clean slate: if a provider has never fetched remote models, its models pool must be empty
function migrateCleanSlate(settings: UserSettings): UserSettings {
  let modified = false;
  const cleanedProviders = (settings.providers || []).map((p) => {
    // If provider has no remoteModels recorded (never fetched via API), purge any old hardcoded models
    if (!p.remoteModels || p.remoteModels.length === 0) {
      if ((p.models && p.models.length > 0) || p.selectedModel || p.fallbackModel) {
        modified = true;
        return {
          ...p,
          models: [],
          remoteModels: [],
          selectedModel: '',
          fallbackModel: '',
        };
      }
    }
    return p;
  });

  if (modified) {
    return {
      ...settings,
      providers: cleanedProviders,
    };
  }
  return settings;
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabType>('providers');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  
  // Isolated async status per provider ID
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [fetchingProviderId, setFetchingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResultMap>({});

  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<'toggle' | 'prev' | 'next' | 'quotes' | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('');

  // Model Picker Modal State
  const [showModelPickerModal, setShowModelPickerModal] = useState<boolean>(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState<string>('');
  const [pickerSelectedModels, setPickerSelectedModels] = useState<string[]>([]);
  const [pickerFetchError, setPickerFetchError] = useState<string | null>(null);

  // Load & Migrate Settings on Mount
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await browser.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res && res.success && res.data) {
          const cleaned = migrateCleanSlate(res.data);
          setSettings(cleaned);
          if (cleaned.activeProviderId) {
            setSelectedProviderId(cleaned.activeProviderId);
          }
          // If cleaned legacy models, persist cleaned state
          if (cleaned !== res.data) {
            await browser.runtime.sendMessage({
              type: 'SAVE_SETTINGS',
              payload: cleaned,
            });
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    })();
  }, []);

  const triggerToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2400);
  };

  const saveSettings = async (newSettings: UserSettings, toastText = '配置已自动保存') => {
    setSettings(newSettings);
    try {
      await browser.runtime.sendMessage({
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
    saveSettings(
      { ...settings, theme: nextTheme },
      `已切换为 ${nextTheme === 'light' ? '柔和浅色' : '深邃暗色'} 模式`
    );
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

  // Test Provider Connection (Ping) with ISOLATED state per provider
  const handleTestConnection = async () => {
    const currentId = selectedProvider.id;
    setTestingProviderId(currentId);
    try {
      await requestHostPermissions();
      const res: ExtensionResponse<{
        success: boolean;
        latencyMs: number;
        error?: string;
      }> = await browser.runtime.sendMessage({
        type: 'TEST_PROVIDER_CONNECTION',
        payload: {
          baseUrl: selectedProvider.baseUrl,
          apiKey: selectedProvider.apiKey,
          model: selectedProvider.selectedModel || (selectedProvider.models && selectedProvider.models[0]),
        },
      });

      if (res && res.success && res.data) {
        setTestResults((prev) => ({
          ...prev,
          [currentId]: res.data,
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [currentId]: {
            success: false,
            latencyMs: 0,
            error: res?.error || '测试请求失败',
          },
        }));
      }
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [currentId]: {
          success: false,
          latencyMs: 0,
          error: e?.message || '网络连接超时或无法访问该地址',
        },
      }));
    } finally {
      setTestingProviderId((prev) => (prev === currentId ? null : prev));
    }
  };

  // Open Model Picker & Pull Models from API
  const handleOpenModelPicker = async (forceFetch = false) => {
    const currentId = selectedProvider.id;
    setPickerSelectedModels([...(selectedProvider.models || [])]);
    setPickerFetchError(null);
    setShowModelPickerModal(true);

    if (forceFetch || !selectedProvider.remoteModels || selectedProvider.remoteModels.length === 0) {
      if (!selectedProvider.apiKey) {
        return;
      }
      setFetchingProviderId(currentId);
      try {
        await requestHostPermissions();
        const res: ExtensionResponse<string[]> = await browser.runtime.sendMessage({
          type: 'FETCH_PROVIDER_MODELS',
          payload: {
            baseUrl: selectedProvider.baseUrl,
            apiKey: selectedProvider.apiKey,
          },
        });

        if (res && res.success && res.data && res.data.length > 0) {
          const fetched = res.data;
          updateSelectedProvider({
            remoteModels: fetched,
            models:
              selectedProvider.models && selectedProvider.models.length > 0
                ? selectedProvider.models
                : fetched.slice(0, 3),
            selectedModel:
              selectedProvider.selectedModel || fetched[0],
            fallbackModel:
              selectedProvider.fallbackModel || fetched[1] || fetched[0],
          });
          setPickerSelectedModels(
            selectedProvider.models && selectedProvider.models.length > 0
              ? selectedProvider.models
              : fetched.slice(0, 3)
          );
          triggerToast(`成功获取 ${fetched.length} 个可用模型！`);
        } else {
          const errMsg = res?.error || '远程接口返回的模型列表为空或请求失败';
          setPickerFetchError(errMsg);
          triggerToast(`拉取失败: ${errMsg}`);
        }
      } catch (err: any) {
        const errMsg = err?.message || '网络连接超时或无法访问该地址';
        setPickerFetchError(errMsg);
        triggerToast(`拉取失败: ${errMsg}`);
        console.error('Fetch models error:', err);
      } finally {
        setFetchingProviderId((prev) => (prev === currentId ? null : prev));
      }
    }
  };

  // Save Picked Models to active model pool
  const handleSavePickedModels = () => {
    if (pickerSelectedModels.length === 0) {
      alert('请至少保留勾选 1 款模型作为可用模型！');
      return;
    }
    const nextSelected = pickerSelectedModels.includes(selectedProvider.selectedModel)
      ? selectedProvider.selectedModel
      : pickerSelectedModels[0];
    const nextFallback = pickerSelectedModels.includes(selectedProvider.fallbackModel || '')
      ? selectedProvider.fallbackModel
      : pickerSelectedModels[1] || nextSelected;

    updateSelectedProvider({
      models: pickerSelectedModels,
      selectedModel: nextSelected,
      fallbackModel: nextFallback,
    });
    setShowModelPickerModal(false);
    triggerToast(`已精选保存 ${pickerSelectedModels.length} 款模型至前端`);
  };

  // Add Custom Provider Directly (Inline without Pop-up Modal)
  const handleAddCustomProvider = () => {
    const newId = `custom_${Date.now()}`;
    const newProvider: ProviderConfig = {
      id: newId,
      name: '',
      baseUrl: '',
      apiKey: '',
      enabled: true,
      models: [],
      remoteModels: [],
      selectedModel: '',
      fallbackModel: '',
      isCustom: true,
      icon: '⚡',
    };

    const updated = [...settings.providers, newProvider];
    setSelectedProviderId(newId);
    saveSettings({ ...settings, providers: updated }, '已创建自定义厂商，请直接在右侧填写配置');
  };

  // Delete Provider
  const handleDeleteProvider = (pId: string) => {
    if (!confirm('确定要删除该厂商配置吗？')) return;
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

  // Global Keyboard shortcut recorder
  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeydown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingTarget(null);
        triggerToast('已取消快捷键录制');
        return;
      }

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

      if (recordingTarget === 'toggle') {
        saveSettings({ ...settings, shortcutToggle: combo }, `HUD 呼出快捷键已更新为: ${combo}`);
      } else if (recordingTarget === 'prev') {
        saveSettings({ ...settings, shortcutPrevNode: combo }, `上一个节点快捷键已更新为: ${combo}`);
      } else if (recordingTarget === 'next') {
        saveSettings({ ...settings, shortcutNextNode: combo }, `下一个节点快捷键已更新为: ${combo}`);
      } else if (recordingTarget === 'quotes') {
        saveSettings({ ...settings, shortcutToggleQuotes: combo }, `展开字幕快捷键已更新为: ${combo}`);
      }
      setRecordingTarget(null);
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [recordingTarget, settings]);

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

  const isCurrentTesting = testingProviderId === selectedProvider.id;
  const isCurrentFetching = fetchingProviderId === selectedProvider.id;
  const activeTestResult = testResults[selectedProvider.id];
  const allRemoteModels = selectedProvider.remoteModels || selectedProvider.models || [];
  const filteredRemoteModels = allRemoteModels.filter((m) =>
    m.toLowerCase().includes(pickerSearchQuery.trim().toLowerCase())
  );

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#080d1a] text-slate-100' : 'bg-[#f5f6f8] text-slate-800'
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
            : 'bg-white border-slate-200/80 text-slate-700 shadow-sm'
        }`}
      >
        <div className="p-4 space-y-4">
          {/* Header Brand + Theme Switch */}
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-3">
              <img
                src="/icons/icon-48.png"
                alt="BiliFlow Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-sm"
              />
              <div>
                <h1
                  className={`text-base font-bold tracking-tight flex items-center gap-1.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  BiliFlow
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500">
                    v1.1.7
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">极速心流 · 模型工作台</p>
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
              title={isDark ? '切换为柔和浅色模式 (Light)' : '切换为暗黑夜间模式 (Dark)'}
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
                  className="flex items-center gap-1 text-sky-500 hover:text-sky-400 font-medium transition-colors cursor-pointer"
                  title="添加自定义大模型厂商"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加厂商</span>
                </button>
              </div>

              <div className="space-y-1 max-h-[52vh] overflow-y-auto pr-1">
                {settings.providers.map((p) => {
                  const isSelected = p.id === selectedProvider.id;
                  const isActive = p.id === settings.activeProviderId;
                  const displayName = p.name || (p.isCustom ? '未命名自定义厂商' : p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? isDark
                            ? 'bg-slate-800/90 border-sky-500/60 text-white shadow-sm'
                            : 'bg-sky-50/90 border-sky-400/80 text-sky-900 shadow-sm font-semibold'
                          : isDark
                          ? 'bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 flex items-center justify-center">
                          <ProviderLogo providerId={p.id} icon={p.icon} className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {displayName}
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
                            {p.selectedModel || '未选定模型'}
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
          <p className="text-[10px] font-mono">BYOK · 0 远程上传 · 纯本地存储</p>
        </div>
      </div>

      {/* Right Main Dashboard */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        {/* TAB 1: UNIFIED TOP-TO-BOTTOM FULL WIDTH CARD */}
        {activeTab === 'providers' && (
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
                      onChange={(e) => updateSelectedProvider({ name: e.target.value })}
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
                          saveSettings(
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
                          updateSelectedProvider({ apiKey: e.target.value.trim() })
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
                        updateSelectedProvider({ baseUrl: e.target.value.trim() })
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
                    onClick={handleTestConnection}
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
                      onClick={() => handleOpenModelPicker(true)}
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
                        onClick={() => handleOpenModelPicker(false)}
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
                        updateSelectedProvider({ selectedModel: e.target.value.trim() })
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
                        updateSelectedProvider({ fallbackModel: e.target.value.trim() })
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
                      saveSettings(
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
                            onClick={() => updateSelectedProvider({ selectedModel: m })}
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
                          onClick={() => handleOpenModelPicker(true)}
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
        )}

        {/* TAB 2: SHORTCUTS & INTERACTION */}
        {activeTab === 'shortcuts' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Global Shortcut Recorders Grid */}
            <div
              className={`p-6 rounded-2xl border space-y-5 shadow-sm transition-colors ${
                isDark
                  ? 'bg-[#111a2e]/90 border-slate-800/80'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <h2
                  className={`text-sm font-semibold flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  <Keyboard className="w-4 h-4 text-sky-500" />
                  <span>自定义全键盘交互快捷键</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  自由改绑 HUD 浮层交互、节点步进及字幕依据展开快捷键。点击“录制”后直接按下按键即可（支持单键或组合键，按 Esc 可取消）。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    target: 'toggle' as const,
                    title: '一键呼出 / 隐藏总结面板 (HUD)',
                    desc: '在 B 站视频播放页快速呼出或隐藏 AI 总结浮层。',
                    value: settings.shortcutToggle || 'Alt+S',
                    defaultVal: 'Alt+S',
                    saveKey: 'shortcutToggle' as const,
                  },
                  {
                    target: 'next' as const,
                    title: '切换至下一个亮点节点',
                    desc: '向前步进下一个视频关键时间点并自动定位播放。',
                    value: settings.shortcutNextNode || 'J',
                    defaultVal: 'J',
                    saveKey: 'shortcutNextNode' as const,
                  },
                  {
                    target: 'prev' as const,
                    title: '切换至上一个亮点节点',
                    desc: '向后回退至上一个视频关键时间点并定位播放。',
                    value: settings.shortcutPrevNode || 'K',
                    defaultVal: 'K',
                    saveKey: 'shortcutPrevNode' as const,
                  },
                  {
                    target: 'quotes' as const,
                    title: '展开 / 收起当前节点字幕依据',
                    desc: '展开查看当前亮点对应的原文字幕并开启声画同步。',
                    value: settings.shortcutToggleQuotes || 'O',
                    defaultVal: 'O',
                    saveKey: 'shortcutToggleQuotes' as const,
                  },
                ].map((item) => (
                  <div
                    key={item.target}
                    className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                      isDark
                        ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</p>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold tracking-wider border ${
                          recordingTarget === item.target
                            ? 'bg-sky-500/20 border-sky-500 text-sky-400 animate-pulse'
                            : isDark
                            ? 'bg-slate-900 border-slate-700 text-sky-400'
                            : 'bg-white border-slate-200 text-sky-600'
                        }`}
                      >
                        {recordingTarget === item.target ? '按下按键中...' : item.value}
                      </div>

                      <button
                        onClick={() => setRecordingTarget(item.target)}
                        disabled={recordingTarget !== null}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                          recordingTarget === item.target
                            ? 'bg-amber-500 text-white'
                            : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm shadow-sky-500/20'
                        }`}
                      >
                        {recordingTarget === item.target ? '正在录制...' : '点击录制'}
                      </button>

                      {item.value !== item.defaultVal && (
                        <button
                          onClick={() =>
                            saveSettings(
                              { ...settings, [item.saveKey]: item.defaultVal },
                              `已恢复默认快捷键 ${item.defaultVal}`
                            )
                          }
                          className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                        >
                          恢复默认
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cheatsheet */}
            <div
              className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
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
                    {settings.shortcutToggle || 'Alt+S'}
                  </kbd>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-medium">直达核心亮点 (1~9)</span>
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
                    {settings.shortcutPrevNode || 'K'} / {settings.shortcutNextNode || 'J'}
                  </kbd>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-medium">展开 / 收起原文字幕依据</span>
                  <kbd className="px-2 py-1 rounded font-mono text-sky-500 font-bold bg-sky-500/10 border border-sky-500/20">
                    {settings.shortcutToggleQuotes || 'O'}
                  </kbd>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between md:col-span-2 ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-medium">退出浮层 (无打扰)</span>
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
              className={`p-6 rounded-2xl border space-y-3 shadow-sm transition-colors ${
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
              className={`p-6 rounded-2xl border space-y-3 shadow-sm transition-colors ${
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
              <p className="text-xs text-rose-400">恢复出厂预设配置（将清空所有已填 Key 与自定义模型）。</p>
              <button
                onClick={() => {
                  if (confirm('确定要重置所有设置回初始状态吗？此操作将清除自定义 Key 与模型池。')) {
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

      {/* ========================================================= */}
      {/* TWO-TIER MODEL PICKER MODAL (Cherry Studio Style) */}
      {/* ========================================================= */}
      {showModelPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-700/40 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-500" />
                  <span>管理【{selectedProvider.name || selectedProvider.id}】模型池</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  勾选需要展示在主界面的模型（已选 {pickerSelectedModels.length} 款 / 全部 {allRemoteModels.length} 款）
                </p>
              </div>

              <button
                onClick={() => setShowModelPickerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div
              className={`p-4 border-b flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  placeholder="搜索模型名称，如 flash, r1, deepseek..."
                  className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-sky-500 font-mono ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPickerSelectedModels(Array.from(new Set([...allRemoteModels])))
                  }
                  className="px-2.5 py-1 text-xs text-sky-500 hover:bg-sky-500/10 rounded-lg font-medium cursor-pointer"
                >
                  全选
                </button>
                <button
                  onClick={() => setPickerSelectedModels([])}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700/30 rounded-lg font-medium cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Model Checkbox List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {pickerFetchError && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 animate-fade-in ${
                    isDark
                      ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>拉取模型列表失败</span>
                    </div>
                    <button
                      onClick={() => handleOpenModelPicker(true)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-medium text-[11px] hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      重试拉取
                    </button>
                  </div>
                  <p className="text-[11px] font-mono opacity-90 break-all pl-6">
                    {pickerFetchError}
                  </p>
                  <div
                    className={`text-[11px] pl-6 space-y-0.5 border-t pt-2 ${
                      isDark ? 'border-rose-800/40 text-slate-400' : 'border-rose-200 text-slate-600'
                    }`}
                  >
                    <p>
                      • <strong>Firefox / Zen 浏览器</strong>：请在 <code>about:addons</code> -&gt; BiliFlow 详情 -&gt; “权限” 标签页，确认开启 <strong>“访问您在所有网站的数据”</strong> 开关。
                    </p>
                    <p>
                      • <strong>海外大模型</strong>（OpenAI / Gemini / OpenRouter）：请确保已开启科学上网代理并放行插件连接。
                    </p>
                  </div>
                </div>
              )}

              {filteredRemoteModels.length > 0 ? (
                filteredRemoteModels.map((m) => {
                  const isChecked = pickerSelectedModels.includes(m);
                  return (
                    <div
                      key={m}
                      onClick={() => {
                        if (isChecked) {
                          setPickerSelectedModels((prev) => prev.filter((item) => item !== m));
                        } else {
                          setPickerSelectedModels((prev) => [...prev, m]);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono cursor-pointer transition-colors ${
                        isChecked
                          ? isDark
                            ? 'bg-sky-950/40 border-sky-500/50 text-white'
                            : 'bg-sky-50 border-sky-300 text-sky-900 font-medium'
                          : isDark
                          ? 'bg-slate-900/30 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{m}</span>
                      <div className="shrink-0 ml-3">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-sky-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  {isCurrentFetching ? '正在从服务商拉取模型列表中...' : '未搜索到匹配的模型'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-700/40 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                已勾选 {pickerSelectedModels.length} 个模型
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowModelPickerModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSavePickedModels}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 cursor-pointer"
                >
                  保存精选模型
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
