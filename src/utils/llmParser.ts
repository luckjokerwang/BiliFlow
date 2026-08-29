import { HighlightItem, VideoSummaryResult } from '../types';
import { parseTimestamp, formatSeconds } from './timeParser';

interface RawLLMOutput {
  oneSentenceSummary?: string;
  summary?: string;
  highlights?: Array<{
    timestamp?: string | number;
    time?: string | number;
    title?: string;
    keyPoint?: string;
    point?: string;
    description?: string;
  }>;
  followUpQuestions?: string[];
}

/**
 * Extracts and normalizes structured video summary data from raw LLM responses.
 */
export function parseLLMSummaryOutput(
  rawText: string,
  meta: { bvid: string; cid: string; title: string }
): VideoSummaryResult {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('LLM output is empty or invalid.');
  }

  // 1. Strip markdown code fences if present
  let jsonString = rawText.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  } else {
    // Attempt to locate JSON boundary between the first { and last }
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: RawLLMOutput;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Failed to parse LLM response as JSON: ${err.message}`);
  }

  const rawHighlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];

  const highlights: HighlightItem[] = rawHighlights.map((item, index) => {
    const rawTime = item.timestamp ?? item.time ?? '00:00';
    let seconds = 0;
    let timeStr = '00:00';

    if (typeof rawTime === 'number') {
      seconds = rawTime;
      timeStr = formatSeconds(seconds);
    } else {
      timeStr = String(rawTime).replace(/[\[\]]/g, '').trim();
      seconds = parseTimestamp(timeStr);
    }

    return {
      id: index + 1,
      timestamp: seconds,
      timestampStr: timeStr,
      title: (item.title || `亮点 ${index + 1}`).trim(),
      keyPoint: (item.keyPoint || item.point || item.description || '').trim(),
    };
  });

  return {
    bvid: meta.bvid,
    cid: meta.cid,
    title: meta.title,
    oneSentenceSummary: (parsed.oneSentenceSummary || parsed.summary || '').trim(),
    highlights,
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.filter((q) => typeof q === 'string' && q.trim().length > 0)
      : [],
    createdAt: Date.now(),
  };
}
