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
  RotateCcw,
} from 'lucide-react';
import {
  ExtensionMessage,
  ExtensionResponse,
  HighlightItem,
  VideoSummaryResult,
  BiliRawSubtitleItem,
  UserSettings,
  ThemeMode,
} from '../../types';
import {
  extractVideoMeta,
  isUserTyping,
  seekToSeconds,
} from '../../utils/playerController';

async function safeSendMessage<T = any>(
  msg: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  if (!chrome.runtime?.id) {
    return {
      success: false,
      error: 'BiliFlow 扩展已更新或重载。请按 F5 刷新此网页即可恢复使用。',
    };
  }
  try {
    const res = await chrome.runtime.sendMessage(msg);
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
  if (!shortcutStr) return e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS');

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
  const [shortcutStr, setShortcutStr] = useState<string>('Alt+S');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const currentBvidRef = useRef<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1800);
  };

  // Load custom settings & listen for live changes
  useEffect(() => {
    (async () => {
      const res = await safeSendMessage<UserSettings>({ type: 'GET_SETTINGS' });
      if (res.success && res.data) {
        if (res.data.shortcutToggle) setShortcutStr(res.data.shortcutToggle);
        if (res.data.theme) setTheme(res.data.theme);
      }
    })();

    const handleStorageChange = (changes: any) => {
      if (changes.user_settings?.newValue) {
        const val: UserSettings = changes.user_settings.newValue;
        if (val.shortcutToggle) setShortcutStr(val.shortcutToggle);
        if (val.theme) setTheme(val.theme);
      }
    };

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
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
        const cachedRes = await safeSendMessage<VideoSummaryResult | null>({
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
      const subRes = await safeSendMessage<BiliRawSubtitleItem[]>({
        type: 'FETCH_SUBTITLES',
        payload: { bvid: meta.bvid, cid, aid },
      });

      if (!subRes.success || !subRes.data) {
        throw new Error(subRes.error || '获取字幕失败，该视频可能没有字幕。');
      }

      // 2. Generate summary via LLM
      const sumRes = await safeSendMessage<VideoSummaryResult>({
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
      if (isUserTyping()) return;

      // Toggle HUD with user-defined shortcut
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

        // J/K or Up/Down
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

  const isDark = theme !== 'light';

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
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-full shadow-xl backdrop-blur-md border transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-slate-900/85 hover:bg-slate-900/95 text-slate-200 border-slate-700/60'
              : 'bg-white/90 hover:bg-white text-slate-800 border-slate-200 shadow-slate-200'
          }`}
          title={`点击或按 ${shortcutStr} 唤起 BiliFlow`}
          aria-haspopup="dialog"
        >
          <Sparkles className="w-4 h-4 text-sky-500 group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-xs font-semibold tracking-wide">BiliFlow</span>
          <kbd
            className={`hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded border ${
              isDark
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
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
      <div
        className={`flex flex-col border rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#0f172a]/95 text-slate-100 border-slate-700/70'
            : 'bg-white/95 text-slate-800 border-slate-200 shadow-slate-300'
        }`}
      >
        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="bg-sky-500 text-white text-[11px] font-semibold py-1 px-3 flex items-center justify-center gap-1.5 animate-fade-in shadow-inner">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="truncate">{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-sky-500/15 text-sky-500">
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

        {/* Content Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3.5">
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
              <div className="text-xs space-y-1.5 min-w-0">
                <p className="font-semibold text-rose-500">获取失败</p>
                <p className="opacity-90 leading-relaxed break-all">{error}</p>
                {error.includes('刷新') ? (
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 text-white text-[11px] font-semibold transition-all hover:bg-sky-400 cursor-pointer mt-1"
                  >
                    <RotateCcw className="w-3 h-3" /> 立即按 F5 刷新网页
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (chrome.runtime?.openOptionsPage) {
                        chrome.runtime.openOptionsPage();
                      } else {
                        window.open(chrome.runtime.getURL('options.html'));
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline cursor-pointer pt-0.5"
                  >
                    <Settings className="w-3 h-3" /> 前往设置中心配置厂商与 API Key
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
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold text-xs truncate ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.2 rounded border ${
                                isDark
                                  ? 'text-sky-300 bg-sky-950/60 border-sky-800/40'
                                  : 'text-sky-700 bg-sky-50 border-sky-200'
                              }`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {item.timestampStr}
                            </span>
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
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 self-center transition-transform ${
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
                J/K
              </kbd>{' '}
              选择
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <kbd
                className={`px-1 py-0.5 rounded border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {shortcutStr}
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
