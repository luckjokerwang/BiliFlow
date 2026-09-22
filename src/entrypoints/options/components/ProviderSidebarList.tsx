import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ProviderConfig } from '../../../types';
import { ProviderLogo } from '../../../components/ProviderIcons';

export interface ProviderSidebarListProps {
  isDark: boolean;
  providers: ProviderConfig[];
  selectedProviderId: string;
  activeProviderId: string;
  onSelectProvider: (id: string) => void;
  onAddCustomProvider: () => void;
  onDeleteProvider: (id: string) => void;
}

export const ProviderSidebarList: React.FC<ProviderSidebarListProps> = ({
  isDark,
  providers,
  selectedProviderId,
  activeProviderId,
  onSelectProvider,
  onAddCustomProvider,
  onDeleteProvider,
}) => {
  return (
    <div
      className={`pt-3 border-t space-y-2 ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
        <span>厂商列表 ({providers.length})</span>
        <button
          onClick={onAddCustomProvider}
          className="flex items-center gap-1 text-sky-500 hover:text-sky-400 font-medium transition-colors cursor-pointer"
          title="添加自定义大模型厂商"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>添加厂商</span>
        </button>
      </div>

      <div className="space-y-1 max-h-[52vh] overflow-y-auto pr-1">
        {providers.map((p) => {
          const isSelected = p.id === selectedProviderId;
          const isActive = p.id === activeProviderId;
          const displayName = p.name || (p.isCustom ? '未命名自定义厂商' : p.id);

          return (
            <div
              key={p.id}
              onClick={() => onSelectProvider(p.id)}
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
                    onDeleteProvider(p.id);
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
  );
};
