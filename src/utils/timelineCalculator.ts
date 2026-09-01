import { HighlightItem, OriginalQuote } from '../types';

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
      const rawSec = typeof h.timestamp === 'number' ? h.timestamp : (h.timestampSec ?? 0);
      if (isNaN(rawSec) || rawSec < 0) return null;

      const clampedSec = Math.max(0, Math.min(rawSec, videoDurationSec));
      const rawPercent = (clampedSec / videoDurationSec) * 100;
      // Clamp between 0.8% and 99.2% so markers don't overflow the progress bar ends
      const percentage = Number(Math.max(0.8, Math.min(rawPercent, 99.2)).toFixed(2));

      return {
        id: String(h.id || `marker-${idx + 1}`),
        index: idx + 1,
        timestampSec: clampedSec,
        timestampStr: h.timestampStr,
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
