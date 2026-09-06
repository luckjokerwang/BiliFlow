import { useState, useEffect, useCallback, useRef } from 'react';
import { browser } from 'wxt/browser';
import {
  ExtensionMessage,
  ExtensionResponse,
  VideoSummaryResult,
  ResolvedVideoInfo,
  BiliRawSubtitleItem,
} from '../../../types';
import { UserSettings } from '../../../types/settings';
import { extractVideoMeta, getVideoDuration } from '../../../utils/playerController';

export interface UseAutoSummaryProps {
  settings: UserSettings;
  onToast?: (msg: string) => void;
}

export interface UseAutoSummaryReturn {
  summary: VideoSummaryResult | null;
  loading: boolean;
  error: string | null;
  isManualMode: boolean;
  videoInfo: ResolvedVideoInfo | null;
  triggerSummary: (forceRefresh?: boolean) => Promise<void>;
  retrySummary: () => Promise<void>;
}

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

export function useAutoSummary({
  settings,
  onToast,
}: UseAutoSummaryProps): UseAutoSummaryReturn {
  const [summary, setSummary] = useState<VideoSummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [videoInfo, setVideoInfo] = useState<ResolvedVideoInfo | null>(null);

  const currentVideoKeyRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSummaryForCurrentVideo = useCallback(
    async (forceRefresh = false, explicitManualTrigger = false) => {
      const meta = extractVideoMeta();
      if (!meta || !meta.bvid) {
        setSummary(null);
        setError('未检测到正在播放的 B 站视频');
        return;
      }

      // Cancel any previous in-flight task
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setError(null);

      try {
        // 1. Resolve video metadata
        const resolveRes = await safeSendMessage<ResolvedVideoInfo>({
          type: 'RESOLVE_VIDEO_INFO',
          payload: { bvid: meta.bvid, pIndex: meta.pIndex },
        });

        if (abortController.signal.aborted) return;

        if (!resolveRes.success || !resolveRes.data) {
          throw new Error(resolveRes.error || '解析视频信息失败');
        }

        const resolved = resolveRes.data;
        const videoDuration = resolved.duration || getVideoDuration() || 0;
        resolved.duration = videoDuration;
        setVideoInfo(resolved);

        const videoKey = `${resolved.bvid}_p${meta.pIndex}_${resolved.cid}`;
        currentVideoKeyRef.current = videoKey;

        // 2. Check cached summary if not forced
        if (!forceRefresh) {
          const cachedRes = await safeSendMessage<VideoSummaryResult | null>({
            type: 'GET_CACHED_SUMMARY',
            payload: { bvid: resolved.bvid, cid: resolved.cid },
          });

          if (abortController.signal.aborted) return;

          if (cachedRes.success && cachedRes.data) {
            if (currentVideoKeyRef.current === videoKey) {
              setSummary(cachedRes.data);
              setIsManualMode(false);
              setLoading(false);
              return;
            }
          }
        }

        // 3. Evaluate Feature Flags for Auto-Summarization
        const isDurationTooShort =
          videoDuration > 0 &&
          typeof settings.minDurationForAutoSec === 'number' &&
          videoDuration < settings.minDurationForAutoSec;

        const shouldAutoSummarize =
          settings.autoSummarize && !isDurationTooShort;

        if (!explicitManualTrigger && !shouldAutoSummarize) {
          // Switch to manual mode, do not call LLM automatically
          setIsManualMode(true);
          setLoading(false);
          setSummary(null);
          return;
        }

        // Explicit or automatic trigger: start generation
        setIsManualMode(false);
        setLoading(true);
        setSummary(null);

        // 4. Fetch subtitles
        const subRes = await safeSendMessage<BiliRawSubtitleItem[]>({
          type: 'FETCH_SUBTITLES',
          payload: { bvid: resolved.bvid, cid: resolved.cid, aid: resolved.aid },
        });

        if (abortController.signal.aborted) return;

        const validSubtitles = Array.isArray(subRes.data)
          ? subRes.data.filter((item) => item && item.content && item.content.trim().length > 0)
          : [];

        if (!subRes.success || validSubtitles.length === 0) {
          throw new Error(subRes.error || '该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
        }

        // 5. Generate summary via LLM
        const sumRes = await safeSendMessage<VideoSummaryResult>({
          type: 'GENERATE_SUMMARY',
          payload: {
            bvid: resolved.bvid,
            cid: resolved.cid,
            title: resolved.title,
            subtitles: subRes.data,
          },
        });

        if (abortController.signal.aborted) return;

        if (!sumRes.success || !sumRes.data) {
          throw new Error(sumRes.error || '生成总结失败，请检查 API Key 配置。');
        }

        if (currentVideoKeyRef.current === videoKey) {
          setSummary(sumRes.data);
          if (sumRes.data.isFallbackUsed) {
            onToast?.(`⚡ 主模型异常，已自动启用兜底模型【${sumRes.data.usedModel}】完成提炼`);
          }
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        console.error('[BiliFlow] Error loading summary:', err);
        setSummary(null);
        setError(err?.message || '处理发生异常');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [settings.autoSummarize, settings.minDurationForAutoSec, onToast]
  );

  // Monitor SPA URL / Video changes
  useEffect(() => {
    let lastUrl = window.location.href;

    const checkUrl = () => {
      const cur = window.location.href;
      if (cur !== lastUrl) {
        lastUrl = cur;
        loadSummaryForCurrentVideo(false, false);
      }
    };

    loadSummaryForCurrentVideo(false, false);

    const interval = setInterval(checkUrl, 1000);
    window.addEventListener('popstate', checkUrl);

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', checkUrl);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadSummaryForCurrentVideo]);

  const triggerSummary = useCallback(
    async (forceRefresh = false) => {
      await loadSummaryForCurrentVideo(forceRefresh, true);
    },
    [loadSummaryForCurrentVideo]
  );

  const retrySummary = useCallback(async () => {
    await loadSummaryForCurrentVideo(true, true);
  }, [loadSummaryForCurrentVideo]);

  return {
    summary,
    loading,
    error,
    isManualMode,
    videoInfo,
    triggerSummary,
    retrySummary,
  };
}
