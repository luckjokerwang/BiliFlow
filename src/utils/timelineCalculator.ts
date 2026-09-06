import { HighlightItem, OriginalQuote } from '../types';
import { parseTimestamp, formatSeconds } from './timeParser';

export interface TimelineMarker {
  id: string;
  index: number;
  timestampSec: number;
  timestampStr: string;
  title: string;
  keyPoint?: string;
  percentage: number; // 0 to 100
  clusterGroup?: number;
}

export interface TimelineSegment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  startPercent: number; // 0 to 100
  endPercent: number;   // 0 to 100
  widthPercent: number; // endPercent - startPercent
  title: string;
  keyPoint?: string;
  timeRangeStr: string; // e.g. "01:37 ~ 03:15"
}

/**
 * Calculates timeline markers percentage and handles collision clustering for Bilibili progress bar.
 */
export function calculateTimelineMarkers(
  highlights: HighlightItem[],
  videoDurationSec: number
): TimelineMarker[] {
  if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
    return [];
  }

  if (!videoDurationSec || videoDurationSec <= 0 || isNaN(videoDurationSec)) {
    return [];
  }

  const markers: TimelineMarker[] = highlights
    .map((h, idx) => {
      let rawSec: number;
      if (typeof h.timestamp === 'number' && !isNaN(h.timestamp)) {
        rawSec = h.timestamp;
      } else if (typeof h.timestampSec === 'number' && !isNaN(h.timestampSec)) {
        rawSec = h.timestampSec;
      } else if (typeof h.timestamp === 'string') {
        rawSec = parseTimestamp(h.timestamp);
      } else if (typeof h.timestampStr === 'string') {
        rawSec = parseTimestamp(h.timestampStr);
      } else {
        rawSec = 0;
      }

      if (isNaN(rawSec) || rawSec < 0) return null;

      const clampedSec = Math.max(0, Math.min(rawSec, videoDurationSec));
      const rawPercent = (clampedSec / videoDurationSec) * 100;
      // Clamp between 0.8% and 99.2% so markers don't overflow the progress bar ends
      const percentage = Number(Math.max(0.8, Math.min(rawPercent, 99.2)).toFixed(2));

      return {
        id: String(h.id || `marker-${idx + 1}`),
        index: idx + 1,
        timestampSec: clampedSec,
        timestampStr: h.timestampStr || formatSeconds(clampedSec),
        title: h.title,
        keyPoint: h.keyPoint,
        percentage,
      };
    })
    .filter((m): m is TimelineMarker => m !== null);

  // Sort chronologically
  markers.sort((a, b) => a.timestampSec - b.timestampSec);

  // Group closely clustered markers (< 2.5% distance)
  let currentGroup = 0;
  for (let i = 0; i < markers.length; i++) {
    if (i > 0 && markers[i].percentage - markers[i - 1].percentage < 2.5) {
      markers[i].clusterGroup = currentGroup;
      markers[i - 1].clusterGroup = currentGroup;
    } else {
      currentGroup++;
    }
  }

  return markers;
}

/**
 * Finds the index of the highlight that corresponds to current playback time.
 * If currentSec is before the first highlight or negative, returns 0.
 * Otherwise returns the highlight where highlight.timestamp <= currentSec < next.timestamp.
 */
export function findActiveHighlightIndex(
  highlights: HighlightItem[],
  currentSec: number
): number {
  if (!highlights || highlights.length === 0) return 0;
  if (currentSec <= 0 || isNaN(currentSec)) return 0;

  let activeIndex = 0;
  for (let i = 0; i < highlights.length; i++) {
    const hTime =
      typeof highlights[i].timestamp === 'number'
        ? highlights[i].timestamp
        : (highlights[i].timestampSec ?? 0);
    if (hTime <= currentSec) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Finds the index of the quote that corresponds to current playback time.
 * Returns -1 if currentSec is before all quotes or quotes is empty.
 * Returns index of the quote where quote.timestamp <= currentSec < nextQuote.timestamp.
 */
export function findActiveQuoteIndex(
  quotes: OriginalQuote[],
  currentSec: number
): number {
  if (!quotes || quotes.length === 0) return -1;
  if (currentSec < 0 || isNaN(currentSec)) return -1;

  let activeIndex = -1;
  for (let i = 0; i < quotes.length; i++) {
    if (quotes[i].timestamp <= currentSec) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Calculates continuous playback segments from timeline markers and total video duration.
 */
export function calculateTimelineSegments(
  markers: TimelineMarker[],
  videoDurationSec: number
): TimelineSegment[] {
  if (!markers || markers.length === 0 || !videoDurationSec || videoDurationSec <= 0) {
    return [];
  }

  const sortedMarkers = [...markers].sort((a, b) => a.timestampSec - b.timestampSec);
  const segments: TimelineSegment[] = [];

  // If the first marker begins past 15s, create an intro segment
  const first = sortedMarkers[0];
  if (first.timestampSec > 15) {
    const endPercent = (first.timestampSec / videoDurationSec) * 100;
    segments.push({
      id: 'segment-0',
      index: 0,
      startSec: 0,
      endSec: first.timestampSec,
      startPercent: 0,
      endPercent: Number(endPercent.toFixed(2)),
      widthPercent: Number(endPercent.toFixed(2)),
      title: '引言 / 片头概述',
      timeRangeStr: `00:00 ~ ${first.timestampStr}`,
    });
  }

  for (let i = 0; i < sortedMarkers.length; i++) {
    const current = sortedMarkers[i];
    const isFirstSegment = i === 0 && segments.length === 0;
    const startSec = isFirstSegment ? 0 : current.timestampSec;
    const startPercent = isFirstSegment ? 0 : (startSec / videoDurationSec) * 100;

    const next = sortedMarkers[i + 1];
    const endSec = next ? next.timestampSec : videoDurationSec;
    const endPercent = next ? (endSec / videoDurationSec) * 100 : 100;
    const widthPercent = Math.max(0, endPercent - startPercent);

    segments.push({
      id: `segment-${current.index}`,
      index: current.index,
      startSec,
      endSec,
      startPercent: Number(startPercent.toFixed(2)),
      endPercent: Number(endPercent.toFixed(2)),
      widthPercent: Number(widthPercent.toFixed(2)),
      title: current.title,
      keyPoint: current.keyPoint,
      timeRangeStr: `${formatSeconds(startSec)} ~ ${formatSeconds(endSec)}`,
    });
  }

  return segments;
}
