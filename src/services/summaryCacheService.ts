import { browser } from 'wxt/browser';
import { VideoSummaryResult, CacheIndexEntry, CacheStats } from '../types';

export const CACHE_INDEX_KEY = 'biliflow_summary_cache_index';
export const DEFAULT_MAX_CACHE_LIMIT = 100;

/**
 * Estimates in-memory / JSON byte size of a data object.
 */
export function estimateObjectSize(obj: any): number {
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return str.length * 2; // Approximate byte size for UTF-16 representation
  } catch {
    return 0;
  }
}

/**
 * Prunes cache index entries according to LRU order (newest first).
 */
export function pruneLruEntries(
  entries: CacheIndexEntry[],
  maxLimit: number
): { kept: CacheIndexEntry[]; evicted: CacheIndexEntry[] } {
  if (entries.length <= maxLimit) {
    return { kept: entries, evicted: [] };
  }
  // Sort descending by updatedAt (newest first)
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  const kept = sorted.slice(0, maxLimit);
  const evicted = sorted.slice(maxLimit);
  return { kept, evicted };
}

/**
 * Saves video summary to local storage and updates the LRU index.
 * Automatically evicts the oldest entries when exceeding maxLimit.
 */
export async function saveSummaryToCache(
  summary: VideoSummaryResult,
  maxLimit: number = DEFAULT_MAX_CACHE_LIMIT
): Promise<void> {
  if (!summary || !summary.bvid || !summary.cid) return;
  if (!browser?.storage?.local) return;

  const key = `summary_${summary.bvid}_${summary.cid}`;
  const estimatedBytes = estimateObjectSize(summary);

  // 1. Fetch current index
  const indexData = await browser.storage.local.get(CACHE_INDEX_KEY);
  let index: CacheIndexEntry[] = Array.isArray(indexData[CACHE_INDEX_KEY])
    ? indexData[CACHE_INDEX_KEY]
    : [];

  // 2. Remove existing entry with identical key if present
  index = index.filter((item) => item.key !== key);

  // 3. Add new entry at top
  const newEntry: CacheIndexEntry = {
    key,
    bvid: summary.bvid,
    cid: summary.cid,
    title: summary.title || '',
    updatedAt: Date.now(),
    sizeEstimatedBytes: estimatedBytes,
  };
  index.unshift(newEntry);

  // 4. Prune exceeding entries
  const { kept, evicted } = pruneLruEntries(index, maxLimit);

  // 5. If entries were evicted, remove their keys from storage
  if (evicted.length > 0) {
    const keysToRemove = evicted.map((e) => e.key);
    try {
      await browser.storage.local.remove(keysToRemove);
    } catch (err) {
      console.warn('[BiliFlow Cache] Failed to remove evicted cache keys:', err);
    }
  }

  // 6. Persist new summary and updated index
  await browser.storage.local.set({
    [key]: summary,
    [CACHE_INDEX_KEY]: kept,
  });
}

/**
 * Retrieves cached summary from storage and refreshes its LRU timestamp.
 */
export async function getCachedSummary(
  bvid: string,
  cid: string
): Promise<VideoSummaryResult | null> {
  if (!bvid || !cid || !browser?.storage?.local) return null;

  const key = `summary_${bvid}_${cid}`;
  const data = await browser.storage.local.get([key, CACHE_INDEX_KEY]);
  const summary: VideoSummaryResult | undefined = data[key];

  if (!summary) return null;

  // Refresh LRU updatedAt timestamp in background
  try {
    let index: CacheIndexEntry[] = Array.isArray(data[CACHE_INDEX_KEY])
      ? data[CACHE_INDEX_KEY]
      : [];
    const targetIdx = index.findIndex((item) => item.key === key);
    if (targetIdx !== -1) {
      index[targetIdx].updatedAt = Date.now();
      index.sort((a, b) => b.updatedAt - a.updatedAt);
      await browser.storage.local.set({ [CACHE_INDEX_KEY]: index });
    }
  } catch (e) {
    console.warn('[BiliFlow Cache] Failed to update LRU timestamp on hit:', e);
  }

  return summary;
}

/**
 * Deletes a specific video summary from storage and updates the LRU index.
 */
export async function deleteCachedSummary(
  bvid: string,
  cid: string
): Promise<void> {
  if (!bvid || !cid || !browser?.storage?.local) return;

  const key = `summary_${bvid}_${cid}`;
  try {
    const indexData = await browser.storage.local.get(CACHE_INDEX_KEY);
    let index: CacheIndexEntry[] = Array.isArray(indexData[CACHE_INDEX_KEY])
      ? indexData[CACHE_INDEX_KEY]
      : [];

    index = index.filter((item) => item.key !== key);

    await browser.storage.local.remove(key);
    await browser.storage.local.set({ [CACHE_INDEX_KEY]: index });
  } catch (err) {
    console.warn('[BiliFlow Cache] Failed to delete cached summary:', err);
  }
}

/**
 * Validates whether a cached summary is healthy, authentic, and consistent
 * with the currently playing video metadata.
 */
export function isCachedSummaryValid(
  cached: VideoSummaryResult | null | undefined,
  currentVideo: {
    bvid: string;
    cid: string;
    title?: string;
    duration?: number;
  }
): boolean {
  if (!cached || !cached.bvid || !cached.cid) return false;
  if (cached.bvid !== currentVideo.bvid || cached.cid !== currentVideo.cid) return false;

  // Must contain highlights
  if (!Array.isArray(cached.highlights) || cached.highlights.length === 0) return false;

  // Title relevance check: if both titles exist and are non-empty, ensure basic consistency
  if (cached.title && currentVideo.title) {
    const normalize = (t: string) =>
      t
        .toLowerCase()
        .replace(/【[^】]*】/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/_哔哩哔哩_bilibili/g, '')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .trim();

    const normCached = normalize(cached.title);
    const normCurrent = normalize(currentVideo.title);

    // If current title is substantially different from cached title
    if (
      normCached.length >= 4 &&
      normCurrent.length >= 4 &&
      !normCached.includes(normCurrent.slice(0, 4)) &&
      !normCurrent.includes(normCached.slice(0, 4))
    ) {
      return false;
    }
  }

  // Duration coverage check: if video duration is long (>= 10 minutes / 600s),
  // highlights must not be truncated to merely the first 2-3 minutes.
  const duration = currentVideo.duration || 0;
  if (duration >= 600) {
    const maxHighlightTs = Math.max(
      ...cached.highlights.map((h) =>
        typeof h.timestamp === 'number' ? h.timestamp : h.timestampSec ?? 0
      )
    );

    // If the entire summary ends before 180s on a 10+ minute video (covering < 15%), it is heavily suspect
    if (maxHighlightTs > 0 && maxHighlightTs < 180 && maxHighlightTs / duration < 0.15) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates current cache statistics (count and estimated size).
 */
export async function getCacheStats(
  maxLimit: number = DEFAULT_MAX_CACHE_LIMIT
): Promise<CacheStats> {
  if (!browser?.storage?.local) {
    return { count: 0, totalEstimatedBytes: 0, maxLimit };
  }

  try {
    const data = await browser.storage.local.get(CACHE_INDEX_KEY);
    const index: CacheIndexEntry[] = Array.isArray(data[CACHE_INDEX_KEY])
      ? data[CACHE_INDEX_KEY]
      : [];

    const totalEstimatedBytes = index.reduce(
      (sum, item) => sum + (item.sizeEstimatedBytes || 0),
      0
    );

    return {
      count: index.length,
      totalEstimatedBytes,
      maxLimit,
    };
  } catch (err) {
    console.warn('[BiliFlow Cache] Failed to get cache stats:', err);
    return { count: 0, totalEstimatedBytes: 0, maxLimit };
  }
}

/**
 * Completely clears all cached video summaries and resets the LRU index.
 */
export async function clearAllSummaryCache(): Promise<void> {
  if (!browser?.storage?.local) return;

  try {
    const data = await browser.storage.local.get(null);
    const allKeys = Object.keys(data || {});
    const summaryKeys = allKeys.filter(
      (k) => k.startsWith('summary_') || k === CACHE_INDEX_KEY
    );

    if (summaryKeys.length > 0) {
      await browser.storage.local.remove(summaryKeys);
    }
  } catch (err) {
    console.warn('[BiliFlow Cache] Failed to clear summary cache:', err);
  }
}
