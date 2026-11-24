import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, Volume2 } from 'lucide-react';
import { BiliRawSubtitleItem } from '../../../types';
import { formatSeconds } from '../../../utils/timeParser';
import { findActiveTranscriptIndex } from '../../../utils/timelineCalculator';
import { alignElementInViewport } from '../../../utils/scrollPositioning';
import {
  filterTranscriptItems,
  TranscriptSearchMatch,
} from '../../../utils/transcriptSearch';

export interface TranscriptStreamProps {
  isDark: boolean;
  items: BiliRawSubtitleItem[];
  loading: boolean;
  error: string | null;
  currentPlaybackSec: number;
  shouldAutoFollow: boolean;
  onRetry: () => void;
  onSeek: (seconds: number) => void;
  onManualInteraction: () => void;

  searchInputRef: React.RefObject<HTMLInputElement>;
  listRef?: React.RefObject<HTMLDivElement>;


}

interface TranscriptRowProps {
  isDark: boolean;
  index: number;
  timestampSec: number;
  content: string;
  isActive: boolean;
  onSeek: (seconds: number) => void;
}

const TranscriptRow = React.memo<TranscriptRowProps>(
  ({ isDark, index, timestampSec, content, isActive, onSeek }) => {
    const timestampStr = formatSeconds(timestampSec);

    return (
      <div
        data-transcript-index={index}
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'true' : undefined}
        onClick={() => onSeek(timestampSec)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSeek(timestampSec);
          }
        }}
        className={`p-2 rounded-lg transition-colors flex items-start gap-2 cursor-pointer select-text ${
          isActive
            ? isDark
              ? 'bg-sky-500/25 border-l-2 border-l-sky-400 text-sky-100 font-medium'
              : 'bg-sky-100 border-l-2 border-l-sky-500 text-sky-950 font-medium'
            : isDark
            ? 'text-slate-300 hover:bg-slate-800/80'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span
          className={`font-mono text-[11px] px-1.5 py-0.5 rounded border shrink-0 ${
            isActive
              ? 'bg-sky-500 text-white border-transparent font-bold'
              : isDark
              ? 'text-slate-400 bg-slate-800 border-slate-700'
              : 'text-slate-500 bg-slate-100 border-slate-200'
          }`}
        >
          {timestampStr}
        </span>
        <p className={`flex-1 min-w-0 leading-relaxed break-words ${
          isActive ? 'text-[14px] font-semibold' : 'text-[13px]'
        }`}>
          {content}
        </p>
        {isActive && (
          <span title="正在播放该句">
            <Volume2 className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-pulse" />
          </span>
        )}
      </div>
    );
  }
);

TranscriptRow.displayName = 'TranscriptRow';

export const TranscriptStream: React.FC<TranscriptStreamProps> = ({
  isDark,
  items,
  loading,
  error,
  currentPlaybackSec,
  shouldAutoFollow,
  onRetry,
  onSeek,
  listRef: externalListRef,

  onManualInteraction,

  searchInputRef,
}) => {
  const [query, setQuery] = useState<string>('');
  const hasInitialPositionedRef = useRef(false);

  const innerListRef = useRef<HTMLDivElement | null>(null);
  const listRef = externalListRef ?? innerListRef;

  const activeIndex = useMemo(
    () => findActiveTranscriptIndex(items, currentPlaybackSec),
    [items, currentPlaybackSec]
  );
  const matches = useMemo<TranscriptSearchMatch[]>(
    () => filterTranscriptItems(items, query),
    [items, query]
  );
  const hasSearch = query.trim().length > 0;

  // Position on first mount instantly; follow later only when out of comfort zone.
  useEffect(() => {
    if (hasSearch) {
      hasInitialPositionedRef.current = false;
      return;
    }
    if (activeIndex < 0) return;

    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        const container = listRef.current;
        const target = container?.querySelector<HTMLElement>(
          `[data-transcript-index="${activeIndex}"]`
        );
        if (!container || !target) return;

        if (!hasInitialPositionedRef.current) {
          hasInitialPositionedRef.current = true;
          alignElementInViewport(container, target, { behavior: 'auto' });
        } else if (shouldAutoFollow) {
          alignElementInViewport(container, target, {
            behavior: 'smooth',
            onlyIfOutside: true,
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [activeIndex, shouldAutoFollow, hasSearch]);

  const placeholder = (
    icon: React.ReactNode,
    title: string,
    description: string,
    showRetry: boolean
  ) => (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon}
      <p className="text-xs font-medium">{title}</p>
      <p className="text-xs opacity-75 max-w-[260px]">{description}</p>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 cursor-pointer"
        >
          重试
        </button>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 pb-2 border-b border-slate-700/20">
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${
            isDark
              ? 'bg-slate-900/70 border-slate-700 text-slate-200'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <input
            ref={searchInputRef}
            aria-label="搜索全文字幕"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onManualInteraction}
            placeholder="搜索全文字幕关键词..."
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
          <span className="shrink-0 font-mono text-[11px] text-slate-400">
            {matches.length}/{items.length}
          </span>
        </div>
      </div>

      {loading ? (
        placeholder(
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />,
          '正在加载完整字幕...',
          '字幕加载完成后即可搜索与跟随播放',
          false
        )
      ) : error ? (
        placeholder(
          <AlertCircle className="w-6 h-6 text-rose-500" />,
          '全文字幕加载失败',
          error,
          true
        )
      ) : items.length === 0 ? (
        placeholder(
          <Search className="w-6 h-6 text-slate-400" />,
          '暂无可显示字幕',
          '该视频可能没有官方字幕或 AI 字幕',
          false
        )
      ) : (
        <div
          ref={listRef}
          onWheel={onManualInteraction}
          onTouchMove={onManualInteraction}
          className="flex-1 min-h-0 mt-2 pr-1 space-y-1 overflow-y-auto"
        >
          {matches.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              没有匹配 “{query.trim()}” 的字幕句
            </p>
          ) : (
            matches.map(({ item, index }) => (
              <TranscriptRow
                key={`${item.from}_${index}`}
                isDark={isDark}
                index={index}
                timestampSec={item.from}
                content={item.content}
                isActive={index === activeIndex}
                onSeek={onSeek}
              />
            ))
          )}
          <div aria-hidden="true" className="shrink-0 h-[min(380px,65vh)]" />
        </div>
      )}
    </div>
  );
};
