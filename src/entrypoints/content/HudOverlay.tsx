import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { Loader2, AlertCircle, RotateCcw, FileText, Settings } from 'lucide-react';
import { HighlightItem, HudViewMode } from '../../types';
import { alignElementInViewport } from '../../utils/scrollPositioning';
import {
  calculateTimelineMarkers,
  calculateTimelineSegments,
} from '../../utils/timelineCalculator';
import {
  renderTimelineMarkers,
  cleanupPlayerInjections,
} from '../../utils/playerInjector';
import {
  formatSummaryAsMarkdown,
  copyTextToClipboard,
} from '../../utils/exportUtils';
import { formatStudyNoteToMarkdown } from '../../utils/biliNoteFormatter';

import { useSettings } from './hooks/useSettings';
import { useAutoSummary } from './hooks/useAutoSummary';
import { useVideoController } from './hooks/useVideoController';
import { useFullscreenDetector } from './hooks/useFullscreenDetector';
import { useAnnotations } from './hooks/useAnnotations';
import { useCommunityDigest } from './hooks/useCommunityDigest';
import { HUDHeader } from './components/HUDHeader';
import { HighlightList } from './components/HighlightList';
import { ManualTriggerPanel } from './components/ManualTriggerPanel';
import { HUDToast } from './components/HUDToast';
import { TranscriptStream } from './components/TranscriptStream';
import { SummaryArtifacts } from './components/SummaryArtifacts';
import { CommunityDigestView } from './components/CommunityDigestView';

export const HudOverlay: React.FC = () => {
  const { settings, isReady } = useSettings();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Set<string | number>>(new Set());
  const [viewMode, setViewMode] = useState<HudViewMode>('summary');
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
    subtitles,
    transcriptLoading,
    transcriptError,
    triggerSummary,
    retrySummary,
    retryTranscript,
  } = useAutoSummary({
    settings,
    onToast: showToast,
  });

  const {
    annotations,
    saveAnnotation,
    deleteAnnotation,
    getForHighlight,
    insertCardToNativeNote,
    exportFullToNativeNote,
    quickCapture,
    pendingSyncCount,
    retryPendingSyncs,
  } = useAnnotations({
    bvid: videoInfo?.bvid,
    cid: videoInfo?.cid,
    onToast: showToast,
  });

  // Hook 3: Video Player Controller & Current Time Tracking
  const {
    currentPlaybackSec,
    duration,
    activeHighlightIndex,
    seekTo,
    markUserManualAction,
    isUserManualActionActive,
    recordCurrentPosition,
    getResumeSeconds,
  } = useVideoController({
    bvid: videoInfo?.bvid,
    cid: videoInfo?.cid,
    highlights: summary?.highlights || [],
  });

  const {
    digest: communityDigest,
    loading: communityLoading,
    error: communityError,
    retry: retryCommunity,
  } = useCommunityDigest({
    videoInfo,
    enabled: isOpen && viewMode === 'community',
  });

  // Scroll context tracks (bvid, cid, viewMode) so reopening/switching views
  // forces an instant alignment instead of animating from a stale position.
  const lastSummaryScrollContextRef = useRef<string | null>(null);
  const summaryScrollContext = `${videoInfo?.bvid ?? ''}:${videoInfo?.cid ?? ''}:${viewMode}`;

  const scrollToActiveItem = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth', onlyIfOutside = false) => {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        const targetEl = itemRefs.current[index];
        if (!container || !targetEl) return;
        alignElementInViewport(container, targetEl, { behavior, onlyIfOutside });
      });
    },
    []
  );

  // Close / view switch clears the context so the next summary display aligns instantly.
  useEffect(() => {
    if (!isOpen || viewMode !== 'summary') {
      lastSummaryScrollContextRef.current = null;
    }
  }, [isOpen, viewMode]);

  // Main summary positioning: instant on context change, gentle follow otherwise.
  useEffect(() => {
    if (!isOpen || viewMode !== 'summary') return;
    if (!summary?.highlights?.length || activeHighlightIndex < 0) return;

    setSelectedIndex(activeHighlightIndex);
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const needsInstantAlign =
          lastSummaryScrollContextRef.current !== summaryScrollContext;
        if (needsInstantAlign) {
          lastSummaryScrollContextRef.current = summaryScrollContext;
          scrollToActiveItem(activeHighlightIndex, 'auto');
        } else if (!isUserManualActionActive()) {
          scrollToActiveItem(activeHighlightIndex, 'smooth', true);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    viewMode,
    summaryScrollContext,
    activeHighlightIndex,
    summary?.highlights?.length,
    scrollToActiveItem,
    isUserManualActionActive,
  ]);

  // Recalibrate scroll view when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        viewMode === 'summary' &&
        document.visibilityState === 'visible' &&
        isOpen &&
        summary?.highlights?.length &&
        activeHighlightIndex >= 0
      ) {
        requestAnimationFrame(() => {
          scrollToActiveItem(activeHighlightIndex, 'auto');
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, viewMode, activeHighlightIndex, summary, scrollToActiveItem]);

  // Only keep the active highlight's original quotes expanded during playback.
  useEffect(() => {
    if (!summary?.highlights?.length || activeHighlightIndex < 0) return;
    const activeId = summary.highlights[activeHighlightIndex]?.id;
    setExpandedQuoteIds((prev) => {
      if (prev.size === 0 || (prev.size === 1 && prev.has(activeId))) return prev;
      return prev.has(activeId) ? new Set([activeId]) : new Set();
    });
  }, [activeHighlightIndex, summary?.highlights]);

  // Jump to specific highlight
  const handleJump = useCallback(
    (highlight: HighlightItem, index: number) => {
      markUserManualAction();
      recordCurrentPosition();
      setSelectedIndex(index);
      scrollToActiveItem(index, 'smooth');

      const targetSeconds = getResumeSeconds(index);
      const success = seekTo(targetSeconds);
      if (success) {
        showToast(`已直达: [${highlight.timestampStr}] ${highlight.title}`);
      }
    },
    [seekTo, markUserManualAction, recordCurrentPosition, getResumeSeconds, scrollToActiveItem, showToast]
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

  // Hook 4: Fullscreen & Global Keyboard Shortcuts
  useFullscreenDetector({
    isOpen,
    settings,
    viewMode,
    onViewModeChange: setViewMode,
    onToggleOpen: () => {
      window.dispatchEvent(new CustomEvent('biliflow:ensure-mount'));
      setIsOpen((prev) => !prev);
    },
    onClose: () => setIsOpen(false),
    onQuickNote: quickCapture,
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

  // Reset selected index, expanded quotes and view mode when switching videos.
  useEffect(() => {
    setSelectedIndex(0);
    setExpandedQuoteIds(new Set());
    setViewMode('summary');
  }, [videoInfo?.bvid, videoInfo?.cid]);

  // Memoize timeline markers and segments to prevent re-generating fresh object references on every 2s tick
  const timelineMarkers = useMemo(() => {
    if (!summary?.highlights || summary.highlights.length === 0 || duration <= 0) return [];
    return calculateTimelineMarkers(summary.highlights, duration);
  }, [summary?.highlights, duration]);

  const timelineSegments = useMemo(() => {
    if (!timelineMarkers || timelineMarkers.length === 0 || duration <= 0) return [];
    return calculateTimelineSegments(timelineMarkers, duration);
  }, [timelineMarkers, duration]);

  // Synchronize Timeline Markers on Bilibili progress bar
  useEffect(() => {
    const updateMarkers = () => {
      if (timelineMarkers.length > 0 && duration > 0) {
        renderTimelineMarkers(
          timelineMarkers,
          timelineSegments,
          duration,
          {
            showTimelineMarkers: settings.showTimelineMarkers,
            showHoverCard: settings.showHoverCard,
          },
          (marker) => {
            const index = marker.index - 1;
            const highlight = summary?.highlights?.[index];
            if (highlight) handleJump(highlight, index);
          }
        );
      } else {
        cleanupPlayerInjections();
      }
    };

    updateMarkers();
    const interval = setInterval(updateMarkers, 2000);
    return () => {
      clearInterval(interval);
      cleanupPlayerInjections();
    };
  }, [
    timelineMarkers,
    timelineSegments,
    duration,
    settings.showTimelineMarkers,
    settings.showHoverCard,
    handleJump,
    showToast,
  ]);

  // Copy Markdown to Clipboard (Dual-track with user annotations)
  const handleCopyMarkdown = useCallback(async () => {
    if (!summary) return;
    let md = '';
    if (annotations.length > 0) {
      md = formatStudyNoteToMarkdown({
        bvid: summary.bvid,
        cid: summary.cid,
        title: summary.title,
        summary,
        annotations,
      });
    } else {
      md = formatSummaryAsMarkdown(summary);
    }

    const ok = await copyTextToClipboard(md);
    if (ok) {
      showToast('已复制 Markdown 笔记到剪贴板 (含个人思考与引用)');
    } else {
      showToast('复制失败，请检查浏览器剪贴板权限');
    }
  }, [summary, annotations, showToast]);

  // Open Options page safely
  const handleOpenOptions = () => {
    browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }).catch(() => {
      window.open(browser.runtime.getURL('/options.html'));
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
          className={`fixed top-[68px] right-6 w-[370px] sm:w-[410px] max-h-[min(585px,calc(100vh-8rem))] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto transition-all duration-200 overflow-hidden animate-fade-in ${
            isDark
              ? 'bg-[#0f172a]/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
              : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-300/60'
          }`}
        >
          {/* Header */}
          <HUDHeader
            isDark={isDark}
            loading={
              viewMode === 'community'
                ? communityLoading
                : viewMode === 'transcript'
                ? transcriptLoading
                : loading
            }
            isFallbackUsed={summary?.isFallbackUsed}
            usedModel={summary?.usedModel}
            hasSummary={Boolean(summary?.highlights?.length)}
            shortcut={settings.shortcutToggle || 'Alt+S'}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRefresh={() => {
              if (viewMode === 'community') {
                retryCommunity();
              } else if (viewMode === 'transcript') {
                void retryTranscript();
              } else {
                void retrySummary();
              }
            }}
            onOpenOptions={handleOpenOptions}
            onClose={() => setIsOpen(false)}
            onCopyMarkdown={handleCopyMarkdown}
            onExportToBiliNote={() => summary && exportFullToNativeNote(summary)}
            pendingNoteSyncCount={pendingSyncCount}
            onRetryNoteSync={() => {
              void retryPendingSyncs();
            }}
          />

          {/* Content Body */}
          {viewMode === 'summary' ? (
            <div
              ref={scrollContainerRef}
              onWheel={markUserManualAction}
              onTouchMove={markUserManualAction}
              className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3.5"
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

                  <SummaryArtifacts
                    isDark={isDark}
                    summary={summary}
                    onSeekQuote={(sec) => {
                      markUserManualAction();
                      seekTo(sec);
                      showToast('已跳转至金句原文');
                    }}
                  />

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
                    getAnnotationForHighlight={getForHighlight}
                    onSaveAnnotation={(h, data) => {
                      const sec =
                        typeof h.timestamp === 'number'
                          ? h.timestamp
                          : (h.timestampSec ?? 0);
                      return saveAnnotation({
                        id: getForHighlight(h.id)?.id,
                        timestamp: sec,
                        timestampStr: h.timestampStr,
                        highlightId: h.id,
                        type: data.type,
                        content: data.content,
                      });
                    }}
                    onDeleteAnnotation={(id) => {
                      return deleteAnnotation(id);
                    }}
                    onInsertToNativeNote={(h, withScreenshot) => {
                      return insertCardToNativeNote(h, withScreenshot);
                    }}
                    itemRefs={itemRefs}
                  />
                  <div aria-hidden="true" className="shrink-0 h-[min(380px,65vh)]" />
                </>
              )}
            </div>
          ) : viewMode === 'community' ? (
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <CommunityDigestView
                isDark={isDark}
                digest={communityDigest}
                loading={communityLoading}
                error={communityError}
                onRetry={retryCommunity}
                onSeek={(seconds) => {
                  markUserManualAction();
                  seekTo(seconds);
                  showToast('已跳转至高能弹幕');
                }}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <TranscriptStream
                isDark={isDark}
                items={subtitles}
                loading={transcriptLoading}
                error={transcriptError}
                currentPlaybackSec={currentPlaybackSec}
                shouldAutoFollow={!isUserManualActionActive()}
                onRetry={() => {
                  void retryTranscript();
                }}
                onSeek={seekTo}
                onManualInteraction={markUserManualAction}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
