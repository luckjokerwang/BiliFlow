import { browser } from 'wxt/browser';
import { VideoPlaybackPositions } from '../types';

const STORAGE_PREFIX = 'biliflow_playback_positions_';

function getStorageKey(bvid: string, cid: string): string {
  return `${STORAGE_PREFIX}${bvid}_${cid}`;
}

const mutationQueues = new Map<string, Promise<void>>();

function enqueueMutation<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutationQueues.get(key) || Promise.resolve();
  const result = previous.then(operation, operation);
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  mutationQueues.set(key, settled);
  void settled.then(() => {
    if (mutationQueues.get(key) === settled) mutationQueues.delete(key);
  });
  return result;
}

export async function loadPlaybackPositions(
  bvid: string,
  cid: string
): Promise<VideoPlaybackPositions> {
  if (!bvid || !cid) return {};
  try {
    if (!browser?.storage?.local) return {};
    const key = getStorageKey(bvid, cid);
    const result = await browser.storage.local.get(key);
    const value = result[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const positions: VideoPlaybackPositions = {};
    for (const [highlightId, entry] of Object.entries(value as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as { positionSec?: unknown; updatedAt?: unknown };
      if (
        typeof candidate.positionSec === 'number' &&
        Number.isFinite(candidate.positionSec) &&
        candidate.positionSec >= 0 &&
        typeof candidate.updatedAt === 'number' &&
        Number.isFinite(candidate.updatedAt)
      ) {
        positions[highlightId] = {
          positionSec: candidate.positionSec,
          updatedAt: candidate.updatedAt,
        };
      }
    }
    return positions;
  } catch (err) {
    console.warn('[BiliFlow] Failed to load playback positions:', err);
    return {};
  }
}

export async function savePlaybackPosition(
  bvid: string,
  cid: string,
  highlightId: string | number,
  positionSec: number
): Promise<void> {
  if (!bvid || !cid || highlightId === undefined || highlightId === null) return;
  if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) return;
  const key = getStorageKey(bvid, cid);
  const id = String(highlightId);
  await enqueueMutation(key, async () => {
    try {
      if (!browser?.storage?.local) return;
      const current = await loadPlaybackPositions(bvid, cid);
      const next: VideoPlaybackPositions = {
        ...current,
        [id]: { positionSec, updatedAt: Date.now() },
      };
      await browser.storage.local.set({ [key]: next });
    } catch (err) {
      console.warn('[BiliFlow] Failed to save playback position:', err);
    }
  });
}
