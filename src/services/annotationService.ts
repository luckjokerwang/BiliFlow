import { browser } from 'wxt/browser';
import { UserAnnotation, UserAnnotationType } from '../types/biliNote';

const STORAGE_PREFIX = 'biliflow_notes_';
const MAX_ANNOTATIONS_PER_VIDEO = 100;

function getStorageKey(bvid: string, cid: string): string {
  return `${STORAGE_PREFIX}${bvid}_${cid}`;
}

interface AnnotationSaveInput {
  id?: string;
  timestamp: number;
  timestampStr: string;
  type?: UserAnnotationType;
  content: string;
  highlightId?: number | string;
  hasScreenshot?: boolean;
}

const annotationMutationQueues = new Map<string, Promise<void>>();

function enqueueAnnotationMutation<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  const previous = annotationMutationQueues.get(key) || Promise.resolve();
  const result = previous.then(operation, operation);
  const settled = result.then(
    () => undefined,
    () => undefined
  );

  annotationMutationQueues.set(key, settled);
  void settled.then(() => {
    if (annotationMutationQueues.get(key) === settled) {
      annotationMutationQueues.delete(key);
    }
  });

  return result;
}

async function waitForAnnotationMutations(key: string): Promise<void> {
  const pending = annotationMutationQueues.get(key);
  if (pending) {
    await pending;
  }
}

/**
 * Retrieves all user annotations/thoughts for a specific video part.
 */
export async function getAnnotations(bvid: string, cid: string): Promise<UserAnnotation[]> {
  if (!bvid || !cid) return [];

  try {
    const key = getStorageKey(bvid, cid);
    if (!browser?.storage?.local) return [];

    const result = await browser.storage.local.get(key);
    const list = result[key];
    if (Array.isArray(list)) {
      return list.sort((a, b) => a.timestamp - b.timestamp);
    }
    return [];
  } catch (err) {
    console.warn('[BiliFlow] Failed to load annotations:', err);
    return [];
  }
}

/**
 * Adds or updates a user annotation. Mutations for one video part are
 * serialized so a delete following a pending save cannot be overwritten.
 */
export async function saveAnnotation(
  bvid: string,
  cid: string,
  data: AnnotationSaveInput
): Promise<UserAnnotation> {
  if (!bvid || !cid) {
    throw new Error('缺少视频标识 (bvid/cid)');
  }

  return enqueueAnnotationMutation(getStorageKey(bvid, cid), () =>
    saveAnnotationNow(bvid, cid, data)
  );
}

async function saveAnnotationNow(
  bvid: string,
  cid: string,
  data: AnnotationSaveInput
): Promise<UserAnnotation> {
  const existing = await getAnnotations(bvid, cid);
  const now = Date.now();
  let savedItem: UserAnnotation;

  const updateIndex = data.id
    ? existing.findIndex((item) => item.id === data.id)
    : data.highlightId !== undefined
      ? existing.findIndex(
          (item) => String(item.highlightId) === String(data.highlightId)
        )
      : -1;

  if (updateIndex !== -1) {
    const previous = existing[updateIndex];
    savedItem = {
      ...previous,
      id: previous.id,
      createdAt: previous.createdAt,
      timestamp: data.timestamp,
      timestampStr: data.timestampStr,
      type: data.type || previous.type || 'insight',
      content: data.content,
      highlightId: data.highlightId ?? previous.highlightId,
      hasScreenshot: data.hasScreenshot ?? previous.hasScreenshot,
      updatedAt: now,
    };
    existing[updateIndex] = savedItem;
  } else {
    savedItem = {
      id: data.id || `ann_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: data.timestamp,
      timestampStr: data.timestampStr,
      type: data.type || 'insight',
      content: data.content,
      highlightId: data.highlightId,
      hasScreenshot: !!data.hasScreenshot,
      createdAt: now,
      updatedAt: now,
    };
    existing.push(savedItem);
  }

  if (existing.length > MAX_ANNOTATIONS_PER_VIDEO) {
    existing.splice(0, existing.length - MAX_ANNOTATIONS_PER_VIDEO);
  }

  const key = getStorageKey(bvid, cid);
  if (browser?.storage?.local) {
    await browser.storage.local.set({ [key]: existing });
  }

  return savedItem;
}

/**
 * Deletes a user annotation by ID through the same per-video queue as saves.
 */
export async function deleteAnnotation(
  bvid: string,
  cid: string,
  annotationId: string
): Promise<boolean> {
  if (!bvid || !cid || !annotationId) return false;

  return enqueueAnnotationMutation(getStorageKey(bvid, cid), async () => {
    const existing = await getAnnotations(bvid, cid);
    const filtered = existing.filter((item) => item.id !== annotationId);
    if (filtered.length === existing.length) return false;

    const key = getStorageKey(bvid, cid);
    if (browser?.storage?.local) {
      await browser.storage.local.set({ [key]: filtered });
    }
    return true;
  });
}

/**
 * Reads the latest persisted annotation for a highlight after all queued
 * mutations have settled. Native-note synchronization must use this instead
 * of a React state snapshot.
 */
export async function getAnnotationForHighlight(
  bvid: string,
  cid: string,
  highlightId: number | string
): Promise<UserAnnotation | undefined> {
  if (!bvid || !cid || highlightId === undefined) return undefined;

  await waitForAnnotationMutations(getStorageKey(bvid, cid));
  const annotations = await getAnnotations(bvid, cid);
  return annotations.find(
    (item) => String(item.highlightId) === String(highlightId)
  );
}
