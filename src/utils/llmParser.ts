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
 * Clean reasoning model think tags and markdown code blocks.
 */
export function cleanRawLLMText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    // 1. Remove closed <think>...</think> tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // 2. Remove unclosed <think>... if output was truncated mid-thought
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

  // 3. Strip markdown code fences if present
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    cleaned = jsonMatch[1].trim();
  }

  return cleaned;
}

/**
 * Heuristically repairs truncated or unclosed JSON strings (e.g. when LLM token limit is reached).
 */
export function repairTruncatedJson(jsonStr: string): string {
  let str = jsonStr.trim();
  const firstBrace = str.indexOf('{');
  if (firstBrace === -1) return str;

  str = str.substring(firstBrace);

  // Check quote parity (count unescaped quotes)
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && inString) {
      isEscaped = !isEscaped;
      continue;
    }

    if (char === '"' && !isEscaped) {
      inString = !inString;
    } else if (!inString) {
      if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
    isEscaped = false;
  }

  // If closed inside a string literal, close the string
  if (inString) {
    str += '"';
  }

  // Remove any trailing comma or dangling colon before closing structures
  str = str.replace(/,\s*$/, '').replace(/:\s*$/, ': null');

  // Append remaining unclosed braces and brackets
  while (stack.length > 0) {
    const closer = stack.pop();
    str = str.replace(/,\s*$/, '');
    str += closer;
  }

  return str;
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

  // 1. Clean think tags and markdown fences
  let jsonString = cleanRawLLMText(rawText);

  let parsed: RawLLMOutput | null = null;

  // Try direct parse first
  try {
    parsed = JSON.parse(jsonString);
  } catch (_) {
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    // If there is an unclosed object or array started after lastBrace, prioritize repairing the full string
    const hasUnclosedAfterLastBrace =
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      (jsonString.substring(lastBrace + 1).includes('{') ||
        jsonString.substring(lastBrace + 1).includes('['));

    if (hasUnclosedAfterLastBrace) {
      try {
        const repaired = repairTruncatedJson(jsonString);
        parsed = JSON.parse(repaired);
      } catch (_) {}
    }

    // Try substring between first { and last }
    if (!parsed && firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1));
      } catch (_) {}
    }

    // Fallback: heuristic repair
    if (!parsed) {
      try {
        const repaired = repairTruncatedJson(jsonString);
        parsed = JSON.parse(repaired);
      } catch (repairErr: any) {
        throw new Error(`Failed to parse LLM response as JSON: ${repairErr.message}`);
      }
    }
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
