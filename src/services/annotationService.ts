import { browser } from 'wxt/browser';
import { UserAnnotation, UserAnnotationType } from '../types/biliNote';

const STORAGE_PREFIX = 'biliflow_notes_';
const MAX_ANNOTATIONS_PER_VIDEO = 100;

function getStorageKey(bvid: string, cid: string): string {
  return `${STORAGE_PREFIX}${bvid}_${cid}`;
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
 * Adds or updates a user annotation.
 */
export async function saveAnnotation(
  bvid: string,
  cid: string,
  data: {
    id?: string;
    timestamp: number;
    timestampStr: string;
    type?: UserAnnotationType;
    content: string;
    highlightId?: number | string;
    hasScreenshot?: boolean;
  }
): Promise<UserAnnotation> {
  if (!bvid || !cid) {
    throw new Error('缺少视频标识 (bvid/cid)');
  }

  const existing = await getAnnotations(bvid, cid);
  const now = Date.now();
  let savedItem: UserAnnotation;

  if (data.id) {
    // Update existing
    const idx = existing.findIndex((item) => item.id === data.id);
    if (idx !== -1) {
      savedItem = {
        ...existing[idx],
        ...data,
        id: data.id,
        type: data.type || existing[idx].type || 'insight',
        updatedAt: now,
      };
      existing[idx] = savedItem;
    } else {
      savedItem = {
        id: data.id,
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
  } else {
    // Create new
    savedItem = {
      id: `ann_${now}_${Math.random().toString(36).slice(2, 7)}`,
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

  // Cap max annotations to avoid storage overflow
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
 * Deletes a user annotation by ID.
 */
export async function deleteAnnotation(
  bvid: string,
  cid: string,
  annotationId: string
): Promise<boolean> {
  if (!bvid || !cid || !annotationId) return false;

  const existing = await getAnnotations(bvid, cid);
  const filtered = existing.filter((item) => item.id !== annotationId);

  if (filtered.length !== existing.length) {
    const key = getStorageKey(bvid, cid);
    if (browser?.storage?.local) {
      await browser.storage.local.set({ [key]: filtered });
    }
    return true;
  }

  return false;
}
