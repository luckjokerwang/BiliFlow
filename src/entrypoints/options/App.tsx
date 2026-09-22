import React, { useEffect, useState } from 'react';
import { Cpu, SlidersHorizontal, Keyboard, FileJson } from 'lucide-react';
import { browser } from 'wxt/browser';
import { ProviderConfig, UserSettings, ExtensionResponse, ThemeMode } from '../../types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from '../../constants';
import { mergeSettingsWithDefaults } from '../../services/settingsService';

import { OptionsHeader } from './components/OptionsHeader';
import { ProviderSidebarList } from './components/ProviderSidebarList';
import { ProviderConfigTab } from './components/ProviderConfigTab';
import { FeatureFlagsTab } from './components/FeatureFlagsTab';
import { ShortcutsTab } from './components/ShortcutsTab';
import { BackupRestoreTab } from './components/BackupRestoreTab';
import { ModelPickerModal } from './components/ModelPickerModal';

type TabType = 'providers' | 'features' | 'shortcuts' | 'backup';

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

  // Cache stats state
  const [cacheStats, setCacheStats] = useState<{
    count: number;
    totalEstimatedBytes: number;
    maxLimit: number;
  } | null>(null);
  const [clearingCache, setClearingCache] = useState<boolean>(false);

  const loadCacheStats = async () => {
    try {
      const res: ExtensionResponse<{
        count: number;
        totalEstimatedBytes: number;
        maxLimit: number;
      }> = await browser.runtime.sendMessage({
        type: 'GET_CACHE_STATS',
      });
      if (res && res.success && res.data) {
        setCacheStats(res.data);
      }
    } catch (e) {
      console.error('Failed to load cache stats:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      loadCacheStats();
    }
  }, [activeTab]);

  const handleClearCache = async () => {
    if (!confirm('确定要清理所有已缓存的视频总结吗？清理后再次访问这些视频将重新发起 AI 提炼。')) {
      return;
    }
    setClearingCache(true);
    try {
      const res: ExtensionResponse = await browser.runtime.sendMessage({
        type: 'CLEAR_CACHE',
      });
      if (res && res.success) {
        setCacheStats((prev) => (prev ? { ...prev, count: 0, totalEstimatedBytes: 0 } : null));
        triggerToast('已成功清理全部视频总结缓存');
      }
    } catch (e) {
      console.error('Failed to clear cache:', e);
    } finally {
      setClearingCache(false);
    }
  };

  // Load & Migrate Settings on Mount
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await browser.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res && res.success && res.data) {
          const merged = mergeSettingsWithDefaults(res.data);
          const cleaned = migrateCleanSlate(merged);
          setSettings(cleaned);
          if (cleaned.activeProviderId) {
            setSelectedProviderId(cleaned.activeProviderId);
          }
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

  // Test Provider Connection (Ping) with isolated state per provider
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

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#080d1a] text-slate-100' : 'bg-[#f5f6f8] text-slate-800'
      }`}
    >
      {/* Left Sidebar */}
      <div
        className={`w-72 flex flex-col justify-between shrink-0 border-r transition-colors ${
          isDark
            ? 'bg-[#0f172a]/95 border-slate-800/80 text-slate-200'
            : 'bg-white border-slate-200/80 text-slate-700 shadow-sm'
        }`}
      >
        <div className="p-4 space-y-4">
          <OptionsHeader
            isDark={isDark}
            onToggleTheme={toggleTheme}
            savedToast={savedToast}
          />

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
              onClick={() => setActiveTab('features')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'features'
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>功能与自动化 (Features)</span>
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
            <ProviderSidebarList
              isDark={isDark}
              providers={settings.providers}
              selectedProviderId={selectedProvider.id}
              activeProviderId={settings.activeProviderId}
              onSelectProvider={setSelectedProviderId}
              onAddCustomProvider={handleAddCustomProvider}
              onDeleteProvider={handleDeleteProvider}
            />
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
        {activeTab === 'providers' && (
          <ProviderConfigTab
            isDark={isDark}
            settings={settings}
            selectedProvider={selectedProvider}
            showApiKey={showApiKey}
            setShowApiKey={setShowApiKey}
            isCurrentTesting={isCurrentTesting}
            isCurrentFetching={isCurrentFetching}
            activeTestResult={activeTestResult}
            onUpdateSelectedProvider={updateSelectedProvider}
            onSaveSettings={saveSettings}
            onTestConnection={handleTestConnection}
            onOpenModelPicker={handleOpenModelPicker}
          />
        )}

        {activeTab === 'features' && (
          <FeatureFlagsTab
            isDark={isDark}
            settings={settings}
            onSaveSettings={saveSettings}
          />
        )}

        {activeTab === 'shortcuts' && (
          <ShortcutsTab
            isDark={isDark}
            settings={settings}
            recordingTarget={recordingTarget}
            setRecordingTarget={setRecordingTarget}
            onSaveSettings={saveSettings}
          />
        )}

        {activeTab === 'backup' && (
          <BackupRestoreTab
            isDark={isDark}
            settings={settings}
            importJsonText={importJsonText}
            setImportJsonText={setImportJsonText}
            cacheStats={cacheStats}
            clearingCache={clearingCache}
            onExportConfig={handleExportConfig}
            onImportConfig={handleImportConfig}
            onClearCache={handleClearCache}
            onLoadCacheStats={loadCacheStats}
            onResetFactory={() => {
              if (confirm('确定要重置所有设置回初始状态吗？此操作将清除自定义 Key 与模型池。')) {
                saveSettings(DEFAULT_SETTINGS, '已恢复系统出厂设置');
              }
            }}
          />
        )}
      </div>

      {/* Model Picker Modal */}
      <ModelPickerModal
        isDark={isDark}
        show={showModelPickerModal}
        selectedProvider={selectedProvider}
        pickerSelectedModels={pickerSelectedModels}
        setPickerSelectedModels={setPickerSelectedModels}
        pickerSearchQuery={pickerSearchQuery}
        setPickerSearchQuery={setPickerSearchQuery}
        pickerFetchError={pickerFetchError}
        isCurrentFetching={isCurrentFetching}
        onClose={() => setShowModelPickerModal(false)}
        onSave={handleSavePickedModels}
        onRetryFetch={() => handleOpenModelPicker(true)}
      />
    </div>
  );
};
