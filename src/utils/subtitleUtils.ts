import { BiliRawSubtitleItem, OriginalQuote } from '../types';
import { formatSeconds } from './timeParser';

/**
 * Calculates a priority score for selecting the best subtitle track.
 * Waterfall priority:
 * 1. UP-authored manual Chinese subtitle (zh-CN, zh-Hans, zh-TW, non-AI) -> Score 100
 * 2. Bilibili AI-generated Chinese subtitle (ai-zh) -> Score 80
 * 3. Other manual language tracks -> Score 60
 * 4. Other AI translated tracks (ai-en, ai-ja, etc.) -> Score 40
 */
export function getSubtitlePriorityScore(s: {
  lan?: string;
  lan_doc?: string;
  type?: number;
  ai_type?: number;
}): number {
  if (!s) return 0;
  const lan = (s.lan || '').toLowerCase();
  const lanDoc = s.lan_doc || '';
  const isAi =
    lan.startsWith('ai-') ||
    s.type === 1 ||
    lanDoc.includes('自动生成') ||
    lanDoc.includes('AI') ||
    lanDoc.includes('翻译');

  // 1. UP-authored manual Chinese subtitle
  if (!isAi && (lan.includes('zh') || lanDoc.includes('中'))) {
    return 100;
  }

  // 2. AI-generated Chinese subtitle (original ASR audio transcription)
  if (
    lan === 'ai-zh' ||
    ((lan.includes('zh') || lanDoc.includes('中')) && (lanDoc.includes('自动') || isAi))
  ) {
    return 80;
  }

  // 3. Other manual non-AI subtitles
  if (!isAi) {
    return 60;
  }

  // 4. Other AI translated tracks (ai-en, ai-ja, etc.)
  if (isAi) {
    return 40;
  }

  return 10;
}

/**
 * Sorts and selects the preferred subtitle track from a Bilibili subtitle array.
 */
export function selectPreferredSubtitleTrack(tracks: any[]): any {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const sorted = [...tracks].sort(
    (a, b) => getSubtitlePriorityScore(b) - getSubtitlePriorityScore(a)
  );
  return sorted[0];
}

/**
 * Fuses fragmented raw subtitle items into natural, complete sentences.
 * This significantly reduces LLM Token consumption (>30%) and creates natural sentences
 * for display in the "展开原文依据" section.
 */
export function fuseSubtitles(
  items: BiliRawSubtitleItem[],
  maxSentenceLen = 50,
  maxPauseGapSec = 0.9
): BiliRawSubtitleItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const fused: BiliRawSubtitleItem[] = [];
  let current: BiliRawSubtitleItem | null = null;

  for (const item of items) {
    const rawContent = (item.content || '').trim();
    if (!rawContent) continue;

    if (!current) {
      current = {
        from: item.from,
        to: item.to,
        content: rawContent,
      };
      continue;
    }

    const gap = item.from - current.to;
    const isTerminated = /[。！？!?；;\n]$/.test(current.content);
    const wouldBeTooLong = current.content.length + rawContent.length > maxSentenceLen;

    // If there is no long silence pause, sentence is not terminated, and length is reasonable, merge
    if (gap >= 0 && gap <= maxPauseGapSec && !isTerminated && !wouldBeTooLong) {
      current.to = Math.max(current.to, item.to);
      // If previous doesn't end with whitespace and next is English/number, add space
      const needsSpace =
        /[a-zA-Z0-9]$/.test(current.content) && /^[a-zA-Z0-9]/.test(rawContent);
      current.content += (needsSpace ? ' ' : '') + rawContent;
    } else {
      fused.push(current);
      current = {
        from: item.from,
        to: item.to,
        content: rawContent,
      };
    }
  }

  if (current) {
    fused.push(current);
  }

  return fused;
}

/**
 * Extracts 3~5 relevant original subtitle quotes around a highlight's timestamp.
 * Window: default from (highlight - 4s) to (highlight + 35s).
 */
export function extractQuotesForHighlight(
  highlightTimeSec: number,
  subtitles: BiliRawSubtitleItem[],
  windowBeforeSec = 3,
  windowAfterSec = 35,
  maxQuotes = 5
): OriginalQuote[] {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return [];

  const startTime = Math.max(0, highlightTimeSec - windowBeforeSec);
  const endTime = highlightTimeSec + windowAfterSec;

  const matched: BiliRawSubtitleItem[] = [];

  for (const sub of subtitles) {
    // Include subtitle if it overlaps with the window
    if (sub.to >= startTime && sub.from <= endTime) {
      matched.push(sub);
      if (matched.length >= maxQuotes) break;
    }
  }

  // Fallback: If no exact overlap found (e.g. slight timing skew), pick nearest 2~3 items
  if (matched.length === 0) {
    const nearestIdx = subtitles.findIndex((s) => s.from >= highlightTimeSec);
    const startIdx = Math.max(0, nearestIdx === -1 ? subtitles.length - 3 : nearestIdx - 1);
    matched.push(...subtitles.slice(startIdx, startIdx + 3));
  }

  return matched.map((item) => ({
    timestamp: Math.floor(item.from),
    timestampStr: formatSeconds(item.from),
    content: item.content.trim(),
  }));
}
