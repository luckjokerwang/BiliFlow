import React from 'react';
import { Clock, Quote, ChevronUp, ChevronDown } from 'lucide-react';
import { HighlightItem } from '../../../types';
import { OriginalQuotesList } from './OriginalQuotesList';

export interface HighlightItemCardProps {
  isDark: boolean;
  item: HighlightItem;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  enableNumberKeySeek: boolean;
  currentPlaybackSec: number;
  onJump: (item: HighlightItem, index: number) => void;
  onToggleExpand: (id: string | number, e: React.MouseEvent) => void;
  onSeekQuote: (seconds: number) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export const HighlightItemCard: React.FC<HighlightItemCardProps> = ({
  isDark,
  item,
  index,
  isSelected,
  isExpanded,
  enableNumberKeySeek,
  currentPlaybackSec,
  onJump,
  onToggleExpand,
  onSeekQuote,
  cardRef,
}) => {
  const hasQuotes = item.originalQuotes && item.originalQuotes.length > 0;
  const showNumberBadge = enableNumberKeySeek && index < 9;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onJump(item, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onJump(item, index);
        }
      }}
      className={`group relative p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-start gap-2.5 ${
        isSelected
          ? isDark
            ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
            : 'bg-sky-50 border-sky-400/80 shadow-sm'
          : isDark
          ? 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/80 hover:border-slate-600/60'
          : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
      }`}
    >
      {/* Number Badge */}
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 transition-colors ${
          isSelected
            ? 'bg-sky-500 text-white'
            : isDark
            ? 'bg-slate-700/60 text-slate-300 group-hover:bg-slate-600'
            : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
        }`}
        title={showNumberBadge ? `按数字键 ${index + 1} 快速跳转` : undefined}
      >
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-semibold text-xs truncate ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {item.title}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${
                isDark
                  ? 'text-sky-300 bg-sky-950/60 border-sky-800/40'
                  : 'text-sky-700 bg-sky-50 border-sky-200'
              }`}
            >
              <Clock className="w-2.5 h-2.5" />
              {item.timestampStr}
            </span>
          </div>

          {hasQuotes && (
            <button
              type="button"
              onClick={(e) => onToggleExpand(item.id, e)}
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-all cursor-pointer shrink-0 ${
                isExpanded
                  ? isDark
                    ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                    : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
              }`}
              title={isExpanded ? '收起原文依据' : '展开原文字幕依据'}
            >
              <Quote className="w-2.5 h-2.5" />
              <span>{isExpanded ? '收起' : '原文'}</span>
              {isExpanded ? (
                <ChevronUp className="w-2.5 h-2.5" />
              ) : (
                <ChevronDown className="w-2.5 h-2.5" />
              )}
            </button>
          )}
        </div>

        {item.keyPoint && (
          <p
            className={`text-[11px] mt-1 leading-snug ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {item.keyPoint}
          </p>
        )}

        {/* Expandable Original Quotes */}
        {isExpanded && hasQuotes && (
          <OriginalQuotesList
            isDark={isDark}
            quotes={item.originalQuotes!}
            currentPlaybackSec={currentPlaybackSec}
            onSeekQuote={onSeekQuote}
          />
        )}
      </div>
    </div>
  );
};
