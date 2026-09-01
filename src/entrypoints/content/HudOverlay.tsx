import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Zap,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Quote,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  Settings,
  RotateCcw,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { browser } from 'wxt/browser';
import {
  ExtensionMessage,
  ExtensionResponse,
  HighlightItem,
  VideoSummaryResult,
  BiliRawSubtitleItem,
  UserSettings,
  ThemeMode,
  ResolvedVideoInfo,
} from '../../types';
import {
  extractVideoMeta,
  isUserTyping,
  seekToSeconds,
  getVideoDuration,
} from '../../utils/playerController';
import {
  calculateTimelineMarkers,
} from '../../utils/timelineCalculator';
import {
  renderTimelineMarkers,
  cleanupPlayerInjections,
} from '../../utils/playerInjector';

async function safeSendMessage<T = any>(
  msg: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  if (!browser.runtime?.id) {
    return {
      success: false,
      error: 'BiliFlow 扩展已更新或重载。请按 F5 刷新此网页即可恢复使用。',
    };
  }
  try {
    const res = await browser.runtime.sendMessage(msg);
    return res;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (
      errMsg.includes('Extension context invalidated') ||
      errMsg.includes('Cannot read properties of undefined')
    ) {
      return {
        success: false,
        error: 'BiliFlow 扩展已更新。请按 F5 刷新当前网页以恢复连接。',
      };
    }
    return { success: false, error: errMsg };
  }
}

function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return false;

  const parts = shortcutStr.split('+').map((p) => p.trim().toLowerCase());
  const needCtrl = parts.includes('ctrl') || parts.includes('control');
  const needAlt = parts.includes('alt') || parts.includes('option');
  const needShift = parts.includes('shift');
  const needMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');

  if (e.ctrlKey !== needCtrl) return false;
  if (e.altKey !== needAlt) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.metaKey !== needMeta) return false;

  const keyPart = parts.find(
    (p) => !['ctrl', 'control', 'alt', 'option', 'shift', 'meta', 'cmd', 'command'].includes(p)
  );
  if (!keyPart) return false;

  const keyLower = e.key.toLowerCase();
  const codeLower = e.code.toLowerCase();
  return (
    keyLower === keyPart ||
    codeLower === `key${keyPart}` ||
    codeLower === `digit${keyPart}` ||
    codeLower === keyPart
  );
}

export const HudOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<VideoSummaryResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [shortcutToggle, setShortcutToggle] = useState<string>('Alt+S');
  const [shortcutPrevNode, setShortcutPrevNode] = useState<string>('K');
  const [shortcutNextNode, setShortcutNextNode] = useState<string>('J');
  const [shortcutToggleQuotes, setShortcutToggleQuotes] = useState<string>('O');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [expandedQuoteIds, setExpandedQuoteIds] = useState<Set<string | number>>(new Set());
  const currentVideoKeyRef = useRef<string>('');
  
  // Dedicated container and item refs for rock-solid programmatic scroll
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleQuoteExpand = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Open settings page safely via Background
  const handleOpenOptions = () => {
    browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }).catch(() => {
      window.open(browser.runtime.getURL('options.html'));
    });
  };

  // Programmatically scroll the active highlight card to the center of view
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

  // Follow selection changes and center the active card
  useEffect(() => {
    if (selectedIndex >= 0 && summary?.highlights) {
      scrollToActiveItem(selectedIndex);
    }
  }, [selectedIndex, summary, scrollToActiveItem]);

  // Load User Preferences on Mount
  useEffect(() => {
    (async () => {
      try {
        const res = await safeSendMessage<UserSettings>({ type: 'GET_SETTINGS' });
        if (res && res.success && res.data) {
          if (res.data.shortcutToggle) {
            setShortcutToggle(res.data.shortcutToggle);
          }
          if (res.data.shortcutPrevNode) {
            setShortcutPrevNode(res.data.shortcutPrevNode);
          }
          if (res.data.shortcutNextNode) {
            setShortcutNextNode(res.data.shortcutNextNode);
          }
          if (res.data.shortcutToggleQuotes) {
            setShortcutToggleQuotes(res.data.shortcutToggleQuotes);
          }
          if (res.data.theme) {
            setTheme(res.data.theme);
          }
        }
      } catch (e) {
        console.error('Failed to load settings in content script:', e);
      }
    })();

    const handleStorageChange = (changes: any) => {
      if (changes.user_settings?.newValue) {
        const newSettings: UserSettings = changes.user_settings.newValue;
        if (newSettings.shortcutToggle) {
          setShortcutToggle(newSettings.shortcutToggle);
        }
        if (newSettings.shortcutPrevNode) {
          setShortcutPrevNode(newSettings.shortcutPrevNode);
        }
        if (newSettings.shortcutNextNode) {
          setShortcutNextNode(newSettings.shortcutNextNode);
        }
        if (newSettings.shortcutToggleQuotes) {
          setShortcutToggleQuotes(newSettings.shortcutToggleQuotes);
        }
        if (newSettings.theme) {
          setTheme(newSettings.theme);
        }
      }
    };

    if (browser.storage?.onChanged) {
      browser.storage.onChanged.addListener(handleStorageChange);
      return () => browser.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  // Fetch summary for current video (strictly clean previous cache on start/error)
  const loadSummaryForCurrentVideo = useCallback(async (forceRefresh = false) => {
    const meta = extractVideoMeta();
    if (!meta || !meta.bvid) {
      setSummary(null);
      setError('未检测到正在播放的 B 站视频');
      return;
    }

    // Immediately clear previous video's summary and state
    setSummary(null);
    setError(null);
    setLoading(true);
    setSelectedIndex(0);
    setExpandedQuoteIds(new Set());

    try {
      // 1. Resolve exact video metadata (aid, cid, title, duration) via Background Service Worker
      const resolveRes = await safeSendMessage<ResolvedVideoInfo>({
        type: 'RESOLVE_VIDEO_INFO',
        payload: { bvid: meta.bvid, pIndex: meta.pIndex },
      });

      if (!resolveRes.success || !resolveRes.data) {
        throw new Error(resolveRes.error || '解析视频信息失败');
      }

      const { bvid, cid, aid, title } = resolveRes.data;
      const videoKey = `${bvid}_p${meta.pIndex}_${cid}`;
      currentVideoKeyRef.current = videoKey;

      // 2. Check cache first if not forced
      if (!forceRefresh) {
        const cachedRes = await safeSendMessage<VideoSummaryResult | null>({
          type: 'GET_CACHED_SUMMARY',
          payload: { bvid, cid },
        });

        if (cachedRes.success && cachedRes.data) {
          if (currentVideoKeyRef.current === videoKey) {
            setSummary(cachedRes.data);
            setLoading(false);
            return;
          }
        }
      }

      // 3. Fetch subtitles via background
      const subRes = await safeSendMessage<BiliRawSubtitleItem[]>({
        type: 'FETCH_SUBTITLES',
        payload: { bvid, cid, aid },
      });

      if (!subRes.success || !subRes.data) {
        throw new Error(subRes.error || '该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
      }

      // 4. Generate summary via LLM (with auto-fallback failover)
      const sumRes = await safeSendMessage<VideoSummaryResult>({
        type: 'GENERATE_SUMMARY',
        payload: {
          bvid,
          cid,
          title,
          subtitles: subRes.data,
        },
      });

      if (!sumRes.success || !sumRes.data) {
        throw new Error(sumRes.error || '生成总结失败，请检查 API Key 配置。');
      }

      if (currentVideoKeyRef.current === videoKey) {
        setSummary(sumRes.data);
        if (sumRes.data.isFallbackUsed) {
          showToast(`⚡ 主模型异常，已自动启用兜底模型【${sumRes.data.usedModel}】完成提炼`);
        }
      }
    } catch (err: any) {
      console.error('[BiliFlow] Error loading summary:', err);
      setSummary(null);
      setError(err?.message || '处理发生异常');
    } finally {
      setLoading(false);
    }
  }, []);

  // Jump to specific highlight (safe timestamp check)
  const handleJump = useCallback((highlight: HighlightItem, index: number) => {
    setSelectedIndex(index);
    scrollToActiveItem(index);

    const targetSeconds =
      typeof highlight.timestamp === 'number'
        ? highlight.timestamp
        : (highlight.timestampSec ?? 0);

    const success = seekToSeconds(targetSeconds);
    if (success) {
      showToast(`已直达: [${highlight.timestampStr}] ${highlight.title}`);
    }
  }, [scrollToActiveItem]);

  // Synchronize Timeline Markers on Bilibili progress bar
  useEffect(() => {
    const updateMarkers = () => {
      if (summary?.highlights && summary.highlights.length > 0) {
        const duration = getVideoDuration();
        if (duration > 0) {
          const markers = calculateTimelineMarkers(summary.highlights, duration);
          renderTimelineMarkers(markers, (sec) => {
            seekToSeconds(sec);
            showToast('已跳转至选定亮点');
          });
        }
      } else {
        cleanupPlayerInjections();
      }
    };

    updateMarkers();
    const interval = setInterval(updateMarkers, 2000);
    return () => clearInterval(interval);
  }, [summary]);

  // Monitor SPA route/collection/multi-P changes on Bilibili
  useEffect(() => {
    let lastUrl = window.location.href;
    const interval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const meta = extractVideoMeta();
        if (meta?.bvid) {
          const newVideoKey = `${meta.bvid}_p${meta.pIndex}`;
          if (!currentVideoKeyRef.current.startsWith(newVideoKey)) {
            cleanupPlayerInjections();
            setSummary(null);
            setError(null);
            setSelectedIndex(0);
            setExpandedQuoteIds(new Set());
            if (isOpen) {
              loadSummaryForCurrentVideo();
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, loadSummaryForCurrentVideo]);

  // Global Keyboard Navigation (Full Screen & Windowed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUserTyping()) return;

      // Toggle HUD
      if (matchesShortcut(e, shortcutToggle)) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => {
          const next = !prev;
          if (next && !summary && !loading) {
            loadSummaryForCurrentVideo();
          }
          return next;
        });
        return;
      }

      if (!isOpen || !summary) return;

      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        return;
      }

      // Fast jump by number 1~9
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const targetIndex = num - 1;
        if (targetIndex < summary.highlights.length) {
          e.preventDefault();
          e.stopPropagation();
          handleJump(summary.highlights[targetIndex], targetIndex);
          return;
        }
      }

      // Next node (J or custom shortcut)
      if (matchesShortcut(e, shortcutNextNode || 'J')) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          const next = Math.min(prev + 1, summary.highlights.length - 1);
          handleJump(summary.highlights[next], next);
          return next;
        });
      }
      // Prev node (K or custom shortcut)
      else if (matchesShortcut(e, shortcutPrevNode || 'K')) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          handleJump(summary.highlights[next], next);
          return next;
        });
      }
      // Toggle Quotes of current node (O or custom shortcut)
      else if (matchesShortcut(e, shortcutToggleQuotes || 'O')) {
        e.preventDefault();
        e.stopPropagation();
        const currentItem = summary.highlights[selectedIndex];
        if (currentItem && currentItem.originalQuotes && currentItem.originalQuotes.length > 0) {
          const targetId = currentItem.id;
          setExpandedQuoteIds((prev) => {
            const next = new Set(prev);
            if (next.has(targetId)) next.delete(targetId);
            else next.add(targetId);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isOpen,
    summary,
    loading,
    shortcutToggle,
    shortcutPrevNode,
    shortcutNextNode,
    shortcutToggleQuotes,
    selectedIndex,
    loadSummaryForCurrentVideo,
    handleJump,
  ]);

  if (!isOpen) return null;

  const isDark = theme !== 'light';

  return (
    <div className="fixed inset-0 pointer-events-none z-[2147483647] font-sans antialiased select-none">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2147483647] flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-2xl shadow-xl shadow-sky-500/25 animate-fade-in pointer-events-auto">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Floating HUD Card Container */}
      <div
        className={`fixed top-14 right-6 w-[370px] sm:w-[410px] max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto transition-all duration-200 overflow-hidden animate-fade-in ${
          isDark
            ? 'bg-[#0f172a]/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
            : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-300/60'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/20">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  BiliFlow
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-500 font-bold">
                  HUD
                </span>
                {summary?.isFallbackUsed && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold">
                    <ShieldCheck className="w-2.5 h-2.5" /> 容灾兜底
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => loadSummaryForCurrentVideo(true)}
              disabled={loading}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="重新生成总结"
              aria-label="重新生成总结"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenOptions}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="打开设置工作台"
              aria-label="打开设置工作台"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="关闭 (Esc)"
              aria-label="关闭浮层"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body - with dedicated scrollContainerRef */}
        <div
          ref={scrollContainerRef}
          className="p-4 max-h-[70vh] overflow-y-auto scroll-smooth space-y-3.5"
        >
          {loading && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
              <p className="text-xs font-medium tracking-wide">
                正在智能提炼视频核心亮点...
              </p>
            </div>
          )}

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
                    onClick={handleOpenOptions}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline cursor-pointer pt-0.5 font-semibold"
                  >
                    <Settings className="w-3.5 h-3.5" /> 前往设置中心配置厂商与 API Key
                  </button>
                )}
              </div>
            </div>
          )}

          {summary && !loading && (
            <>
              {/* One Sentence Summary Card */}
              {summary.oneSentenceSummary && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
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
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
                  <span>核心亮点 (按数字键秒切)</span>
                  <span>{summary.highlights.length} 个节点</span>
                </div>

                <div className="space-y-1.5">
                  {summary.highlights.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isExpanded = expandedQuoteIds.has(item.id);
                    const hasQuotes = item.originalQuotes && item.originalQuotes.length > 0;

                    return (
                      <div
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleJump(item, idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleJump(item, idx);
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
                        {/* Number Key Badge */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-sky-500 text-white'
                              : isDark
                              ? 'bg-slate-700/60 text-slate-300 group-hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Text details */}
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
                                onClick={(e) => toggleQuoteExpand(item.id, e)}
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

                          {/* Expandable Original Quotes Section */}
                          {isExpanded && hasQuotes && (
                            <div
                              className={`mt-2 p-2.5 rounded-lg border text-[11px] space-y-1.5 transition-all ${
                                isDark
                                  ? 'bg-slate-900/90 border-slate-700/60 text-slate-300'
                                  : 'bg-slate-100/90 border-slate-200 text-slate-700'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1 border-b border-slate-700/30">
                                <span className="flex items-center gap-1 text-sky-400 font-medium">
                                  <Quote className="w-2.5 h-2.5" />
                                  <span>原文字幕依据</span>
                                </span>
                                <span className="text-[9px] text-slate-500">点击时间戳直达原句</span>
                              </div>
                              <div className="space-y-1.5 pt-0.5 max-h-36 overflow-y-auto">
                                {item.originalQuotes!.map((q, qIdx) => (
                                  <div key={qIdx} className="flex items-start gap-1.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        seekToSeconds(q.timestamp);
                                        showToast(`已跳至原句: [${q.timestampStr}]`);
                                      }}
                                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-mono text-[10px] text-sky-400 hover:text-white hover:bg-sky-500 transition-colors cursor-pointer shrink-0 mt-0.5"
                                      title={`跳转至 ${q.timestampStr}`}
                                    >
                                      <Clock className="w-2.5 h-2.5" />
                                      {q.timestampStr}
                                    </button>
                                    <span className="leading-relaxed text-slate-300 break-words flex-1">
                                      {q.content}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 self-center transition-transform shrink-0 ${
                            isSelected
                              ? 'text-sky-500 translate-x-0.5'
                              : 'text-slate-400 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Follow up questions */}
              {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <HelpCircle className="w-3 h-3 text-sky-500" />
                    <span>延伸思考</span>
                  </div>
                  <div className="space-y-1">
                    {summary.followUpQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className={`text-[11px] rounded-lg px-2.5 py-1.5 transition-colors border ${
                          isDark
                            ? 'text-slate-300 bg-slate-800/30 hover:bg-slate-800/60 border-slate-700/30'
                            : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcuts Matrix */}
        <div
          className={`px-4 py-2.5 border-t flex items-center justify-between text-[10px] font-mono ${
            isDark
              ? 'bg-slate-950/70 border-slate-800 text-slate-400'
              : 'bg-slate-50 border-slate-100 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                1~{summary?.highlights.length || 5}
              </kbd>{' '}
              直达
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {shortcutPrevNode || 'K'}/{shortcutNextNode || 'J'}
              </kbd>{' '}
              选择
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {shortcutToggleQuotes || 'O'}
              </kbd>{' '}
              字幕
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {shortcutToggle}
              </kbd>{' '}
              显隐
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                Esc
              </kbd>{' '}
              退出
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
