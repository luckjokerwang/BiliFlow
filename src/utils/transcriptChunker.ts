import { BiliRawSubtitleItem, TranscriptChunk } from '../types';
import { formatSeconds } from './timeParser';

export interface ChunkOptions {
  maxDurationSeconds?: number;
  maxCharCount?: number;
}

/**
 * Aggregates granular Bilibili subtitle items into coherent timestamped chunks.
 */
export function chunkSubtitles(
  items: BiliRawSubtitleItem[],
  options: ChunkOptions = {}
): TranscriptChunk[] {
  if (!items || items.length === 0) {
    return [];
  }

  const maxDuration = options.maxDurationSeconds ?? 25;
  const maxChars = options.maxCharCount ?? 180;

  const chunks: TranscriptChunk[] = [];
  let currentStartTime = items[0].from;
  let currentEndTime = items[0].to;
  let currentTexts: string[] = [];

  for (const item of items) {
    const trimmed = (item.content || '').trim();
    if (!trimmed) continue;

    const durationSpan = item.to - currentStartTime;
    const combinedLength = currentTexts.join(' ').length + trimmed.length;

    // Split into a new chunk if time span or char length exceeded
    if (
      currentTexts.length > 0 &&
      (durationSpan > maxDuration || combinedLength > maxChars)
    ) {
      chunks.push({
        startTime: currentStartTime,
        endTime: currentEndTime,
        timestampStr: formatSeconds(currentStartTime),
        text: currentTexts.join(' '),
      });

      currentStartTime = item.from;
      currentTexts = [trimmed];
      currentEndTime = item.to;
    } else {
      currentTexts.push(trimmed);
      currentEndTime = Math.max(currentEndTime, item.to);
    }
  }

  if (currentTexts.length > 0) {
    chunks.push({
      startTime: currentStartTime,
      endTime: currentEndTime,
      timestampStr: formatSeconds(currentStartTime),
      text: currentTexts.join(' '),
    });
  }

  return chunks;
}

/**
 * Formats transcript chunks into an LLM-ready prompt text with timestamp prefixes.
 */
export function formatTranscriptForPrompt(chunks: TranscriptChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  return chunks
    .map((chunk) => `[${chunk.timestampStr}] ${chunk.text}`)
    .join('\n');
}
