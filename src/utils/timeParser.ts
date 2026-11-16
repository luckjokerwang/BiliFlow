/**
 * Time formatting and parsing utilities for video timestamps.
 */

export function formatSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }

  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

export function parseTimestamp(timestampStr: string): number {
  if (!timestampStr || typeof timestampStr !== 'string') {
    return 0;
  }

  const clean = timestampStr.trim();
  const parts = clean.split(':').map((part) => parseInt(part, 10));

  if (parts.some((p) => isNaN(p) || p < 0)) {
    return 0;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

const DESCRIPTION_TIMESTAMP_LINE =
  /^\s*\[?\s*(\d{1,3}:\d{2}(?::\d{2})?)\s*\]?\s*[:：、.\-—|\s]*(.+)$/;

/**
 * Extracts chapter-like timestamps from a Bilibili video description.
 * Each timestamp must start its own line; optional square brackets and
 * separator punctuation are tolerated.
 */
export function extractDescriptionTimestamps(
  description: string,
  durationSec?: number
): Array<{ seconds: number; title: string }> {
  if (!description || typeof description !== 'string') return [];

  const maxSeconds =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : undefined;
  const results: Array<{ seconds: number; title: string }> = [];
  const seen = new Set<string>();

  for (const line of description.split('\n')) {
    const match = line.match(DESCRIPTION_TIMESTAMP_LINE);
    if (!match) continue;

    const seconds = parseTimestamp(match[1]);
    const title = match[2].trim();
    if (!title || (maxSeconds !== undefined && seconds > maxSeconds)) continue;

    const dedupeKey = `${seconds}|${title}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    results.push({ seconds, title });
  }

  return results.sort((a, b) => a.seconds - b.seconds);
}
