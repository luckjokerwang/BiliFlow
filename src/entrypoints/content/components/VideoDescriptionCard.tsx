import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export function cleanDescription(description?: string | null): string {
  if (!description || typeof description !== 'string') return '';
  return description
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function isValidDescription(description?: string | null): boolean {
  if (!description || typeof description !== 'string') return false;
  const trimmed = description.trim();
  if (trimmed.length <= 5) return false;
  // Filter out punctuation-only or symbol-only descriptions
  const stripped = trimmed.replace(/[\s\-_.~!@#$%^&*()+=[\]{}|\\:;"'<>,?/，。！？、…—]/g, '');
  if (stripped.length === 0) return false;
  const placeholders = ['暂无简介', '无简介', '视频简介', 'null', 'undefined'];
  if (placeholders.includes(trimmed.toLowerCase())) return false;
  return true;
}

export interface VideoDescriptionCardProps {
  isDark: boolean;
  description?: string | null;
}

export const VideoDescriptionCard: React.FC<VideoDescriptionCardProps> = ({
  isDark,
  description,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!isValidDescription(description)) {
    return null;
  }

  const cleanText = cleanDescription(description);
  const firstLine = cleanText.split('\n')[0].trim();

  const containerClass = `p-2.5 rounded-xl border text-xs leading-relaxed transition-colors ${
    isDark
      ? 'bg-slate-800/40 border-slate-700/50 text-slate-200 hover:border-slate-600/60'
      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
  }`;

  return (
    <div className={containerClass}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="flex items-center justify-between cursor-pointer select-none"
        title={isExpanded ? '点击收起简介' : '点击展开完整简介'}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>视频简介</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-sky-500 hover:text-sky-400 font-medium">
          {isExpanded ? '收起' : '展开'}
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </span>
      </div>

      {!isExpanded && firstLine && (
        <p
          onClick={() => setIsExpanded(true)}
          className="text-xs opacity-75 truncate mt-1 cursor-pointer select-none"
        >
          {firstLine}
        </p>
      )}

      {isExpanded && (
        <div
          className={`mt-2 pt-2 border-t text-[13px] whitespace-pre-wrap break-words leading-relaxed select-text ${
            isDark ? 'border-slate-700/50 opacity-90' : 'border-slate-200 opacity-90'
          }`}
        >
          {cleanText}
        </div>
      )}
    </div>
  );
};
