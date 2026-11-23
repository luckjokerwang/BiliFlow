import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { safeSendMessage } from '../../../utils/extensionMessaging';
import {
  VideoSummaryResult,
  ResolvedVideoInfo,
  BiliRawSubtitleItem,
} from '../../../types';
import {
  evaluateAutoSummaryGate,
  type AutoSummarySkipReason,
} from '../../../utils/autoSummaryPolicy';
import {
  TranscriptLoadResult,
  TranscriptRequestCoordinator,
} from './transcriptRequestCoordinator';
import { UserSettings } from '../../../types/settings';
import {
  extractVideoMeta,
  getVideoDuration,
  getVideoElement,
} from '../../../utils/playerController';
import { cleanupPlayerInjections } from '../../../utils/playerInjector';
import { onSpaNavigate } from '../../../utils/spaNavigation';
import { isCachedSummaryValid } from '../../../services/summaryCacheService';

export interface UseAutoSummaryProps {
  settings: UserSettings;
  settingsReady: boolean;
  onToast?: (msg: string) => void;
}

export interface UseAutoSummaryReturn {
  summary: VideoSummaryResult | null;
  loading: boolean;
  error: string | null;
  isManualMode: boolean;
  manualReason: AutoSummarySkipReason | null;
  videoInfo: ResolvedVideoInfo | null;
  subtitles: BiliRawSubtitleItem[];
  transcriptLoading: boolean;
  transcriptError: string | null;
  triggerSummary: (forceRefresh?: boolean) => Promise<void>;
  retrySummary: () => Promise<void>;
  retryTranscript: () => Promise<void>;
}

export function useAutoSummary({
  settings,
  settingsReady,
  onToast,
}: UseAutoSummaryProps): UseAutoSummaryReturn {
  const [summary, setSummary] = useState<VideoSummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [manualReason, setManualReason] = useState<AutoSummarySkipReason | null>(null);
  const [videoInfo, setVideoInfo] = useState<ResolvedVideoInfo | null>(null);
  const [subtitles, setSubtitles] = useState<BiliRawSubtitleItem[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState<boolean>(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const coordinator = useMemo(
    () =>
      new TranscriptRequestCoordinator((state) => {
        setSubtitles(state.items);
        setTranscriptLoading(state.loading);
        setTranscriptError(state.error);
      }),
    []
  );

  const currentVideoKeyRef = useRef<string>('');
  const summaryAbortControllerRef = useRef<AbortController | null>(null);
  const summaryRequestIdRef = useRef<number>(0);
  const videoEpochRef = useRef<number>(0);
  const resolvedInfoRef = useRef<ResolvedVideoInfo | null>(null);

  const loadTranscript = useCallback(
    (
      videoKey: string,
      info: ResolvedVideoInfo,
      force = false
    ): Promise<TranscriptLoadResult> => {
      const loader = async (): Promise<BiliRawSubtitleItem[]> => {
        const res = await safeSendMessage<BiliRawSubtitleItem[]>({
          type: 'FETCH_SUBTITLES',
          payload: { bvid: info.bvid, cid: info.cid, aid: info.aid },
        });
        if (!res.success) {
          throw new Error(res.error || '获取全文字幕失败');
        }
        return Array.isArray(res.data) ? res.data : [];
      };

      return force
        ? coordinator.retry(videoKey, loader)
        : coordinator.ensure(videoKey, loader);
    },
    [coordinator]
  );

  const awaitCurrentTranscript = useCallback(
    async (
      videoKey: string,
      info: ResolvedVideoInfo,
      requestId: number,
      abortSignal: AbortSignal,
      videoEpoch: number
    ): Promise<BiliRawSubtitleItem[]> => {
      const isStale = () =>
        abortSignal.aborted ||
        requestId !== summaryRequestIdRef.current ||
        videoEpoch !== videoEpochRef.current ||
        currentVideoKeyRef.current !== videoKey;

      while (true) {
        if (isStale()) return [];
        const result = await loadTranscript(videoKey, info);
        if (result.status === 'superseded') {
          if (isStale()) return [];
          continue;
        }
        if (result.status === 'error') {
          throw new Error(result.error);
        }
        if (result.items.length === 0) {
          throw new Error('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
        }
        return result.items;
      }
    },
    [loadTranscript]
  );

  const loadSummaryForCurrentVideo = useCallback(
    async (forceRefresh = false, explicitManualTrigger = false) => {
      const meta = extractVideoMeta();
      if (!meta || !meta.bvid) {
        coordinator.reset();
        setSummary(null);
        setError('未检测到正在播放的 B 站视频');
        return;
      }

      if (summaryAbortControllerRef.current) {
        summaryAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      summaryAbortControllerRef.current = abortController;
      const requestId = ++summaryRequestIdRef.current;
      const videoEpoch = videoEpochRef.current;

      setError(null);

      if (forceRefresh && meta.bvid) {
        safeSendMessage({
          type: 'DELETE_CACHED_SUMMARY',
          payload: { bvid: meta.bvid, cid: resolvedInfoRef.current?.cid || '' },
        }).catch(() => {});
      }

      try {
        const resolveRes = await safeSendMessage<ResolvedVideoInfo>({
          type: 'RESOLVE_VIDEO_INFO',
          payload: { bvid: meta.bvid, pIndex: meta.pIndex },
        });

        if (
          abortController.signal.aborted ||
          requestId !== summaryRequestIdRef.current ||
          videoEpoch !== videoEpochRef.current
        ) {
          return;
        }

        if (!resolveRes.success || !resolveRes.data) {
          throw new Error(resolveRes.error || '解析视频信息失败');
        }

        const resolved = resolveRes.data;
        resolvedInfoRef.current = resolved;
        const videoDuration = resolved.duration || getVideoDuration() || 0;
        resolved.duration = videoDuration;
        setVideoInfo(resolved);

        const videoKey = `${resolved.bvid}_p${meta.pIndex}_${resolved.cid}`;
        currentVideoKeyRef.current = videoKey;

        void loadTranscript(videoKey, resolved);

        if (!forceRefresh) {
          const cachedRes = await safeSendMessage<VideoSummaryResult | null>({
            type: 'GET_CACHED_SUMMARY',
            payload: { bvid: resolved.bvid, cid: resolved.cid },
          });

          if (
            abortController.signal.aborted ||
            requestId !== summaryRequestIdRef.current ||
            videoEpoch !== videoEpochRef.current
          ) {
            return;
          }

          if (cachedRes.success && cachedRes.data) {
            const cached = cachedRes.data;
            const isValid = isCachedSummaryValid(cached, {
              bvid: resolved.bvid,
              cid: resolved.cid,
              title: resolved.title,
              duration: videoDuration,
            });

            if (isValid && currentVideoKeyRef.current === videoKey) {
              setSummary(cached);
              setIsManualMode(false);
              setManualReason(null);
              setLoading(false);
              return;
            }

            console.warn(
              '[BiliFlow] Cached summary mismatch or corrupted, auto-purging:',
              videoKey
            );
            safeSendMessage({
              type: 'DELETE_CACHED_SUMMARY',
              payload: { bvid: resolved.bvid, cid: resolved.cid },
            }).catch(() => {});
          }
        }

        const gate = evaluateAutoSummaryGate({
          autoSummarize: settings.autoSummarize,
          minDurationForAutoSec: settings.minDurationForAutoSec,
          durationSec: videoDuration,
          category: resolved.category,
          categoryMode: settings.autoSummaryCategoryMode,
          selectedCategories: settings.autoSummarizeCategories,
        });

        if (!explicitManualTrigger && !gate.allowed) {
          setManualReason(gate.reason);
          setIsManualMode(true);
          setLoading(false);
          setSummary(null);
          return;
        }

        setManualReason(null);
        setIsManualMode(false);
        setLoading(true);
        setSummary(null);

        const transcriptItems = await awaitCurrentTranscript(
          videoKey,
          resolved,
          requestId,
          abortController.signal,
          videoEpoch
        );

        if (
          abortController.signal.aborted ||
          requestId !== summaryRequestIdRef.current ||
          videoEpoch !== videoEpochRef.current ||
          transcriptItems.length === 0
        ) {
          return;
        }

        const sumRes = await safeSendMessage<VideoSummaryResult>({
          type: 'GENERATE_SUMMARY',
          payload: {
            bvid: resolved.bvid,
            cid: resolved.cid,
            aid: resolved.aid,
            title: resolved.title,
            durationSec: videoDuration,
            description: resolved.description,
            subtitles: transcriptItems,
          },
        });

        if (
          abortController.signal.aborted ||
          requestId !== summaryRequestIdRef.current ||
          videoEpoch !== videoEpochRef.current
        ) {
          return;
        }

        if (!sumRes.success || !sumRes.data) {
          throw new Error(sumRes.error || '生成总结失败，请检查 API Key 配置。');
        }

        if (currentVideoKeyRef.current === videoKey) {
          setSummary(sumRes.data);
          if (sumRes.data.isFallbackUsed) {
            const label = sumRes.data.usedProviderName
              ? `【${sumRes.data.usedProviderName} · ${sumRes.data.usedModel}】`
              : `【${sumRes.data.usedModel}】`;
            onToast?.(`⚡ 主用服务异常，已自动启用兜底${label}完成提炼`);
          }
        }
      } catch (err: unknown) {
        if (
          abortController.signal.aborted ||
          requestId !== summaryRequestIdRef.current ||
          videoEpoch !== videoEpochRef.current
        ) {
          return;
        }
        console.error('[BiliFlow] Error loading summary:', err);
        setSummary(null);
        setError(err instanceof Error ? err.message : String(err));

        if (resolvedInfoRef.current?.bvid && resolvedInfoRef.current?.cid) {
          safeSendMessage({
            type: 'DELETE_CACHED_SUMMARY',
            payload: {
              bvid: resolvedInfoRef.current.bvid,
              cid: resolvedInfoRef.current.cid,
            },
          }).catch(() => {});
        }
      } finally {
        if (
          !abortController.signal.aborted &&
          requestId === summaryRequestIdRef.current &&
          videoEpoch === videoEpochRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [
      settings.autoSummarize,
      settings.minDurationForAutoSec,
      settings.autoSummaryCategoryMode,
      settings.autoSummarizeCategories,
      onToast,
      coordinator,
      loadTranscript,
      awaitCurrentTranscript,
    ]
  );

  useEffect(() => {
    if (!settingsReady) return;

    let lastObservedKey = '';

    const handleVideoChange = (force = false) => {
      const meta = extractVideoMeta();
      const newKey = meta ? `${meta.bvid}_p${meta.pIndex}` : '';
      if (!force && newKey && newKey === lastObservedKey) {
        return;
      }
      lastObservedKey = newKey;

      if (summaryAbortControllerRef.current) {
        summaryAbortControllerRef.current.abort();
      }
      summaryRequestIdRef.current++;
      videoEpochRef.current++;
      coordinator.reset();
      resolvedInfoRef.current = null;

      setSummary(null);
      setError(null);
      setLoading(false);
      setIsManualMode(false);
      setManualReason(null);
      setVideoInfo(null);
      currentVideoKeyRef.current = '';

      cleanupPlayerInjections();
      loadSummaryForCurrentVideo(false, false);
    };

    handleVideoChange(true);

    const unsubscribeSpa = onSpaNavigate(() => {
      handleVideoChange(false);
    });

    let playlistObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      playlistObserver = new MutationObserver(() => {
        const meta = extractVideoMeta();
        const currentKey = meta ? `${meta.bvid}_p${meta.pIndex}` : '';
        if (currentKey && currentKey !== lastObservedKey) {
          handleVideoChange(false);
        }
      });

      const playlistTarget =
        document.querySelector('.video-pod__list') ||
        document.querySelector('.cur-list') ||
        document.querySelector('.multi-page') ||
        document.body;

      if (playlistTarget) {
        playlistObserver.observe(playlistTarget, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['class'],
        });
      }
    }

    let currentAttachedVideo: HTMLVideoElement | null = null;
    const handleVideoLoaded = () => {
      const meta = extractVideoMeta();
      const currentKey = meta ? `${meta.bvid}_p${meta.pIndex}` : '';
      if (currentKey && currentKey !== lastObservedKey) {
        handleVideoChange(false);
      }
    };

    const attachVideoListeners = () => {
      const video = getVideoElement();
      if (video && video !== currentAttachedVideo) {
        if (currentAttachedVideo) {
          currentAttachedVideo.removeEventListener('loadeddata', handleVideoLoaded);
          currentAttachedVideo.removeEventListener('emptied', handleVideoLoaded);
        }
        video.addEventListener('loadeddata', handleVideoLoaded);
        video.addEventListener('emptied', handleVideoLoaded);
        currentAttachedVideo = video;
      }
    };

    attachVideoListeners();
    const videoAttachTimer = setInterval(attachVideoListeners, 2000);

    return () => {
      unsubscribeSpa();
      playlistObserver?.disconnect();
      if (currentAttachedVideo) {
        currentAttachedVideo.removeEventListener('loadeddata', handleVideoLoaded);
        currentAttachedVideo.removeEventListener('emptied', handleVideoLoaded);
      }
      clearInterval(videoAttachTimer);
      if (summaryAbortControllerRef.current) {
        summaryAbortControllerRef.current.abort();
      }
      cleanupPlayerInjections();
    };
  }, [loadSummaryForCurrentVideo, coordinator, settingsReady]);

  const triggerSummary = useCallback(
    async (forceRefresh = false) => {
      await loadSummaryForCurrentVideo(forceRefresh, true);
    },
    [loadSummaryForCurrentVideo]
  );

  const retrySummary = useCallback(async () => {
    await loadSummaryForCurrentVideo(true, true);
  }, [loadSummaryForCurrentVideo]);

  const retryTranscript = useCallback(async () => {
    const videoKey = currentVideoKeyRef.current;
    const info = resolvedInfoRef.current;
    if (!videoKey || !info) return;
    await loadTranscript(videoKey, info, true);
  }, [loadTranscript]);

  return {
    summary,
    loading,
    error,
    isManualMode,
    manualReason,
    videoInfo,
    subtitles,
    transcriptLoading,
    transcriptError,
    triggerSummary,
    retrySummary,
    retryTranscript,
  };
}
