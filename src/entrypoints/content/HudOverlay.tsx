import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { Loader2, AlertCircle, RotateCcw, FileText, Settings, Zap } from 'lucide-react';
import { HighlightItem, HudViewMode } from '../../types';
import {
  attachHudWheelIsolation,
  calculateHudScrollTop,
} from '../../utils/hudNavigation';
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
import { resolveShortcut } from '../../utils/shortcutDefinitions';
import { ShortcutHelpPanel } from './components/ShortcutHelpPanel';

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
  const [viewMode, setViewMode] = useState<HudViewMode>('summary');

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Set<string | number>>(new Set());
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState<boolean>(false);
  const hudContainerRef = useRef<HTMLDivElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);

  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const communityListRef = useRef<HTMLDivElement | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const openedByUserRef = useRef<boolean>(false);
  // Scroll tracking refs
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  // 用户主动打开时保存此前焦点，便于关闭后还原。
  const openHudAsUser = useCallback(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    openedByUserRef.current = true;
    window.dispatchEvent(new CustomEvent('biliflow:ensure-mount'));
    setIsOpen(true);
    setIsShortcutHelpOpen(false);
  }, []);

  const closeHud = useCallback(() => {
    setIsOpen(false);
    setIsShortcutHelpOpen(false);
  }, []);

  const toggleHudAsUser = useCallback(() => {
    if (isOpen) {
      closeHud();
    } else {
      openHudAsUser();
    }
  }, [isOpen, openHudAsUser, closeHud]);

  const focusHelpTrigger = useCallback(() => {
    helpTriggerRef.current?.focus();
  }, []);

  const toggleShortcutHelp = useCallback(() => {
    if (isShortcutHelpOpen) {
      focusHelpTrigger();
    }
    setIsShortcutHelpOpen((prev) => !prev);
  }, [isShortcutHelpOpen, focusHelpTrigger]);

  // 仅在用户主动打开后把焦点移入 HUD；设置导致的默认展开不抢焦点。
  useEffect(() => {
    if (isOpen && openedByUserRef.current) {
      hudContainerRef.current?.focus();
    }
  }, [isOpen]);

  // 阻止 HUD 弹窗内的滚轮/触控板滑动事件冒泡穿透触发 B 站音量调节
  useEffect(() => {
    if (!isOpen) return;
    const container = hudContainerRef.current;
    if (!container) return;
    return attachHudWheelIsolation(container);
  }, [isOpen]);

  // 关闭时恢复此前焦点；若来源节点已卸载则回退到关闭态打开按钮。
  useEffect(() => {
    if (isOpen) return;
    if (openedByUserRef.current) {
      openedByUserRef.current = false;
      const target = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (target?.isConnected) {
        target.focus();
      } else {
        openButtonRef.current?.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isReady && settings.defaultHudOpen) {
      setIsOpen(true);
    }
  }, [isReady, settings.defaultHudOpen]);

  // Hook 1: Auto/Manual Summary Lifecycle
  const {
    summary,
    loading,
    manualReason,

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
    settingsReady: isReady,

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

  // 刷新/重新生成当前视图；按当前视图 loading 状态拒绝重入。
  const handleRefreshCurrentView = useCallback(() => {
    if (viewMode === 'community') {
      if (communityLoading) return;
      retryCommunity();
    } else if (viewMode === 'transcript') {
      if (transcriptLoading) return;
      void retryTranscript();
    } else {
      if (loading) return;
      void retrySummary();
    }
  }, [viewMode, communityLoading, transcriptLoading, loading, retryCommunity, retryTranscript, retrySummary]);

  const handleSearchTranscript = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // Hook 4: Fullscreen & Global Keyboard Shortcuts
  useFullscreenDetector({
    isOpen,
    settings,
    viewMode,
    onViewModeChange: setViewMode,
    onToggleOpen: toggleHudAsUser,
    onClose: closeHud,
    onToggleHelp: toggleShortcutHelp,
    isShortcutHelpOpen,
    onRefresh: handleRefreshCurrentView,
    onCopyMarkdown: handleCopyMarkdown,
    onSearchTranscript: handleSearchTranscript,
    onScrollCurrentView: (direction) => {
      const container =
        viewMode === 'transcript'
          ? transcriptListRef.current
          : viewMode === 'community'
          ? communityListRef.current
          : scrollContainerRef.current;
      if (!container) return;
      markUserManualAction();
      container.scrollTop = calculateHudScrollTop(
        container.scrollTop,
        container.scrollHeight,
        container.clientHeight,
        direction
      );
    },

    hasSummary: Boolean(summary?.highlights?.length),
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
          ref={hudContainerRef}
          role="dialog"
          aria-label="BiliFlow 视频总结"
          tabIndex={-1}
          onWheel={(e) => {
            e.stopPropagation();
          }}
          className={`fixed top-[68px] right-6 w-[370px] sm:w-[410px] max-h-[min(585px,calc(100vh-8rem))] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto transition-all duration-200 overflow-hidden animate-fade-in ${
            isDark
              ? 'bg-[#0f172a]/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
              : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-300/60'
          }`}
        >
          {/* Header */}
          <HUDHeader
            settings={settings}
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
            viewMode={viewMode}
            categoryLabel={videoInfo?.category?.label ?? null}
            onViewModeChange={setViewMode}
            onRefresh={handleRefreshCurrentView}
            onOpenOptions={handleOpenOptions}
            onToggleHelp={toggleShortcutHelp}
            helpTriggerRef={helpTriggerRef}
            onCopyMarkdown={handleCopyMarkdown}
            onExportToBiliNote={() => summary && exportFullToNativeNote(summary)}
            pendingNoteSyncCount={pendingSyncCount}
            onRetryNoteSync={() => {
              void retryPendingSyncs();

            }}
            onClose={closeHud}
          />

          {isShortcutHelpOpen ? (
            <ShortcutHelpPanel
              isDark={isDark}
              settings={settings}
              onClose={() => {
                setIsShortcutHelpOpen(false);
                focusHelpTrigger();
              }}
            />
          ) : viewMode === 'summary' ? (
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
                  manualReason={manualReason}
                  categoryLabel={videoInfo?.category?.label ?? null}
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
                    chapterSource={summary.chapterSource}
                    highlights={summary.highlights}
                    isDark={isDark}

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
                listRef={communityListRef}
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
                searchInputRef={searchInputRef}
                onManualInteraction={markUserManualAction}
                listRef={transcriptListRef}
              />
            </div>


          )}
        </div>
      )}
      {!isOpen && settings.showClosedHudLauncher && (
        <button
          ref={openButtonRef}
          type="button"
          onClick={openHudAsUser}
          className={`fixed top-[68px] right-6 inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-xl pointer-events-auto transition-all hover:shadow-xl cursor-pointer ${
            isDark
              ? 'bg-[#0f172a]/90 border-slate-700/80 text-slate-100 shadow-sky-950/30'
              : 'bg-white/90 border-slate-200/90 text-slate-800 shadow-slate-300/50'
          }`}
          title={`打开 BiliFlow 心流面板 (${resolveShortcut('toggle', settings)})`}
          aria-label="打开 BiliFlow 心流面板"
        >
          <span
            className={`p-1 rounded-lg bg-gradient-to-tr from-sky-500 to-cyan-400 text-white ${
              isDark ? '' : 'shadow-sm'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
          </span>
          <span className="text-xs font-bold">心流</span>
          <kbd
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              isDark
                ? 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {resolveShortcut('toggle', settings)}
          </kbd>
        </button>
      )}
    </div>
  );
};
