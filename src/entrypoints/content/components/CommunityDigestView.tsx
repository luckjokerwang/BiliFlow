import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { CommunityDigest } from '../../../types';
import { formatSeconds } from '../../../utils/timeParser';

export interface CommunityDigestViewProps {
  isDark: boolean;
  digest: CommunityDigest | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  listRef?: React.RefObject<HTMLDivElement>;


  onSeek: (seconds: number) => void;
}

export const CommunityDigestView: React.FC<CommunityDigestViewProps> = ({
  isDark,
  digest,
  loading,
  error,
  onRetry,
  onSeek,
  listRef,
}) => {
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(new Set());

  const toggleSubReplies = (commentId: string) => {
    setExpandedReplyIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  if (loading && !digest) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        <p className="text-xs font-medium">正在加载社区精选...</p>
        <p className="text-xs opacity-75">按本地规则整理热门评论与高能弹幕</p>
      </div>
    );
  }

  if (error && !digest) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="w-6 h-6 text-rose-500" />
        <p className="text-xs font-medium text-rose-400">社区精选加载失败</p>
        <p className="text-xs opacity-75 max-w-[260px]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 cursor-pointer"
        >
          重试
        </button>
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-xs text-slate-400">
        切换到此视图以加载社区精选
      </div>
    );
  }

  const panelClass = isDark
    ? 'bg-slate-900/70 border-slate-700 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-4">
      <section className={`p-3 rounded-xl border ${panelClass}`}>
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            热门评论（整支视频）
          </span>
          <span className="text-[11px] font-mono opacity-60">
            {digest.commentTotal === null ? '—' : digest.commentTotal} 条
          </span>
        </div>
        {digest.errors.comments && (
          <p className="text-[11px] text-amber-400 mb-2">{digest.errors.comments}</p>
        )}
        {digest.comments.length === 0 ? (
          <p className="text-xs opacity-60">暂无可用评论</p>
        ) : (
          <div className="space-y-2">
            {digest.comments.map((comment) => (
              <div
                key={comment.id}
                className="p-2.5 rounded-lg bg-black/10 space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-xs opacity-75">
                  <span className="text-xs font-semibold">{comment.author}</span>
                  {comment.isPinned && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">置顶</span>
                  )}
                  {comment.isUpLiked && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">UP 赞</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{comment.content}</p>
                <div className="flex items-center gap-3 text-[11px] opacity-60">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {comment.likeCount}
                  </span>
                  {comment.replyCount > 0 && comment.subReplies && comment.subReplies.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleSubReplies(comment.id)}
                      className="inline-flex items-center gap-1 hover:text-sky-400 transition-colors cursor-pointer select-none text-[11px]"
                    >
                      <span>
                        共 {comment.replyCount} 条回复 ·{' '}
                        {expandedReplyIds.has(comment.id) ? '收起' : '展开查看'}
                      </span>
                      {expandedReplyIds.has(comment.id) ? (
                        <ChevronUp className="w-2.5 h-2.5" />
                      ) : (
                        <ChevronDown className="w-2.5 h-2.5" />
                      )}
                    </button>
                  ) : (
                    <span>回复 {comment.replyCount}</span>
                  )}
                </div>

                {expandedReplyIds.has(comment.id) &&
                  comment.subReplies &&
                  comment.subReplies.length > 0 && (
                    <div
                      className={`mt-2 pl-2.5 ml-1 border-l-2 ${
                        isDark
                          ? 'border-sky-500/30 bg-black/20 text-slate-300'
                          : 'border-sky-500/30 bg-slate-100/70 text-slate-700'
                      } rounded-r-lg py-1.5 pr-2 space-y-2`}
                    >
                      {comment.subReplies.map((sub) => (
                        <div key={sub.id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] opacity-75">
                            <span className="text-xs font-semibold">{sub.author}</span>
                            <span className="flex items-center gap-0.5 opacity-80 text-[11px]">
                              <ThumbsUp className="w-2.5 h-2.5" /> {sub.likeCount}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-[12px] leading-normal opacity-90 select-text">
                            {sub.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`p-3 rounded-xl border ${panelClass}`}>
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            高能弹幕（当前分 P · 实时弹幕池摘录）
          </span>
          <span className="text-[11px] font-mono opacity-60">
            样本 {digest.danmakuSampleCount}
          </span>
        </div>
        {digest.errors.danmaku && (
          <p className="text-[11px] text-amber-400 mb-2">{digest.errors.danmaku}</p>
        )}
        {digest.danmaku.length === 0 ? (
          <p className="text-xs opacity-60">暂无可用弹幕</p>
        ) : (
          <div className="space-y-1.5">
            {digest.danmaku.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSeek(item.timestampSec)}
                className="w-full flex items-start gap-2 p-1.5 rounded-lg text-left text-[12px] hover:bg-sky-500/10 cursor-pointer"
              >
                <span className="shrink-0 font-mono text-[11px] text-sky-400">
                  {formatSeconds(item.timestampSec)}
                </span>
                <span className="flex-1 break-words text-[12px] leading-normal">{item.content}</span>
                <span className="shrink-0 text-[10px] opacity-60">
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
