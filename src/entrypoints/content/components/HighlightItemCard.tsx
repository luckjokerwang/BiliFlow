import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Quote,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Camera,
  Pin,
  Check,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { HighlightItem } from '../../../types';
import {
  NativeNoteInsertResult,
  UserAnnotation,
  UserAnnotationType,
} from '../../../types/biliNote';
import { getTypeLabel } from '../../../utils/biliNoteFormatter';
import { OriginalQuotesList } from './OriginalQuotesList';

export interface HighlightItemCardProps {
  isDark: boolean;
  item: HighlightItem;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  enableNumberKeySeek: boolean;
  currentPlaybackSec: number;
  annotation?: UserAnnotation;
  onJump: (item: HighlightItem, index: number) => void;
  onToggleExpand: (id: string | number, e: React.MouseEvent) => void;
  onSeekQuote: (seconds: number) => void;
  onSaveAnnotation?: (data: {
    id?: string;
    type: UserAnnotationType;
    content: string;
  }) => Promise<UserAnnotation | void> | void;
  onDeleteAnnotation?: () => Promise<boolean | void> | void;
  onInsertToNativeNote?: (
    withScreenshot: boolean
  ) => Promise<NativeNoteInsertResult | void> | void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

const ANNOTATION_TYPES: Array<{ type: UserAnnotationType; label: string }> = [
  { type: 'insight', label: '💡 启发' },
  { type: 'question', label: '❓ 存疑' },
  { type: 'action', label: '🎯 行动' },
  { type: 'keypoint', label: '⭐ 重点' },
];

export const HighlightItemCard = React.memo<HighlightItemCardProps>(({
  isDark,
  item,
  index,
  isSelected,
  isExpanded,
  enableNumberKeySeek,
  currentPlaybackSec,
  annotation,
  onJump,
  onToggleExpand,
  onSeekQuote,
  onSaveAnnotation,
  onDeleteAnnotation,
  onInsertToNativeNote,
  cardRef,
}) => {
  const [isEditingThought, setIsEditingThought] = useState<boolean>(false);
  const [thoughtType, setThoughtType] = useState<UserAnnotationType>(
    annotation?.type || 'insight'
  );
  const [thoughtContent, setThoughtContent] = useState<string>(
    annotation?.content || ''
  );

  // Micro-feedback state for native note sync
  const [syncState, setSyncState] = useState<
    'idle' | 'loading' | 'success' | 'queued' | 'error'
  >('idle');
  const [syncTarget, setSyncTarget] = useState<'text' | 'screenshot' | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'idle'>(
    'idle'
  );
  const saveRevisionRef = useRef<number>(0);
  const latestSavePromiseRef = useRef<Promise<UserAnnotation | void>>(
    Promise.resolve()
  );

  // Never overwrite in-progress typing with an async save result.
  useEffect(() => {
    if (isEditingThought) return;
    if (annotation) {
      setThoughtType(annotation.type);
      setThoughtContent(annotation.content);
    } else {
      setThoughtType('insight');
      setThoughtContent('');
    }
  }, [annotation, isEditingThought]);

  const hasQuotes = item.originalQuotes && item.originalQuotes.length > 0;
  const showNumberBadge = enableNumberKeySeek && index < 9;

  const persistThought = (
    nextType: UserAnnotationType,
    nextContent: string
  ): Promise<UserAnnotation | void> => {
    const revision = ++saveRevisionRef.current;
    setSaveState('saving');

    const promise = Promise.resolve(
      onSaveAnnotation?.({
        id: annotation?.id,
        type: nextType,
        content: nextContent,
      })
    ).then(
      (result) => {
        if (saveRevisionRef.current === revision) setSaveState('saved');
        return result;
      },
      (err) => {
        if (saveRevisionRef.current === revision) setSaveState('error');
        throw err;
      }
    );

    promise.catch(() => {});
    latestSavePromiseRef.current = promise;
    return promise;
  };

  const handleSaveThought = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingThought(false);
  };

  const handleDeleteThought = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const ok = await Promise.resolve(onDeleteAnnotation?.());
      if (ok === false) {
        setSaveState('error');
        return;
      }
      setThoughtContent('');
      setIsEditingThought(false);
    } catch {
      setSaveState('error');
    }
  };

  const handleSyncToNote = async (withScreenshot: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncState === 'loading') return;

    setSyncTarget(withScreenshot ? 'screenshot' : 'text');
    setSyncState('loading');

    try {
      await latestSavePromiseRef.current;
      const res = await onInsertToNativeNote?.(withScreenshot);
      if (res === 'injected') {
        setSyncState('success');
        setTimeout(() => {
          setSyncState('idle');
          setSyncTarget(null);
        }, 1500);
      } else if (res === 'queued') {
        setSyncState('queued');
      } else {
        setSyncState('error');
        setTimeout(() => {
          setSyncState('idle');
          setSyncTarget(null);
        }, 2000);
      }
    } catch {
      setSyncState('error');
      setTimeout(() => {
        setSyncState('idle');
        setSyncTarget(null);
      }, 1500);
    }
  };

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onJump(item, index)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
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
        {/* Header row: title, timestamp & actions */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-semibold text-[13px] truncate ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {item.title}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.2 rounded border shrink-0 ${
                isDark
                  ? 'text-sky-300 bg-sky-950/60 border-sky-800/40'
                  : 'text-sky-700 bg-sky-50 border-sky-200'
              }`}
            >
              <Clock className="w-2.5 h-2.5" />
              {item.timestampStr}
            </span>
          </div>

          {/* Action buttons on top right */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Thought trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingThought((prev) => !prev);
              }}
              className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                annotation
                  ? isDark
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
              }`}
              title={annotation ? '查看/修改感悟' : '写下我的思考感悟'}
            >
              <MessageSquare className="w-2.5 h-2.5" />
              <span>{annotation ? getTypeLabel(annotation.type) : '记感悟'}</span>
            </button>

            {/* Original quote toggle */}
            {hasQuotes && (
              <button
                type="button"
                onClick={(e) => onToggleExpand(item.id, e)}
                className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded transition-all cursor-pointer ${
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
        </div>

        {/* AI Key Point */}
        {item.keyPoint && (
          <p
            className={`text-[13px] mt-1 leading-relaxed ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {item.keyPoint}
          </p>
        )}

        {/* Saved annotation preview (when form is not open) */}
        {annotation && !isEditingThought && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingThought(true);
            }}
            className={`mt-1.5 p-1.5 rounded-lg text-[11px] border leading-relaxed flex items-start justify-between gap-1.5 transition-colors ${
              isDark
                ? 'bg-amber-950/20 border-amber-800/30 text-amber-200/90 hover:border-amber-700/50'
                : 'bg-amber-50/80 border-amber-200 text-amber-900 hover:border-amber-300'
            }`}
            title="点击修改感悟"
          >
            <div className="flex-1 min-w-0">
              <span className="font-bold mr-1">{getTypeLabel(annotation.type)}:</span>
              <span>{annotation.content}</span>
            </div>
          </div>
        )}

        {/* Inline Thought Form (Progressive Disclosure) */}
        {isEditingThought && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`mt-2 p-2 rounded-lg border space-y-2 ${
              isDark
                ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800 shadow-sm'
            }`}
          >
            {/* Chip selector */}
            <div className="flex items-center gap-1 flex-wrap">
              {ANNOTATION_TYPES.map((chip) => (
                <button
                  key={chip.type}
                  type="button"
                  onClick={() => {
                    setThoughtType(chip.type);
                    persistThought(chip.type, thoughtContent);
                  }}
                  className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                    thoughtType === chip.type
                      ? 'bg-sky-500 text-white border-sky-500 font-semibold'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input textarea */}
            <textarea
              value={thoughtContent}
              onChange={(e) => {
                const nextContent = e.target.value;
                setThoughtContent(nextContent);
                persistThought(thoughtType, nextContent);
              }}
              placeholder="写下你对本章节的启发、存疑或实践灵感..."
              rows={2}
              className={`w-full text-xs p-1.5 rounded border resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />

            {saveState !== 'idle' && (
              <div
                className={`text-[11px] ${
                  saveState === 'error'
                    ? 'text-rose-400'
                    : isDark
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                {saveState === 'saving'
                  ? '保存中…'
                  : saveState === 'saved'
                  ? '已自动保存到本地'
                  : '本地保存失败，继续输入将重试'}
              </div>
            )}

            {/* Form actions with Bilibili Note Sync & Micro-Feedback */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-700/20 flex-wrap gap-1">
              <div className="flex items-center gap-1">
                {annotation && (
                  <button
                    type="button"
                    onClick={handleDeleteThought}
                    className="inline-flex items-center gap-0.5 text-[11px] text-rose-400 hover:text-rose-500 cursor-pointer px-1 py-0.5"
                    title="删除此感悟"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>删除</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingThought(false)}
                  className={`text-[11px] px-1.5 py-0.5 rounded cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  收起
                </button>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {/* 1. Finish editing (all changes are auto-saved) */}
                <button
                  type="button"
                  onClick={handleSaveThought}
                  className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded bg-slate-700 text-white hover:bg-slate-600 cursor-pointer"
                  title="完成编辑"
                >
                  <Check className="w-2.5 h-2.5" />
                  <span>完成</span>
                </button>

                {/* 2. Pin to B站 Note */}
                <button
                  type="button"
                  onClick={(e) => handleSyncToNote(false, e)}
                  disabled={syncState === 'loading'}
                  className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded transition-all cursor-pointer disabled:opacity-80 ${
                    syncState === 'success' && syncTarget === 'text'
                      ? 'bg-emerald-600 text-white'
                      : syncState === 'queued' && syncTarget === 'text'
                      ? 'bg-amber-600 text-white'
                      : syncState === 'error' && syncTarget === 'text'
                      ? 'bg-rose-600 text-white'
                      : isDark
                      ? 'text-sky-300 bg-sky-950/60 border border-sky-800/40 hover:bg-sky-900/60'
                      : 'text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100'
                  }`}
                  title="将本段观点与感悟记入 B站官方笔记"
                >
                  {syncState === 'loading' && syncTarget === 'text' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>记入中...</span>
                    </>
                  ) : syncState === 'success' && syncTarget === 'text' ? (
                    <>
                      <Check className="w-2.5 h-2.5" />
                      <span>已写入</span>
                    </>
                  ) : syncState === 'queued' && syncTarget === 'text' ? (
                    <>
                      <Clock className="w-2.5 h-2.5" />
                      <span>待同步</span>
                    </>
                  ) : syncState === 'error' && syncTarget === 'text' ? (
                    <>
                      <X className="w-2.5 h-2.5" />
                      <span>失败</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-2.5 h-2.5" />
                      <span>记入B站笔记</span>
                    </>
                  )}
                </button>

                {/* 3. Pin with Screenshot */}
                <button
                  type="button"
                  onClick={(e) => handleSyncToNote(true, e)}
                  disabled={syncState === 'loading'}
                  className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded transition-all cursor-pointer disabled:opacity-80 ${
                    syncState === 'success' && syncTarget === 'screenshot'
                      ? 'bg-emerald-600 text-white'
                      : syncState === 'queued' && syncTarget === 'screenshot'
                      ? 'bg-amber-600 text-white'
                      : syncState === 'error' && syncTarget === 'screenshot'
                      ? 'bg-rose-600 text-white'
                      : isDark
                      ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 hover:bg-cyan-900/60'
                      : 'text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100'
                  }`}
                  title="将本段观点及当前画面截图精准记入 B站官方笔记"
                >
                  {syncState === 'loading' && syncTarget === 'screenshot' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>截图中...</span>
                    </>
                  ) : syncState === 'success' && syncTarget === 'screenshot' ? (
                    <>
                      <Check className="w-2.5 h-2.5" />
                      <span>已写入</span>
                    </>
                  ) : syncState === 'queued' && syncTarget === 'screenshot' ? (
                    <>
                      <Clock className="w-2.5 h-2.5" />
                      <span>待同步</span>
                    </>
                  ) : syncState === 'error' && syncTarget === 'screenshot' ? (
                    <>
                      <X className="w-2.5 h-2.5" />
                      <span>失败</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-2.5 h-2.5" />
                      <span>📷 带截图记入</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
});
