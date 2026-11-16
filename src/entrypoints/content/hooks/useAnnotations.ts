import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NativeNoteInsertResult,
  UserAnnotation,
  UserAnnotationType,
} from '../../../types/biliNote';
import { HighlightItem, VideoSummaryResult } from '../../../types';
import {
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getAnnotationForHighlight,
} from '../../../services/annotationService';
import { formatCardToNoteHtml } from '../../../utils/biliNoteFormatter';
import { BiliNoteDomController } from '../../../utils/biliNoteDomController';
import {
  enqueueNoteSync,
  getPendingNoteSyncs,
  hasInjectedNote,
  subscribeNoteSyncQueueChange,
} from '../../../services/noteSyncQueueService';
import { flushNoteSyncQueue, setNoteSyncVideoKey } from '../../../utils/noteSyncReplay';

export interface UseAnnotationsProps {
  bvid?: string;
  cid?: string;
  onToast?: (msg: string) => void;
}

export function useAnnotations({ bvid, cid, onToast }: UseAnnotationsProps) {
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const currentVideoKeyRef = useRef<string>('');

  const refreshPendingCount = useCallback(async (): Promise<void> => {
    if (!bvid || !cid) {
      setPendingSyncCount(0);
      return;
    }
    const key = `${bvid}_${cid}`;
    const pending = await getPendingNoteSyncs(bvid, cid);
    if (currentVideoKeyRef.current === key) {
      setPendingSyncCount(pending.length);
    }
  }, [bvid, cid]);

  // Publish the API-resolved video key so the drawer watcher replays the right queue.
  useEffect(() => {
    currentVideoKeyRef.current = bvid && cid ? `${bvid}_${cid}` : '';
    setNoteSyncVideoKey(bvid, cid);
    void refreshPendingCount();
    return subscribeNoteSyncQueueChange(() => {
      void refreshPendingCount();
    });
  }, [bvid, cid, refreshPendingCount]);

  // Reload annotations when bvid/cid change
  useEffect(() => {
    if (!bvid || !cid) {
      setAnnotations([]);
      return;
    }

    const key = currentVideoKeyRef.current;
    getAnnotations(bvid, cid).then((list) => {
      if (currentVideoKeyRef.current === key) {
        setAnnotations(list);
      }
    });
  }, [bvid, cid]);

  // Save or update an annotation
  const handleSave = useCallback(
    async (data: {
      id?: string;
      timestamp: number;
      timestampStr: string;
      type?: UserAnnotationType;
      content: string;
      highlightId?: number | string;
      hasScreenshot?: boolean;
    }): Promise<UserAnnotation | void> => {
      if (!bvid || !cid) return;
      const key = `${bvid}_${cid}`;
      const saved = await saveAnnotation(bvid, cid, data);
      if (currentVideoKeyRef.current === key) {
        setAnnotations((prev) => {
          const idx = prev.findIndex((item) => item.id === saved.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = saved;
            return updated;
          }
          return [...prev, saved].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
      return saved;
    },
    [bvid, cid]
  );

  // Delete an annotation
  const handleDelete = useCallback(
    async (id: string): Promise<boolean | void> => {
      if (!bvid || !cid) return;
      const key = `${bvid}_${cid}`;
      const ok = await deleteAnnotation(bvid, cid, id);
      if (ok && currentVideoKeyRef.current === key) {
        setAnnotations((prev) => prev.filter((item) => item.id !== id));
      }
      return ok;
    },
    [bvid, cid]
  );

  // Get bound annotation for a specific highlight
  const getForHighlight = useCallback(
    (highlightId: number | string) => {
      return annotations.find(
        (a) => a.highlightId !== undefined && String(a.highlightId) === String(highlightId)
      );
    },
    [annotations]
  );

  // Text-only "记入笔记": always persisted locally first, then replayed into
  // Bilibili's official editor. Screenshots keep the native-button path.
  const insertCardToNativeNote = useCallback(
    async (
      highlight: HighlightItem,
      withScreenshot: boolean = false
    ): Promise<NativeNoteInsertResult> => {
      setIsSyncing(true);

      try {
        const itemKey = String(highlight.id ?? highlight.timestampStr ?? 'card');
        const latestAnnotation =
          bvid && cid
            ? await getAnnotationForHighlight(bvid, cid, itemKey)
            : undefined;
        const html = formatCardToNoteHtml(highlight, latestAnnotation);

        if (withScreenshot) {
          if (!BiliNoteDomController.isNativeNoteOpen()) {
            onToast?.('✕ 带截图记入需要先打开 B站官方笔记');
            return 'failed';
          }
          const anchorEl = BiliNoteDomController.insertHtmlAtCursor(html);
          if (!anchorEl) {
            onToast?.('✕ 未找到 B站笔记编辑器，请先打开笔记');
            return 'failed';
          }
          const res = await BiliNoteDomController.triggerNativeScreenshotAt(anchorEl);
          const msg = res.success
            ? `✓ 已写入 B站笔记编辑器：[${highlight.timestampStr}] 观点与截图`
            : `✓ 已写入 B站笔记编辑器：[${highlight.timestampStr}] 观点`;
          onToast?.(msg);
          return 'injected';
        }

        if (!bvid || !cid) {
          onToast?.('✕ 未识别当前视频，无法暂存笔记');
          return 'failed';
        }

        if (await hasInjectedNote(bvid, cid, itemKey)) {
          onToast?.('✓ 该段落已写入 B站笔记编辑器，无需重复注入');
          return 'injected';
        }

        const queued = await enqueueNoteSync({
          bvid,
          cid,
          itemKey,
          html,
          annotationText: latestAnnotation?.content,
        });
        if (!queued.enqueued) {
          const reason =
            queued.reason === 'full'
              ? '本地待同步已达 100 条上限，请先打开 B站笔记'
              : '内容无效，无法暂存';
          onToast?.(`✕ ${reason}`);
          return 'failed';
        }

        await refreshPendingCount();
        await BiliNoteDomController.ensureNativeNoteOpen();
        const injected = await flushNoteSyncQueue({
          inject: (fragment: string) => Boolean(BiliNoteDomController.insertHtmlAtCursor(fragment)),
          onToast,
        });
        await refreshPendingCount();

        if (injected > 0) {
          onToast?.(`✓ 已写入 B站笔记编辑器：[${highlight.timestampStr}] 观点`);
          return 'injected';
        }
        onToast?.('✓ 已存本地，打开 B站笔记后自动补写');
        return 'queued';
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[BiliFlow] Insert to native note failed:', err);
        onToast?.(`✕ 记入失败: ${errMsg}`);
        return 'failed';
      } finally {
        setIsSyncing(false);
      }
    },
    [bvid, cid, onToast, refreshPendingCount]
  );

  const retryPendingSyncs = useCallback(async (): Promise<number> => {
    if (!bvid || !cid) return 0;
    setIsSyncing(true);
    try {
      const pending = await getPendingNoteSyncs(bvid, cid);
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return 0;
      }

      await BiliNoteDomController.ensureNativeNoteOpen();
      const injected = await flushNoteSyncQueue({
        inject: (fragment: string) => Boolean(BiliNoteDomController.insertHtmlAtCursor(fragment)),
        onToast,
      });
      await refreshPendingCount();
      if (injected === 0) {
        onToast?.('仍待同步，请退出全屏或手动打开 B站笔记后重试');
      }
      return injected;
    } catch (err: unknown) {
      console.error('[BiliFlow] Retry pending note syncs failed:', err);
      onToast?.('仍待同步，请退出全屏或手动打开 B站笔记后重试');
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, [bvid, cid, onToast, refreshPendingCount]);

  // One-click quick capture: screenshot + native timestamp blot via shortcut
  const quickCapture = useCallback(async () => {
    onToast?.('⏳ 正在记录时间戳与截图...');
    try {
      const res = await BiliNoteDomController.quickCaptureCurrentFrame();
      if (res.success) {
        onToast?.(`✓ 已将 [${res.timestampStr || '当前画面'}] 截图与时间戳记入 B站笔记`);
        return true;
      }
      onToast?.(`✕ 记入失败: ${res.message || '未能唤起或写入 B站笔记'}`);
      return false;
    } catch (err: unknown) {
      console.error('[BiliFlow] Quick capture failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      onToast?.(`✕ 记入失败: ${errMsg || '未知错误'}`);
      return false;
    }
  }, [onToast]);

  // Export full study note (AI summary + all user annotations) into Bilibili native note
  const exportFullToNativeNote = useCallback(
    async (summary: VideoSummaryResult) => {
      if (!summary) return;
      setIsSyncing(true);
      try {
        const sessionResult = await BiliNoteDomController.withNativeNoteSession(async () => {
          const annotationMap = new Map<string, UserAnnotation>();
          if (bvid && cid) {
            for (const h of summary.highlights) {
              const ann = await getAnnotationForHighlight(bvid, cid, String(h.id));
              if (ann) annotationMap.set(String(h.id), ann);
            }
          }

          const fullHtml = summary.highlights
            .map((h) => formatCardToNoteHtml(h, annotationMap.get(String(h.id))))
            .join('');

          const headerHtml = `<h2>⚡ 《${summary.title || '视频'}》AI 精读笔记</h2>${
            summary.oneSentenceSummary
              ? `<p><strong>💡 全片核心：</strong>${summary.oneSentenceSummary}</p>`
              : ''
          }<hr>`;

          BiliNoteDomController.insertHtmlAtCursor(headerHtml + fullHtml);
        });

        if (!sessionResult.success) {
          onToast?.(`✕ ${sessionResult.error || '未能唤起 B站笔记'}`);
          return;
        }

        onToast?.('✓ 已将整篇 AI 精读与感悟完整导入 B站官方笔记');
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[BiliFlow] Export full to native note failed:', err);
        onToast?.(`✕ 导入失败: ${errMsg}`);
      } finally {
        setIsSyncing(false);
      }
    },
    [bvid, cid, onToast]
  );

  return {
    annotations,
    isSyncing,
    pendingSyncCount,
    retryPendingSyncs,
    saveAnnotation: handleSave,
    deleteAnnotation: handleDelete,
    getForHighlight,
    insertCardToNativeNote,
    exportFullToNativeNote,
    quickCapture,
  };
}
