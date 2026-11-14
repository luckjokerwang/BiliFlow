import { BiliNoteDomController } from './biliNoteDomController';
import {
  getPendingNoteSyncs,
  markInjected,
  markSynced,
} from '../services/noteSyncQueueService';

// ==========================================
// Native Note Drawer Replay Watcher
// ==========================================
//
// Bilibili mounts `.ql-editor` only while the note drawer is open. A
// MutationObserver on `document.body` detects that mount and replays the
// local-first text queue through the official Quill editor, so Bilibili's own
// auto-save persists it to the cloud draft. Injections are marked immediately;
// tombstones (not full bodies) remain to prevent duplicate paragraphs on every
// reopen.
//
// `cid` is resolved by the background API, not from the DOM, so the current
// video key is published by `useAnnotations` once a summary is available.

const AUTOSAVE_SETTLE_MS = 1500;
const REPLAY_DEBOUNCE_MS = 120;

export interface NoteSyncReplayOptions {
  /** Injects one queued HTML string into the editor; true when written. */
  inject: (html: string) => boolean;
  onToast?: (msg: string) => void;
  /** Called after local pending items were consumed, so the HUD can refresh. */
  onReplayed?: () => void;
}

let observer: MutationObserver | null = null;
let currentOptions: NoteSyncReplayOptions | null = null;
let currentVideoKey: { bvid: string; cid: string } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let isFlushing = false;

/** Publishes the resolved video identity (cid comes from the background API). */
export function setNoteSyncVideoKey(bvid?: string, cid?: string): void {
  currentVideoKey = bvid && cid ? { bvid, cid } : null;
}

function editorMounted(): boolean {
  return BiliNoteDomController.isNativeNoteOpen();
}

/** Promotes injected tombstones to synced after Bilibili's auto-save debounce. */
function scheduleMarkSynced(ids: string[]): void {
  setTimeout(() => {
    markSynced(ids).catch((err) => {
      console.warn('[BiliFlow] Failed to mark note sync as synced:', err);
    });
  }, AUTOSAVE_SETTLE_MS);
}

/**
 * Single flush path for both direct clicks and drawer-mount replays. Marks
 * items injected before returning so no duplicate paragraph is ever written.
 */
export async function flushNoteSyncQueue(options: NoteSyncReplayOptions): Promise<number> {
  if (!currentVideoKey || !editorMounted()) return 0;

  const pending = await getPendingNoteSyncs(currentVideoKey.bvid, currentVideoKey.cid);
  if (pending.length === 0) return 0;

  const editor = document.querySelector<HTMLElement>('.ql-editor');
  if (!editor) return 0;
  editor.focus();

  const injectedIds: string[] = [];
  for (const item of pending) {
    if (options.inject(item.html)) {
      injectedIds.push(item.id);
    }
  }
  if (injectedIds.length === 0) return 0;

  await markInjected(injectedIds);
  scheduleMarkSynced(injectedIds);
  options.onReplayed?.();
  return injectedIds.length;
}

function scheduleReplay(): void {
  if (isFlushing || !currentOptions || !editorMounted()) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (isFlushing || !currentOptions || !editorMounted()) return;
    isFlushing = true;
    try {
      const injected = await flushNoteSyncQueue(currentOptions);
      if (injected > 0) {
        currentOptions.onToast?.(`✓ 已自动补写 ${injected} 条本地笔记到 B站官方笔记`);
      }
    } catch (err) {
      console.warn('[BiliFlow] Native note replay failed:', err);
    } finally {
      isFlushing = false;
    }
  }, REPLAY_DEBOUNCE_MS);
}

/**
 * Starts watching for `.ql-editor` mounting. Returns a cleanup function for
 * `ctx.onInvalidated`.
 */
export function startNoteSyncReplay(options: NoteSyncReplayOptions): () => void {
  currentOptions = options;
  clearTimeout(debounceTimer);
  observer?.disconnect();

  observer = new MutationObserver(() => {
    if (editorMounted()) {
      scheduleReplay();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // The drawer may already be open when the content script (re)mounts.
  if (editorMounted()) {
    scheduleReplay();
  }

  return () => {
    clearTimeout(debounceTimer);
    observer?.disconnect();
    observer = null;
    currentOptions = null;
    isFlushing = false;
  };
}
