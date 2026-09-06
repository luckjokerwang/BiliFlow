import React from 'react';
import { HighlightItem } from '../../../types';
import { HighlightItemCard } from './HighlightItemCard';

export interface HighlightListProps {
  isDark: boolean;
  highlights: HighlightItem[];
  selectedIndex: number;
  expandedQuoteIds: Set<string | number>;
  enableNumberKeySeek: boolean;
  currentPlaybackSec: number;
  onJump: (item: HighlightItem, index: number) => void;
  onToggleQuoteExpand: (id: string | number, e: React.MouseEvent) => void;
  onSeekQuote: (seconds: number) => void;
  itemRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

export const HighlightList: React.FC<HighlightListProps> = ({
  isDark,
  highlights,
  selectedIndex,
  expandedQuoteIds,
  enableNumberKeySeek,
  currentPlaybackSec,
  onJump,
  onToggleQuoteExpand,
  onSeekQuote,
  itemRefs,
}) => {
  if (!highlights || highlights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5 select-none">
        <span>
          核心亮点 {enableNumberKeySeek ? '(按数字键 1~9 秒切)' : ''}
        </span>
        <span>{highlights.length} 个节点</span>
      </div>

      <div className="space-y-1.5">
        {highlights.map((item, idx) => (
          <HighlightItemCard
            key={item.id}
            isDark={isDark}
            item={item}
            index={idx}
            isSelected={selectedIndex === idx}
            isExpanded={expandedQuoteIds.has(item.id)}
            enableNumberKeySeek={enableNumberKeySeek}
            currentPlaybackSec={currentPlaybackSec}
            onJump={onJump}
            onToggleExpand={onToggleQuoteExpand}
            onSeekQuote={onSeekQuote}
            cardRef={(el) => {
              itemRefs.current[idx] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
};
