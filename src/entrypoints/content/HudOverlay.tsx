import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Clock,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import {
  ExtensionResponse,
  HighlightItem,
  VideoSummaryResult,
  BiliRawSubtitleItem,
  UserSettings,
} from '../../types';
import {
  extractVideoMeta,
  isUserTyping,
  seekToSeconds,
} from '../../utils/playerController';

function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return e.altKey && (e.key === 's' || e.key === 'S');
  const parts = shortcutStr.split('+').map((p) => p.trim().toLowerCase());
  const needCtrl = parts.includes('ctrl') || parts.includes('control');
  const needAlt = parts.includes('alt');
  const needShift = parts.includes('shift');
  const needMeta = parts.includes('meta') || parts.includes('cmd');

  if (e.ctrlKey !== needCtrl) return false;
  if (e.altKey !== needAlt) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.metaKey !== needMeta) return false;

  const keyPart = parts.find(
    (p) => !['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd'].includes(p)
  );
  if (!keyPart) return false;

  return (
    e.key.toLowerCase() === keyPart.toLowerCase() ||
    e.code.toLowerCase() === `key${keyPart.toLowerCase()}`
  );
}

export const HudOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<VideoSummaryResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [shortcutStr, setShortcutStr] = useState<string>('Alt+S');
  const currentBvidRef = useRef<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1800);
  };

  // Load custom shortcut from settings
  useEffect(() => {
    (async () => {
      try {
        const res: ExtensionResponse<UserSettings> = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res.success && res.data?.shortcutToggle) {
          setShortcutStr(res.data.shortcutToggle);
        }
      } catch (e) {
        console.error('Failed to load settings in HUD:', e);
      }
    })();

    const handleStorageChange = (changes: any) => {
      if (changes.user_settings?.newValue?.shortcutToggle) {
        setShortcutStr(changes.user_settings.newValue.shortcutToggle);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Fetch or generate summary for current video
  const loadSummaryForCurrentVideo = useCallback(async (forceRefresh = false) => {
    const meta = extractVideoMeta();
    if (!meta || !meta.bvid) {
      setError('未检测到有效的 B 站视频页面');
      return;
    }

    currentBvidRef.current = meta.bvid;
    let cid = meta.cid;
    let aid = meta.aid;
    let title = meta.title;

    setLoading(true);
    setError(null);

    try {
      if (!cid) {
        const infoRes = await fetch(
          `https://api.bilibili.com/x/web-interface/view?bvid=${meta.bvid}`
        );
        const infoData = await infoRes.json();
        if (infoData.code === 0 && infoData.data) {
          cid = String(infoData.data.cid);
          aid = String(infoData.data.aid);
          title = infoData.data.title || title;
        }
      }

      if (!cid) {
        throw new Error('未能获取当前视频的 CID 标识');
      }

      // Check cache first if not forced
      if (!forceRefresh) {
        const cachedRes: ExtensionResponse<VideoSummaryResult | null> =
          await chrome.runtime.sendMessage({
            type: 'GET_CACHED_SUMMARY',
            payload: { bvid: meta.bvid, cid },
          });

        if (cachedRes.success && cachedRes.data) {
          setSummary(cachedRes.data);
          setLoading(false);
          return;
        }
      }

      // 1. Fetch subtitles via background
      const subRes: ExtensionResponse<BiliRawSubtitleItem[]> =
        await chrome.runtime.sendMessage({
          type: 'FETCH_SUBTITLES',
          payload: { bvid: meta.bvid, cid, aid },
        });

      if (!subRes.success || !subRes.data) {
        throw new Error(subRes.error || '获取字幕失败，该视频可能没有字幕。');
      }

      // 2. Generate summary via LLM
      const sumRes: ExtensionResponse<VideoSummaryResult> =
        await chrome.runtime.sendMessage({
          type: 'GENERATE_SUMMARY',
          payload: {
            bvid: meta.bvid,
            cid,
            title,
            subtitles: subRes.data,
          },
        });

      if (!sumRes.success || !sumRes.data) {
        throw new Error(sumRes.error || '生成总结失败，请检查 API Key 配置。');
      }

      setSummary(sumRes.data);
    } catch (err: any) {
      console.error('[BiliFlow] Error loading summary:', err);
      setError(err?.message || '处理发生异常');
    } finally {
      setLoading(false);
    }
  }, []);

  // Jump to specific highlight
  const handleJump = useCallback((highlight: HighlightItem, index: number) => {
    setSelectedIndex(index);
    const success = seekToSeconds(highlight.timestamp);
    if (success) {
      showToast(`已直达: [${highlight.timestampStr}] ${highlight.title}`);
    }
  }, []);

  // Monitor SPA route/video changes on Bilibili
  useEffect(() => {
    let lastUrl = window.location.href;
    const interval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const meta = extractVideoMeta();
        if (meta?.bvid && meta.bvid !== currentBvidRef.current) {
          setSummary(null);
          setError(null);
          if (isOpen) {
            loadSummaryForCurrentVideo();
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, loadSummaryForCurrentVideo]);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when user is typing in comments/search
      if (isUserTyping()) return;

      // Toggle HUD with user custom shortcut
      if (matchesShortcut(e, shortcutStr)) {
        e.preventDefault();
        setIsOpen((prev) => {
          const next = !prev;
          if (next && !summary && !loading) {
            loadSummaryForCurrentVideo();
          }
          return next;
        });
        return;
      }

      // Active keyboard controls when HUD is open
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (summary && summary.highlights.length > 0) {
        // Direct number key jump (1 ~ 9)
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= summary.highlights.length) {
          e.preventDefault();
          const target = summary.highlights[num - 1];
          handleJump(target, num - 1);
          return;
        }

        // Navigation via J/K or Up/Down
        if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = (prev + 1) % summary.highlights.length;
            const target = summary.highlights[next];
            seekToSeconds(target.timestamp);
            showToast(`[${target.timestampStr}] ${target.title}`);
            return next;
          });
          return;
        }

        if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next =
              (prev - 1 + summary.highlights.length) % summary.highlights.length;
            const target = summary.highlights[next];
            seekToSeconds(target.timestamp);
            showToast(`[${target.timestampStr}] ${target.title}`);
            return next;
          });
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          const target = summary.highlights[selectedIndex];
          if (target) {
            handleJump(target, selectedIndex);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isOpen,
    summary,
    loading,
    selectedIndex,
    shortcutStr,
    handleJump,
    loadSummaryForCurrentVideo,
  ]);

  // If HUD is closed, render subtle floating trigger pill
  if (!isOpen) {
    return (
      <div className="fixed top-20 right-6 z-[999999]" aria-label="BiliFlow 快捷入口">
        <button
          onClick={() => {
            setIsOpen(true);
            if (!summary && !loading) {
              loadSummaryForCurrentVideo();
            }
          }}
          className="group flex items-center gap-2 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-900/95 text-slate-200 border border-slate-700/60 rounded-full shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          title={`点击或按 ${shortcutStr} 唤起 BiliFlow`}
          aria-haspopup="dialog"
        >
          <Sparkles className="w-4 h-4 text-sky-400 group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-xs font-medium tracking-wide">BiliFlow</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-700">
            {shortcutStr}
          </kbd>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BiliFlow 极速导航浮层"
      className="fixed top-16 right-6 z-[999999] w-[420px] max-w-[calc(100vw-3rem)] animate-scale-in"
    >
      <div className="flex flex-col bg-slate-900/92 text-slate-100 border border-slate-700/70 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="bg-sky-500 text-white text-[11px] font-medium py-1 px-3 flex items-center justify-center gap-1.5 animate-fade-in shadow-inner">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="truncate">{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-sky-500/10 text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-white">
                  BiliFlow
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-medium">
                  HUD
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadSummaryForCurrentVideo(true)}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="重新生成总结"
              aria-label="重新生成总结"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="关闭 (Esc)"
              aria-label="关闭浮层"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3.5">
          {loading && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
              <p className="text-xs font-medium tracking-wide">
                正在静默解析字幕并提炼核心亮点...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-rose-300">获取失败</p>
                <p className="text-rose-200/90 leading-relaxed">{error}</p>
                <button
                  onClick={() => {
                    if (chrome.runtime.openOptionsPage) {
                      chrome.runtime.openOptionsPage();
                    } else {
                      window.open(chrome.runtime.getURL('options.html'));
                    }
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  <Settings className="w-3 h-3" /> 前往设置中心配置厂商与 API Key
                </button>
              </div>
            </div>
          )}

          {summary && !loading && (
            <>
              {/* One Sentence Summary Card */}
              {summary.oneSentenceSummary && (
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-200 text-xs leading-relaxed">
                  <span className="font-semibold text-sky-400 mr-1.5">⚡ 全片核心:</span>
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
                    return (
                      <div
                        key={item.id}
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
                            ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
                            : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/80 hover:border-slate-600/60'
                        }`}
                      >
                        {/* Number Key Badge */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-xs font-semibold shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-700/60 text-slate-300 group-hover:bg-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Text details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-white truncate">
                              {item.title}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-800/40">
                              <Clock className="w-2.5 h-2.5" />
                              {item.timestampStr}
                            </span>
                          </div>
                          {item.keyPoint && (
                            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                              {item.keyPoint}
                            </p>
                          )}
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 self-center transition-transform ${
                            isSelected
                              ? 'text-sky-400 translate-x-0.5'
                              : 'text-slate-500 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Follow up questions (if available) */}
              {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <HelpCircle className="w-3 h-3 text-sky-400" />
                    <span>延伸思考</span>
                  </div>
                  <div className="space-y-1">
                    {summary.followUpQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="text-[11px] text-slate-300 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/30 rounded-lg px-2.5 py-1.5 transition-colors"
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
        <div className="px-4 py-2.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
                1~{summary?.highlights.length || 5}
              </kbd>{' '}
              直达
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
                J/K
              </kbd>{' '}
              选择
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
                {shortcutStr}
              </kbd>{' '}
              显隐
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
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
