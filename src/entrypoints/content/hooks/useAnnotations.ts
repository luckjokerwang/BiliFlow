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

export interface UseAnnotationsProps {
  bvid?: string;
  cid?: string;
  onToast?: (msg: string) => void;
}

export function useAnnotations({ bvid, cid, onToast }: UseAnnotationsProps) {
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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

  // Insert single card (AI point + user thought) into Bilibili native note editor
  const insertCardToNativeNote = useCallback(
    async (
      highlight: HighlightItem,
      annotation?: UserAnnotation,
      withScreenshot: boolean = false
    ): Promise<boolean> => {
      setIsSyncing(true);
      try {
        // 1. Ensure Bilibili native note panel is open
        const opened = await BiliNoteDomController.ensureNativeNoteOpen();
        if (!opened) {
          onToast?.('✕ 未能唤起 B站记笔记面板，请确认已登录或手动展开右侧笔记');
          return false;
        }

        // 2. Format HTML and inject at cursor
        const html = formatCardToNoteHtml(highlight, annotation);
        const anchorEl = BiliNoteDomController.insertHtmlAtCursor(html);

        // 3. If user requested screenshot, trigger native screenshot button at anchor element
        if (withScreenshot) {
          const res = await BiliNoteDomController.triggerNativeScreenshotAt(anchorEl);
          if (res.success) {
            onToast?.(`✓ 已将 [${highlight.timestampStr}] 观点与截图记入 B站笔记`);
          } else {
            onToast?.(`✓ 已将 [${highlight.timestampStr}] 观点记入笔记 (未能自动截屏)`);
          }
        } else {
          onToast?.(`✓ 已将 [${highlight.timestampStr}] 观点记入 B站笔记`);
        }

        return true;
      } catch (err: any) {
        console.error('[BiliFlow] Insert to native note failed:', err);
        onToast?.(`✕ 记入失败: ${err?.message || '未知错误'}`);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [onToast]
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
        const opened = await BiliNoteDomController.ensureNativeNoteOpen();
        if (!opened) {
          onToast?.('✕ 未能唤起 B站记笔记面板，请确认已登录或手动点击播放器下方的「记笔记」');
          return;
        }

        // Format HTML for all highlights and notes
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
        onToast?.('✓ 已将整篇 AI 精读与感悟完整导入 B站官方笔记');
      } catch (err: any) {
        console.error('[BiliFlow] Export full to native note failed:', err);
        onToast?.(`✕ 导入失败: ${err?.message || '请重试'}`);
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
