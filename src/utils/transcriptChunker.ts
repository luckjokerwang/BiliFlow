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
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  if (chunks.length === 1) {
    const single = chunks[0];
    if (single.text.length <= maxTotalChars) return [single];
    return [
      {
        ...single,
        text: single.text.slice(0, maxTotalChars),
      },
    ];
  }

  const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
  if (totalChars <= maxTotalChars) {
    return chunks;
  }

  // Determine target chunk count K spanning timeline start to end
  const targetK = Math.min(
    chunks.length - 1,
    Math.max(4, Math.min(30, Math.floor(maxTotalChars / 60)))
  );
  const K = Math.max(1, targetK);
  const budgetPerChunk = Math.floor(maxTotalChars / K);

  const result: TranscriptChunk[] = [];
  const N = chunks.length;

  for (let i = 0; i < K; i++) {
    const startIdx = Math.floor((i * N) / K);
    const endIdx = Math.min(N - 1, Math.floor(((i + 1) * N) / K) - 1);
    const slice = chunks.slice(startIdx, Math.max(startIdx + 1, endIdx + 1));

    if (slice.length === 0) continue;

    const first = slice[0];
    const last = slice[slice.length - 1];

    let combinedText = slice.map((c) => c.text).join(' ');
    if (combinedText.length > budgetPerChunk) {
      combinedText = combinedText.slice(0, budgetPerChunk);
    }

    result.push({
      startTime: first.startTime,
      endTime: last.endTime,
      timestampStr: first.timestampStr,
      text: combinedText,
    });
  }

  return result;
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
