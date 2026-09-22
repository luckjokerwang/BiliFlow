import React from 'react';
import { Download, Upload, Activity, RefreshCw, Trash2 } from 'lucide-react';
import { UserSettings } from '../../../types';

export interface BackupRestoreTabProps {
  isDark: boolean;
  settings: UserSettings;
  importJsonText: string;
  setImportJsonText: (text: string) => void;
  cacheStats: {
    count: number;
    totalEstimatedBytes: number;
    maxLimit: number;
  } | null;
  clearingCache: boolean;
  onExportConfig: () => void;
  onImportConfig: () => void;
  onClearCache: () => void;
  onLoadCacheStats: () => void;
  onResetFactory: () => void;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({
  isDark,
  importJsonText,
  setImportJsonText,
  cacheStats,
  clearingCache,
  onExportConfig,
  onImportConfig,
  onClearCache,
  onLoadCacheStats,
  onResetFactory,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Export Configuration Card */}
      <div
        className={`p-6 rounded-2xl border space-y-3 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
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
          onClick={onExportConfig}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>导出配置 (.json)</span>
        </button>
      </div>

      {/* Import Configuration Card */}
      <div
        className={`p-6 rounded-2xl border space-y-3 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
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
          onClick={onImportConfig}
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

      {/* Summary Cache Management Card */}
      <div
        className={`p-6 rounded-2xl border space-y-4 shadow-sm transition-colors ${
          isDark ? 'bg-[#111a2e]/90 border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2
            className={`text-sm font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 text-sky-500" />
            <span>视频总结缓存管理 (LRU 智能淘汰)</span>
          </h2>
          <button
            onClick={onLoadCacheStats}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="刷新缓存统计"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          为节约浏览器本地存储空间并防止配额溢出，BiliFlow 采用智能 LRU (Least Recently Used) 算法自动维护最近 100 条总结，超量时自动淘汰最久未访问条目。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-[11px] text-slate-400">已缓存视频数量</div>
            <div className="text-lg font-bold font-mono text-sky-500 mt-0.5">
              {cacheStats ? `${cacheStats.count} / ${cacheStats.maxLimit}` : '加载中...'}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-[11px] text-slate-400">估算存储占用</div>
            <div className="text-lg font-bold font-mono text-cyan-500 mt-0.5">
              {cacheStats
                ? cacheStats.totalEstimatedBytes < 1024
                  ? `${cacheStats.totalEstimatedBytes} B`
                  : cacheStats.totalEstimatedBytes < 1024 * 1024
                  ? `${(cacheStats.totalEstimatedBytes / 1024).toFixed(1)} KB`
                  : `${(cacheStats.totalEstimatedBytes / (1024 * 1024)).toFixed(2)} MB`
                : '加载中...'}
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center gap-3">
          <button
            onClick={onClearCache}
            disabled={clearingCache || !cacheStats || cacheStats.count === 0}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              isDark
                ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 disabled:opacity-40 disabled:cursor-not-allowed'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{clearingCache ? '正在清理...' : '立即清理全部视频总结缓存'}</span>
          </button>
        </div>
      </div>

      {/* Reset Factory Configuration */}
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-3">
        <h2 className="text-sm font-semibold text-rose-500">重置出厂配置</h2>
        <p className="text-xs text-rose-400">恢复出厂预设配置（将清空所有已填 Key 与自定义模型）。</p>
        <button
          onClick={onResetFactory}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          重置所有设置
        </button>
      </div>
    </div>
  );
};
