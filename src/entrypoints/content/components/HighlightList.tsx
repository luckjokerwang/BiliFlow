import React from 'react';
import { HighlightItem } from '../../../types';
import { UserAnnotation, UserAnnotationType } from '../../../types/biliNote';
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
  getAnnotationForHighlight?: (id: string | number) => UserAnnotation | undefined;
  onSaveAnnotation?: (
    highlight: HighlightItem,
    data: { type: UserAnnotationType; content: string }
  ) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onInsertToNativeNote?: (
    highlight: HighlightItem,
    withScreenshot: boolean
  ) => Promise<boolean | void> | void;
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
  getAnnotationForHighlight,
  onSaveAnnotation,
  onDeleteAnnotation,
  onInsertToNativeNote,
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
        {highlights.map((item, idx) => {
          const annotation = getAnnotationForHighlight?.(item.id);

          return (
            <HighlightItemCard
              key={item.id}
              isDark={isDark}
              item={item}
              index={idx}
              isSelected={selectedIndex === idx}
              isExpanded={expandedQuoteIds.has(item.id)}
              enableNumberKeySeek={enableNumberKeySeek}
              currentPlaybackSec={currentPlaybackSec}
              annotation={annotation}
              onJump={onJump}
              onToggleExpand={onToggleQuoteExpand}
              onSeekQuote={onSeekQuote}
              onSaveAnnotation={(data) => onSaveAnnotation?.(item, data)}
              onDeleteAnnotation={() => {
                if (annotation) onDeleteAnnotation?.(annotation.id);
              }}
              onInsertToNativeNote={(withScreenshot) =>
                onInsertToNativeNote?.(item, withScreenshot)
              }
              cardRef={(el) => {
                itemRefs.current[idx] = el;
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
