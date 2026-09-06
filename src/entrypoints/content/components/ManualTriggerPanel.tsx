import React from 'react';
import { Zap, Clock, Loader2, Sparkles } from 'lucide-react';

export interface ManualTriggerPanelProps {
  isDark: boolean;
  loading: boolean;
  videoDuration: number;
  minDurationForAutoSec: number;
  autoSummarizeEnabled: boolean;
  onTrigger: () => void;
}

export const ManualTriggerPanel: React.FC<ManualTriggerPanelProps> = ({
  isDark,
  loading,
  videoDuration,
  minDurationForAutoSec,
  autoSummarizeEnabled,
  onTrigger,
}) => {
  const isShortVideo =
    videoDuration > 0 &&
    minDurationForAutoSec > 0 &&
    videoDuration < minDurationForAutoSec;

  return (
    <div
      className={`p-5 rounded-2xl border text-center flex flex-col items-center gap-3.5 transition-all ${
        isDark
          ? 'bg-slate-800/40 border-slate-700/60 text-slate-200'
          : 'bg-sky-50/50 border-sky-200/80 text-slate-700'
      }`}
    >
      <div className="p-3 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20">
        <Sparkles className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3
          className={`text-sm font-bold tracking-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          视频心流要点提炼
        </h3>
        <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
          {isShortVideo
            ? `当前视频时长短于自动触发阈值 (${minDurationForAutoSec}s)，已自动为您转为按需触发，避免滥耗 Token。`
            : !autoSummarizeEnabled
            ? '已开启纯手动触发模式。点击下方按钮即可随时开始智能提炼。'
            : '就绪中，点击立即获取全文总结与高能打点。'}
        </p>
      </div>

      {videoDuration > 0 && (
        <div
          className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border ${
            isDark
              ? 'bg-slate-900/60 border-slate-700/60 text-sky-400'
              : 'bg-white border-slate-200 text-sky-600'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>
            总时长 {Math.floor(videoDuration / 60)}:
            {String(Math.floor(videoDuration % 60)).padStart(2, '0')}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onTrigger}
        disabled={loading}
        className="mt-1 w-full max-w-[260px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>正在智能提炼中...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current" />
            <span>一键生成要点总结</span>
          </>
        )}
      </button>
    </div>
  );
};
