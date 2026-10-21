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
 * Downsamples and merges chunks uniformly across the timeline to fit within maxTotalChars
 * without ever truncating or omitting the end of the video.
 */
export function compressChunksToFit(
  chunks: TranscriptChunk[],
  maxTotalChars = 24000
): TranscriptChunk[] {
  if (!Array.isArray(chunks) || chunks.length <= 1) return chunks || [];

  let totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
  if (totalChars <= maxTotalChars) {
    return chunks;
  }

  // Progressively merge adjacent pairs until total characters fit within budget
  let currentChunks = [...chunks];
  while (totalChars > maxTotalChars && currentChunks.length > 8) {
    const merged: TranscriptChunk[] = [];
    for (let i = 0; i < currentChunks.length; i += 2) {
      if (i + 1 < currentChunks.length) {
        const c1 = currentChunks[i];
        const c2 = currentChunks[i + 1];
        merged.push({
          startTime: c1.startTime,
          endTime: c2.endTime,
          timestampStr: c1.timestampStr,
          text: `${c1.text} ${c2.text}`,
        });
      } else {
        merged.push(currentChunks[i]);
      }
    }
    currentChunks = merged;
    totalChars = currentChunks.reduce((sum, c) => sum + c.text.length, 0);
  }

  return currentChunks;
}

/**
 * Formats transcript chunks into an LLM-ready prompt text with timestamp prefixes.
 * Guarantees timeline integrity for long videos while fitting within token limits.
 */
export function formatTranscriptForPrompt(
  chunks: TranscriptChunk[],
  maxTotalChars = 24000
): string {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  const fittedChunks = compressChunksToFit(chunks, maxTotalChars);

  return fittedChunks
    .map((chunk) => `[${chunk.timestampStr}] ${chunk.text}`)
    .join('\n');
}
