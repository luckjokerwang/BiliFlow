import { HighlightItem, VideoPlaybackPositions } from '../types';

export function getHighlightStart(highlight: HighlightItem): number {
  const value = typeof highlight.timestamp === 'number' ? highlight.timestamp : highlight.timestampSec;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Resolves the resume position for a chapter. A stored position is accepted
 * only inside [start, end), where end is the next chapter start or the known
 * video duration. Out-of-range/missing records fall back to the chapter start.
 */
export function resolveHighlightResumeSeconds(
  highlights: HighlightItem[],
  index: number,
  positions: VideoPlaybackPositions,
  duration: number
): number {
  const highlight = highlights[index];
  if (!highlight) return 0;
  const start = getHighlightStart(highlight);
  const next = highlights[index + 1];
  const hasEnd = Boolean(next) || (typeof duration === 'number' && Number.isFinite(duration) && duration > 0);
  const rawEnd = next
    ? getHighlightStart(next)
    : typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? duration
    : Infinity;
  const end = Number.isFinite(rawEnd) && rawEnd >= start ? rawEnd : Infinity;

  const record = positions[String(highlight.id)];
  if (!record || typeof record.positionSec !== 'number' || !Number.isFinite(record.positionSec)) {
    return start;
  }
  const position = record.positionSec;
  if (position < start) return start;
  if (hasEnd && position >= end) return start;
  if (Number.isFinite(duration) && duration > 0 && position > duration) return start;
  return position;
}
