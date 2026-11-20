import { useCallback, useEffect, useRef } from 'react';
import { HighlightItem } from '../../../types';
import { loadPlaybackPositions, savePlaybackPosition } from '../../../services/playbackPositionService';
import {
  getHighlightStart,
  resolveHighlightResumeSeconds,
} from '../../../utils/playbackPosition';

const PERSIST_INTERVAL_SEC = 5;

interface UsePlaybackPositionHistoryParams {
  bvid?: string;
  cid?: string;
  highlights: HighlightItem[];
  currentPlaybackSec: number;
  duration: number;
}

interface PlaybackPositionHistory {
  recordCurrentPosition: () => void;
  flush: () => void;
  getResumeSeconds: (index: number) => number;
}

export function usePlaybackPositionHistory({
  bvid,
  cid,
  highlights,
  currentPlaybackSec,
  duration,
}: UsePlaybackPositionHistoryParams): PlaybackPositionHistory {
  const key = bvid && cid ? `${bvid}_${cid}` : '';
  const epochRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const positionsRef = useRef<Record<string, number>>({});
  const activeIndexRef = useRef(-1);
  const lastPersistedRef = useRef<Record<string, number>>({});
  const playbackSecRef = useRef(currentPlaybackSec);
  const highlightsRef = useRef(highlights);

  playbackSecRef.current = currentPlaybackSec;
  highlightsRef.current = highlights;

  // Load persisted positions for a new video; discard responses from stale videos.
  useEffect(() => {
    if (!key || !bvid || !cid) {
      positionsRef.current = {};
      lastPersistedRef.current = {};
      activeIndexRef.current = -1;
      loadedKeyRef.current = null;
      return;
    }
    if (loadedKeyRef.current === key) return;
    const epoch = ++epochRef.current;
    positionsRef.current = {};
    lastPersistedRef.current = {};
    activeIndexRef.current = -1;
    loadedKeyRef.current = key;
    void loadPlaybackPositions(bvid, cid).then((loaded) => {
      if (epoch !== epochRef.current || loadedKeyRef.current !== key) return;
      const next: Record<string, number> = {};
      for (const [id, entry] of Object.entries(loaded)) {
        next[id] = entry.positionSec;
      }
      positionsRef.current = next;
      lastPersistedRef.current = { ...next };
    });
  }, [key, bvid, cid]);

  const findActiveIndex = useCallback((): number => {
    const list = highlightsRef.current;
    const now = playbackSecRef.current;
    for (let i = 0; i < list.length; i += 1) {
      const start = getHighlightStart(list[i]);
      const next = list[i + 1];
      const end = next
        ? getHighlightStart(next)
        : typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? duration
        : Infinity;
      if (now >= start && now < end) return i;
    }
    return -1;
  }, [duration]);

  const recordCurrentPosition = useCallback(() => {
    const index = findActiveIndex();
    if (index < 0) return;
    const list = highlightsRef.current;
    const id = String(list[index].id);
    const position = playbackSecRef.current;
    positionsRef.current[id] = position;

    const last = lastPersistedRef.current[id];
    if (typeof last !== 'number' || Math.abs(position - last) >= PERSIST_INTERVAL_SEC) {
      lastPersistedRef.current[id] = position;
      if (bvid && cid) void savePlaybackPosition(bvid, cid, id, position);
    }
  }, [findActiveIndex, bvid, cid]);

  const flush = useCallback(() => {
    if (!bvid || !cid) return;
    for (const [id, position] of Object.entries(positionsRef.current)) {
      if (lastPersistedRef.current[id] !== position) {
        lastPersistedRef.current[id] = position;
        void savePlaybackPosition(bvid, cid, id, position);
      }
    }
  }, [bvid, cid]);

  // Record during natural playback; flush when the active chapter changes.
  useEffect(() => {
    const index = findActiveIndex();
    const previous = activeIndexRef.current;
    if (previous >= 0 && previous !== index) flush();
    activeIndexRef.current = index;
    if (index >= 0) recordCurrentPosition();
  }, [currentPlaybackSec, findActiveIndex, flush, recordCurrentPosition]);

  useEffect(() => () => flush(), [flush]);

  const getResumeSeconds = useCallback(
    (index: number): number => {
      const records: Record<string, { positionSec: number; updatedAt: number }> = {};
      for (const [id, positionSec] of Object.entries(positionsRef.current)) {
        records[id] = { positionSec, updatedAt: 0 };
      }
      return resolveHighlightResumeSeconds(highlightsRef.current, index, records, duration);
    },
    [duration]
  );

  return { recordCurrentPosition, flush, getResumeSeconds };
}
