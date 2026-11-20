import React from 'react';
import { AlertCircle, Loader2, MessageSquare, ThumbsUp, Zap } from 'lucide-react';
import { CommunityDigest } from '../../../types';
import { formatSeconds } from '../../../utils/timeParser';

export interface CommunityDigestViewProps {
  isDark: boolean;
  digest: CommunityDigest | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSeek: (seconds: number) => void;
}

export const CommunityDigestView: React.FC<CommunityDigestViewProps> = ({
  isDark,
  digest,
  loading,
  error,
  onRetry,
  onSeek,
}) => {
  if (loading && !digest) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        <p className="text-xs font-medium">正在加载社区精选...</p>
        <p className="text-[11px] opacity-75">按本地规则整理热门评论与高能弹幕</p>
      </div>
    );
  }

  if (error && !digest) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="w-6 h-6 text-rose-500" />
        <p className="text-xs font-medium text-rose-400">社区精选加载失败</p>
        <p className="text-[11px] opacity-75 max-w-[260px]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-[11px] font-semibold hover:bg-sky-400 cursor-pointer"
        >
          重试
        </button>
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-[11px] text-slate-400">
        切换到此视图以加载社区精选
      </div>
    );
  }

  const panelClass = isDark
    ? 'bg-slate-900/70 border-slate-700 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
      <section className={`p-3 rounded-xl border ${panelClass}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            热门评论（整支视频）
          </span>
          <span className="text-[10px] font-mono opacity-60">
            {digest.commentTotal === null ? '—' : digest.commentTotal} 条
          </span>
        </div>
        {digest.errors.comments && (
          <p className="text-[10px] text-amber-400 mb-2">{digest.errors.comments}</p>
        )}
        {digest.comments.length === 0 ? (
          <p className="text-[11px] opacity-60">暂无可用评论</p>
        ) : (
          <div className="space-y-2">
            {digest.comments.map((comment) => (
              <div
                key={comment.id}
                className="p-2 rounded-lg bg-black/10 text-[11px] leading-snug space-y-1"
              >
                <div className="flex items-center gap-1.5 text-[10px] opacity-75">
                  <span className="font-semibold">{comment.author}</span>
                  {comment.isPinned && (
                    <span className="px-1 rounded bg-sky-500/20 text-sky-300">置顶</span>
                  )}
                  {comment.isUpLiked && (
                    <span className="px-1 rounded bg-rose-500/20 text-rose-300">UP 赞</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                <div className="flex items-center gap-3 text-[10px] opacity-60">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {comment.likeCount}
                  </span>
                  <span>回复 {comment.replyCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`p-3 rounded-xl border ${panelClass}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            高能弹幕（当前分 P · 实时弹幕池摘录）
          </span>
          <span className="text-[10px] font-mono opacity-60">
            样本 {digest.danmakuSampleCount}
          </span>
        </div>
        {digest.errors.danmaku && (
          <p className="text-[10px] text-amber-400 mb-2">{digest.errors.danmaku}</p>
        )}
        {digest.danmaku.length === 0 ? (
          <p className="text-[11px] opacity-60">暂无可用弹幕</p>
        ) : (
          <div className="space-y-1.5">
            {digest.danmaku.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSeek(item.timestampSec)}
                className="w-full flex items-start gap-2 p-1.5 rounded-lg text-left text-[11px] hover:bg-sky-500/10 cursor-pointer"
              >
                <span className="shrink-0 font-mono text-[10px] text-sky-400">
                  {formatSeconds(item.timestampSec)}
                </span>
                <span className="flex-1 break-words">{item.content}</span>
                <span className="shrink-0 text-[9px] opacity-60">
                  ×{item.resonanceCount}
                  {item.heatRatio > 0 && ` · 热 ${item.heatRatio.toFixed(2)}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
