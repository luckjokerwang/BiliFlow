import React from 'react';
import { Quote, Volume2 } from 'lucide-react';
import { OriginalQuote } from '../../../types';
import { findActiveQuoteIndex } from '../../../utils/timelineCalculator';

export interface OriginalQuotesListProps {
  isDark: boolean;
  quotes: OriginalQuote[];
  currentPlaybackSec: number;
  onSeekQuote: (seconds: number) => void;
}

export const OriginalQuotesList: React.FC<OriginalQuotesListProps> = ({
  isDark,
  quotes,
  currentPlaybackSec,
  onSeekQuote,
}) => {
  if (!quotes || quotes.length === 0) {
    return null;
  }

  const activeQuoteIndex = findActiveQuoteIndex(quotes, currentPlaybackSec);

  return (
    <div
      className={`mt-2 p-2.5 rounded-xl border text-[11px] space-y-1.5 transition-all select-text ${
        isDark
          ? 'bg-slate-900/90 border-slate-700/60 text-slate-300'
          : 'bg-slate-100/90 border-slate-200 text-slate-700'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1 border-b border-slate-700/30">
        <span className="flex items-center gap-1 text-sky-400 font-medium">
          <Quote className="w-2.5 h-2.5" />
          <span>原文字幕依据 ({quotes.length} 段)</span>
        </span>
        <span className="text-[9px] text-slate-400">点击任意句可精准跳转</span>
      </div>

      <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
        {quotes.map((quote, qIdx) => {
          const isQuoteActive = activeQuoteIndex === qIdx;

          return (
            <div
              key={`${quote.timestamp}_${qIdx}`}
              role="button"
              tabIndex={0}
              onClick={() => onSeekQuote(quote.timestamp)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSeekQuote(quote.timestamp);
                }
              }}
              className={`p-1.5 rounded-lg transition-all flex items-start gap-1.5 cursor-pointer ${
                isQuoteActive
                  ? isDark
                    ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200 font-medium shadow-sm'
                    : 'bg-sky-100 border border-sky-300 text-sky-900 font-medium shadow-sm'
                  : isDark
                  ? 'hover:bg-slate-800/80 hover:text-slate-100'
                  : 'hover:bg-white hover:text-slate-900'
              }`}
            >
              <span
                className={`font-mono text-[9px] px-1 py-0.2 rounded shrink-0 border mt-0.5 ${
                  isQuoteActive
                    ? 'bg-sky-500 text-white border-transparent'
                    : isDark
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}
              >
                {quote.timestampStr}
              </span>
              <p className="flex-1 leading-snug">{quote.content}</p>
              {isQuoteActive && (
                <span className="shrink-0 text-sky-400 animate-pulse mt-0.5" title="正在播放">
                  <Volume2 className="w-3 h-3" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
