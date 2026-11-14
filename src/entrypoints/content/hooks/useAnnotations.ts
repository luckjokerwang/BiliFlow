import { useState, useEffect, useCallback } from 'react';
import { UserAnnotation, UserAnnotationType, VideoStudyNote } from '../../../types/biliNote';
import { HighlightItem, VideoSummaryResult } from '../../../types';
import {
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
} from '../../../services/annotationService';
import {
  formatCardToNoteHtml,
  formatStudyNoteToDelta,
  formatStudyNoteToMarkdown,
} from '../../../utils/biliNoteFormatter';
import { BiliNoteDomController } from '../../../utils/biliNoteDomController';
import {
  enqueueNoteSync,
  hasInjectedNote,
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

  // Publish the API-resolved video key so the drawer watcher replays the right queue.
  useEffect(() => {
    setNoteSyncVideoKey(bvid, cid);
  }, [bvid, cid]);

  // Reload annotations when bvid/cid change
  useEffect(() => {
    if (!bvid || !cid) {
      setAnnotations([]);
      return;
    }

    let isMounted = true;
    getAnnotations(bvid, cid).then((list) => {
      if (isMounted) {
        setAnnotations(list);
      }
    });

    return () => {
      isMounted = false;
    };
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
    }) => {
      if (!bvid || !cid) return;
      const saved = await saveAnnotation(bvid, cid, data);
      setAnnotations((prev) => {
        const idx = prev.findIndex((item) => item.id === saved.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved].sort((a, b) => a.timestamp - b.timestamp);
      });
      return saved;
    },
    [bvid, cid]
  );

  // Delete an annotation
  const handleDelete = useCallback(
    async (id: string) => {
      if (!bvid || !cid) return;
      const ok = await deleteAnnotation(bvid, cid, id);
      if (ok) {
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
  // Bilibili's official editor (directly if the drawer is open, otherwise by
  // the mount watcher). Screenshots keep the native-button path, which needs
  // the drawer open and stores nothing locally.
  const insertCardToNativeNote = useCallback(
    async (
      highlight: HighlightItem,
      annotation?: UserAnnotation,
      withScreenshot: boolean = false
    ): Promise<boolean> => {
      setIsSyncing(true);

      try {
        if (withScreenshot) {
          // Screenshots must go through Bilibili's native camera button, which
          // only exists inside an already-open note drawer. Never auto-open it.
          if (!BiliNoteDomController.isNativeNoteOpen()) {
            onToast?.('✕ 带截图记入需要先打开 B站官方笔记');
            return false;
          }
          const html = formatCardToNoteHtml(highlight, annotation);
          const anchorEl = BiliNoteDomController.insertHtmlAtCursor(html);
          if (!anchorEl) {
            onToast?.('✕ 未找到 B站笔记编辑器，请先打开笔记');
            return false;
          }
          const res = await BiliNoteDomController.triggerNativeScreenshotAt(anchorEl);
          const msg = res.success
            ? `✓ 已将 [${highlight.timestampStr}] 观点与截图记入 B站笔记`
            : `✓ 已将 [${highlight.timestampStr}] 观点记入 B站笔记`;
          onToast?.(msg);
          return true;
        }

        if (!bvid || !cid) {
          onToast?.('✕ 未识别当前视频，无法暂存笔记');
          return false;
        }

        const itemKey = String(highlight.id ?? highlight.timestampStr ?? 'card');
        if (await hasInjectedNote(bvid, cid, itemKey)) {
          onToast?.('✓ 该段落已记入 B站笔记，无需重复注入');
          return true;
        }

        const html = formatCardToNoteHtml(highlight, annotation);
        const queued = await enqueueNoteSync({
          bvid,
          cid,
          itemKey,
          html,
          annotationText: annotation?.content,
        });
        if (!queued.enqueued) {
          const reason =
            queued.reason === 'full'
              ? '本地待同步已达 100 条上限，请先打开 B站笔记'
              : '内容无效，无法暂存';
          onToast?.(`✕ ${reason}`);
          return false;
        }

        const injected = await flushNoteSyncQueue({
          inject: (fragment: string) => Boolean(BiliNoteDomController.insertHtmlAtCursor(fragment)),
          onToast,
        });
        if (injected > 0) {
          onToast?.(`✓ 已将 [${highlight.timestampStr}] 观点同步至 B站官方笔记`);
        } else {
          onToast?.('✓ 已存本地，打开 B站笔记后自动补写');
        }
        return true;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[BiliFlow] Insert to native note failed:', err);
        onToast?.(`✕ 记入失败: ${errMsg}`);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [bvid, cid, onToast]
  );

  // One-click quick capture: screenshot + native timestamp blot via shortcut
  const quickCapture = useCallback(async () => {
    onToast?.('⏳ 正在记录时间戳与截图...');
    try {
      const res = await BiliNoteDomController.quickCaptureCurrentFrame();
      if (res.success) {
        onToast?.(`✓ 已将 [${res.timestampStr || '当前画面'}] 截图与时间戳记入 B站笔记`);
        return true;
      } else {
        onToast?.(`✕ 记入失败: ${res.message || '未能唤起或写入 B站笔记'}`);
        return false;
      }
    } catch (err: any) {
      console.error('[BiliFlow] Quick capture failed:', err);
      onToast?.(`✕ 记入失败: ${err?.message || '未知错误'}`);
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
          const fullHtml = summary.highlights
            .map((h) => {
              const ann = getForHighlight(h.id);
              return formatCardToNoteHtml(h, ann);
            })
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
    [getForHighlight, onToast]
  );

  return {
    annotations,
    isSyncing,
    saveAnnotation: handleSave,
    deleteAnnotation: handleDelete,
    getForHighlight,
    insertCardToNativeNote,
    exportFullToNativeNote,
    quickCapture,
  };
}
