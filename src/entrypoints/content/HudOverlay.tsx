import React, { useState, useEffect, useCallback, useRef } from 'react';
import { browser } from 'wxt/browser';
import { Loader2, AlertCircle, RotateCcw, FileText, Settings } from 'lucide-react';
import { HighlightItem } from '../../types';
import {
  calculateTimelineMarkers,
  calculateTimelineSegments,
} from '../../utils/timelineCalculator';
import {
  renderTimelineMarkers,
  cleanupPlayerInjections,
} from '../../utils/playerInjector';

import { useSettings } from './hooks/useSettings';
import { useAutoSummary } from './hooks/useAutoSummary';
import { useVideoController } from './hooks/useVideoController';
import { useFullscreenDetector } from './hooks/useFullscreenDetector';

import { HUDHeader } from './components/HUDHeader';
import { HighlightList } from './components/HighlightList';
import { ManualTriggerPanel } from './components/ManualTriggerPanel';
import { HUDToast } from './components/HUDToast';

export const HudOverlay: React.FC = () => {
  const { settings, isReady } = useSettings();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Set<string | number>>(new Set());

  // Scroll tracking refs
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  // Initialize default open state once settings are loaded
  useEffect(() => {
    if (isReady && settings.defaultHudOpen) {
      setIsOpen(true);
    }
  }, [isReady, settings.defaultHudOpen]);

  // Hook 1: Auto/Manual Summary Lifecycle
  const {
    summary,
    loading,
    error,
    isManualMode,
    videoInfo,
    triggerSummary,
    retrySummary,
  } = useAutoSummary({
    settings,
    onToast: showToast,
  });

  // Hook 2: Video Player Controller & Current Time Tracking
  const {
    currentPlaybackSec,
    duration,
    activeHighlightIndex,
    seekTo,
    markUserManualAction,
  } = useVideoController({
    highlights: summary?.highlights || [],
  });

  // Center active highlight in scroll view
  const scrollToActiveItem = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const targetEl = itemRefs.current[index];
      if (!container || !targetEl) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = Math.max(
        0,
        relativeTop - container.clientHeight / 2 + targetEl.clientHeight / 2
      );

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    });
  }, []);

  // Sync selected index when playback reaches a new highlight node
  useEffect(() => {
    if (activeHighlightIndex >= 0 && summary?.highlights && summary.highlights.length > 0) {
      setSelectedIndex(activeHighlightIndex);
      scrollToActiveItem(activeHighlightIndex);
    }
  }, [activeHighlightIndex, summary, scrollToActiveItem]);

  // Jump to specific highlight
  const handleJump = useCallback(
    (highlight: HighlightItem, index: number) => {
      markUserManualAction();
      setSelectedIndex(index);
      scrollToActiveItem(index);

      const targetSeconds =
        typeof highlight.timestamp === 'number'
          ? highlight.timestamp
          : (highlight.timestampSec ?? 0);

      const success = seekTo(targetSeconds);
      if (success) {
        showToast(`已直达: [${highlight.timestampStr}] ${highlight.title}`);
      }
    },
    [seekTo, markUserManualAction, scrollToActiveItem, showToast]
  );

  // Quote expansion toggling
  const toggleQuoteExpand = useCallback((id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    markUserManualAction();
    setExpandedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [markUserManualAction]);

  // Hook 3: Fullscreen & Global Keyboard Shortcuts
  useFullscreenDetector({
    settings,
    isOpen,
    onToggleOpen: () => {
      window.dispatchEvent(new CustomEvent('biliflow:ensure-mount'));
      setIsOpen((prev) => !prev);
    },
    onClose: () => setIsOpen(false),
    onPrevHighlight: () => {
      if (!summary?.highlights || summary.highlights.length === 0) return;
      const next = Math.max(selectedIndex - 1, 0);
      handleJump(summary.highlights[next], next);
    },
    onNextHighlight: () => {
      if (!summary?.highlights || summary.highlights.length === 0) return;
      const next = Math.min(selectedIndex + 1, summary.highlights.length - 1);
      handleJump(summary.highlights[next], next);
    },
    onToggleQuotes: () => {
      if (!summary?.highlights) return;
      const currentItem = summary.highlights[selectedIndex];
      if (currentItem?.originalQuotes && currentItem.originalQuotes.length > 0) {
        setExpandedQuoteIds((prev) => {
          const next = new Set(prev);
          if (next.has(currentItem.id)) next.delete(currentItem.id);
          else next.add(currentItem.id);
          return next;
        });
      }
    },
    onNumberKeySeek: (digit: number) => {
      if (!summary?.highlights) return;
      const targetIndex = digit - 1;
      if (targetIndex >= 0 && targetIndex < summary.highlights.length) {
        handleJump(summary.highlights[targetIndex], targetIndex);
      }
    },
  });

  // Synchronize Timeline Markers on Bilibili progress bar
  useEffect(() => {
    const updateMarkers = () => {
      if (summary?.highlights && summary.highlights.length > 0 && duration > 0) {
        const markers = calculateTimelineMarkers(summary.highlights, duration);
        const segments = calculateTimelineSegments(markers, duration);
        renderTimelineMarkers(
          markers,
          segments,
          duration,
          {
            showTimelineMarkers: settings.showTimelineMarkers,
            showHoverCard: settings.showHoverCard,
          },
          (sec) => {
            seekTo(sec);
            showToast('已跳转至选定亮点');
          }
        );
      } else {
        cleanupPlayerInjections();
      }
    };

    updateMarkers();
    const interval = setInterval(updateMarkers, 2000);
    return () => clearInterval(interval);
  }, [summary, duration, settings.showTimelineMarkers, settings.showHoverCard, seekTo, showToast]);

  // Open Options page safely
  const handleOpenOptions = () => {
    browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }).catch(() => {
      window.open(browser.runtime.getURL('options.html'));
    });
  };

  const isDark = settings.theme !== 'light';

  return (
    <div className="fixed inset-0 pointer-events-none z-[2147483647] font-sans antialiased select-none">
      {/* Toast Feedback */}
      <HUDToast message={toastMsg} showToasts={settings.showToasts} />

      {/* Floating HUD Card Container */}
      {isOpen && (
        <div
          className={`fixed top-14 right-6 w-[370px] sm:w-[410px] max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto transition-all duration-200 overflow-hidden animate-fade-in ${
            isDark
              ? 'bg-[#0f172a]/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
              : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-300/60'
          }`}
        >
          {/* Header */}
          <HUDHeader
            isDark={isDark}
            loading={loading}
            isFallbackUsed={summary?.isFallbackUsed}
            usedModel={summary?.usedModel}
            onRefresh={() => retrySummary()}
            onOpenOptions={handleOpenOptions}
            onClose={() => setIsOpen(false)}
          />

          {/* Content Body */}
          <div
            ref={scrollContainerRef}
            onWheel={markUserManualAction}
            onTouchMove={markUserManualAction}
            className="p-4 max-h-[70vh] overflow-y-auto scroll-smooth space-y-3.5"
          >
            {/* Loading State */}
            {loading && (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
                <p className="text-xs font-medium tracking-wide">
                  正在智能提炼视频核心亮点...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  isDark
                    ? 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 min-w-0 flex-1">
                  <p className="font-semibold text-rose-500">无法生成总结</p>
                  <p className="opacity-90 leading-relaxed break-words">{error}</p>
                  {error.includes('刷新') ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-[11px] font-semibold transition-all hover:bg-sky-400 cursor-pointer mt-1"
                    >
                      <RotateCcw className="w-3 h-3" /> 立即按 F5 刷新网页
                    </button>
                  ) : error.includes('字幕') ? (
                    <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span>提示：该视频没有外挂字幕/AI字幕，仅有UP压制的画面硬字幕</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenOptions}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline cursor-pointer pt-0.5 font-semibold"
                    >
                      <Settings className="w-3.5 h-3.5" /> 前往设置中心配置厂商与 API Key
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Manual Mode Trigger Panel */}
            {isManualMode && !summary && !loading && !error && (
              <ManualTriggerPanel
                isDark={isDark}
                loading={loading}
                videoDuration={duration || videoInfo?.duration || 0}
                minDurationForAutoSec={settings.minDurationForAutoSec}
                autoSummarizeEnabled={settings.autoSummarize}
                onTrigger={() => triggerSummary(false)}
              />
            )}

            {/* Summary Content */}
            {summary && !loading && (
              <>
                {/* One Sentence Summary */}
                {summary.oneSentenceSummary && (
                  <div
                    className={`p-3 rounded-xl border text-xs leading-relaxed select-text ${
                      isDark
                        ? 'bg-slate-800/50 border-slate-700/50 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-bold text-sky-500 mr-1.5">⚡ 全片核心:</span>
                    {summary.oneSentenceSummary}
                  </div>
                )}

                {/* Highlights List */}
                <HighlightList
                  isDark={isDark}
                  highlights={summary.highlights}
                  selectedIndex={selectedIndex}
                  expandedQuoteIds={expandedQuoteIds}
                  enableNumberKeySeek={settings.enableNumberKeySeek}
                  currentPlaybackSec={currentPlaybackSec}
                  onJump={handleJump}
                  onToggleQuoteExpand={toggleQuoteExpand}
                  onSeekQuote={(sec) => {
                    markUserManualAction();
                    seekTo(sec);
                    showToast('已跳转至原文字幕');
                  }}
                  itemRefs={itemRefs}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
