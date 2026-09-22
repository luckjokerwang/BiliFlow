import React from 'react';
import { Cpu, X, Search, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { ProviderConfig } from '../../../types';

export interface ModelPickerModalProps {
  isDark: boolean;
  show: boolean;
  selectedProvider: ProviderConfig;
  pickerSelectedModels: string[];
  setPickerSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
  pickerSearchQuery: string;
  setPickerSearchQuery: (query: string) => void;
  pickerFetchError: string | null;
  isCurrentFetching: boolean;
  onClose: () => void;
  onSave: () => void;
  onRetryFetch: () => void;
}

export const ModelPickerModal: React.FC<ModelPickerModalProps> = ({
  isDark,
  show,
  selectedProvider,
  pickerSelectedModels,
  setPickerSelectedModels,
  pickerSearchQuery,
  setPickerSearchQuery,
  pickerFetchError,
  isCurrentFetching,
  onClose,
  onSave,
  onRetryFetch,
}) => {
  if (!show) return null;

  const allRemoteModels = selectedProvider.remoteModels || selectedProvider.models || [];
  const filteredRemoteModels = allRemoteModels.filter((m) =>
    m.toLowerCase().includes(pickerSearchQuery.trim().toLowerCase())
  );

  return (
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
            onClick={onClose}
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
                  onClick={onRetryFetch}
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
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 cursor-pointer"
            >
              保存精选模型
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
