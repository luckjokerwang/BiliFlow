import { browser } from 'wxt/browser';

// ==========================================
// Native Note Sync Queue (Local-first, text only)
// ==========================================
//
// Bilibili's note drawer is conditionally rendered: when it is closed the
// `.ql-editor` node does not exist, so no DOM injection can reach the cloud
// draft. This service keeps the *text* of a "记入笔记" action locally until a
// watcher observes the editor mounting, then replays it through the official
// Quill editor to trigger Bilibili's own auto-save.
//
// Screenshots are deliberately NOT buffered here. They are produced by
// Bilibili's native camera button and hosted on Bilibili's CDN, so a
// withScreenshot action still requires the drawer to be open.

const STORAGE_KEY = 'biliflow_note_sync_queue';
const MAX_PENDING_PER_VIDEO = 100;
const MAX_TOTAL_ENTRIES = 2000;

export type NoteSyncStatus = 'pending' | 'injected' | 'synced';

export interface NoteSyncQueueItem {
  /** Stable id: `${bvid}_${cid}_${itemKey}`; used for dedup and tombstones. */
  id: string;
  bvid: string;
  cid: string;
  /** Highlight id or timestamp string; identifies the source card. */
  itemKey: string;
  status: NoteSyncStatus;
  /** Pre-rendered semantic HTML for `.ql-editor`. Empty after injection. */
  html: string;
  /** Plain-text annotation content, kept only for pending replay. */
  annotationText?: string;
  createdAt: number;
  injectedAt?: number;
}

export type EnqueueNoteSyncResult =
  | { enqueued: true; id: string }
  | { enqueued: false; reason: 'duplicate' | 'full' | 'invalid' };

interface QueueStorageShape {
  [id: string]: NoteSyncQueueItem;
}

function makeId(bvid: string, cid: string, itemKey: string): string {
  return `${bvid}_${cid}_${itemKey}`;
}

async function readAll(): Promise<QueueStorageShape> {
  if (!browser?.storage?.local) return {};
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const raw = data?.[STORAGE_KEY];
    return raw && typeof raw === 'object' ? (raw as QueueStorageShape) : {};
  } catch (err) {
    console.warn('[BiliFlow] Failed to read note sync queue:', err);
    return {};
  }
}

async function writeAll(items: QueueStorageShape): Promise<void> {
  if (!browser?.storage?.local) return;
  await browser.storage.local.set({ [STORAGE_KEY]: items });
}

/** Drops oldest tombstones so the queue never grows unbounded. */
function pruneMarkers(all: QueueStorageShape): void {
  const entries = Object.values(all);
  if (entries.length <= MAX_TOTAL_ENTRIES) return;
  const markers = entries
    .filter((item) => item.status !== 'pending')
    .sort((a, b) => (a.injectedAt ?? a.createdAt) - (b.injectedAt ?? b.createdAt));
  for (const item of markers.slice(0, entries.length - MAX_TOTAL_ENTRIES)) {
    delete all[item.id];
  }
}

/**
 * Enqueues a text note for later replay. Returns `duplicate` when the same card
 * was already injected/synced, `full` at 100 pending items for one video.
 *
 * Never stores image bytes: `html` must be text-only HTML.
 */
export async function enqueueNoteSync(input: {
  bvid: string;
  cid: string;
  itemKey: string;
  html: string;
  annotationText?: string;
}): Promise<EnqueueNoteSyncResult> {
  const { bvid, cid, itemKey, html } = input;
  if (!bvid || !cid || !itemKey || !html || html.includes('data:image')) {
    return { enqueued: false, reason: 'invalid' };
  }

  const all = await readAll();
  const id = makeId(bvid, cid, itemKey);
  const existing = all[id];
  if (existing && existing.status !== 'pending') {
    return { enqueued: false, reason: 'duplicate' };
  }
  if (existing?.status === 'pending') {
    // Refresh the pending payload (e.g. user edited their thought).
    all[id] = {
      ...existing,
      html,
      annotationText: input.annotationText,
      createdAt: Date.now(),
    };
    await writeAll(all);
    return { enqueued: true, id };
  }

  const pendingForVideo = Object.values(all).filter(
    (item) => item.bvid === bvid && item.cid === cid && item.status === 'pending'
  );
  if (pendingForVideo.length >= MAX_PENDING_PER_VIDEO) {
    return { enqueued: false, reason: 'full' };
  }

  all[id] = {
    id,
    bvid,
    cid,
    itemKey,
    status: 'pending',
    html,
    annotationText: input.annotationText,
    createdAt: Date.now(),
  };
  pruneMarkers(all);
  await writeAll(all);
  return { enqueued: true, id };
}

/** Returns pending items for one video part, oldest first. */
export async function getPendingNoteSyncs(
  bvid: string,
  cid: string
): Promise<NoteSyncQueueItem[]> {
  if (!bvid || !cid) return [];
  const all = await readAll();
  return Object.values(all)
    .filter((item) => item.bvid === bvid && item.cid === cid && item.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function hasInjectedNote(
  bvid: string,
  cid: string,
  itemKey: string
): Promise<boolean> {
  const all = await readAll();
  const item = all[makeId(bvid, cid, itemKey)];
  return Boolean(item && item.status !== 'pending');
}

/**
 * Marks items as injected and drops their HTML body, leaving only a small
 * tombstone (`bvid` + `cid` + `itemKey` + status + timestamps) so a later
 * drawer reopen never replays the same paragraph.
 */
export async function markInjected(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const all = await readAll();
  const now = Date.now();
  for (const id of ids) {
    const item = all[id];
    if (!item || item.status !== 'pending') continue;
    all[id] = {
      id: item.id,
      bvid: item.bvid,
      cid: item.cid,
      itemKey: item.itemKey,
      status: 'injected',
      html: '',
      createdAt: item.createdAt,
      injectedAt: now,
    };
  }
  await writeAll(all);
}

/** Marks tombstones as fully synced once Bilibili's auto-save is observed. */
export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const all = await readAll();
  for (const id of ids) {
    const item = all[id];
    if (!item || item.status === 'synced') continue;
    all[id] = { ...item, status: 'synced', html: '' };
  }
  await writeAll(all);
}

type StorageChangedListener = Parameters<
  typeof browser.storage.onChanged.addListener
>[0];

/** Notifies the HUD when the local-first sync queue changes. */
export function subscribeNoteSyncQueueChange(listener: () => void): () => void {
  const onChanged = browser?.storage?.onChanged;
  if (!onChanged?.addListener || !onChanged.removeListener) {
    return () => {};
  }

  const handleChange: StorageChangedListener = (changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      listener();
    }
  };

  onChanged.addListener(handleChange);
  return () => {
    onChanged.removeListener(handleChange);
  };
}
