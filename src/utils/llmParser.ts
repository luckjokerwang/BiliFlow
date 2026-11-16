import {
  HighlightItem,
  MapPhaseResult,
  OriginalQuote,
  VideoSummaryResult,
} from '../types';
import { parseTimestamp, formatSeconds } from './timeParser';

interface RawHighlight {
  timestamp?: string | number;
  time?: string | number;
  title?: string;
  keyPoint?: string;
  point?: string;
  description?: string;
}

interface RawGlossaryEntry {
  term?: unknown;
  definition?: unknown;
}

interface RawPunchlineQuote {
  timestamp?: string | number;
  time?: string | number;
  content?: unknown;
  quote?: unknown;
}

interface RawLLMOutput {
  oneSentenceSummary?: string;
  summary?: string;
  highlights?: RawHighlight[];
  followUpQuestions?: unknown[];
  glossary?: RawGlossaryEntry[];
  actionableTakeaways?: unknown[];
  punchlineQuotes?: RawPunchlineQuote[];
  error?: unknown;
}

/**
 * Clean reasoning model think tags and markdown code blocks.
 */
export function cleanRawLLMText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();

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

  if (inString) {
    str += '"';
  }

  str = str.replace(/,\s*$/, '').replace(/:\s*$/, ': null');

  while (stack.length > 0) {
    const closer = stack.pop();
    str = str.replace(/,\s*$/, '');
    str += closer;
  }

  return str;
}

function tryParseJsonObject<T>(text: string): T | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as T;
    }
  } catch {}
  return null;
}

function normalizedTimestamp(rawTime: string | number | undefined): {
  seconds: number;
  timeStr: string;
} {
  const value = rawTime ?? '00:00';
  if (typeof value === 'number') {
    return { seconds: value, timeStr: formatSeconds(value) };
  }
  const timeStr = String(value).replace(/[\[\]]/g, '').trim();
  return { seconds: parseTimestamp(timeStr), timeStr };
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

  const jsonString = cleanRawLLMText(rawText);
  let parsed: RawLLMOutput | null =
    tryParseJsonObject<RawLLMOutput>(jsonString);

  if (!parsed) {
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    const hasUnclosedAfterLastBrace =
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      (jsonString.substring(lastBrace + 1).includes('{') ||
        jsonString.substring(lastBrace + 1).includes('['));

    if (hasUnclosedAfterLastBrace) {
      parsed = tryParseJsonObject<RawLLMOutput>(
        repairTruncatedJson(jsonString)
      );
    }

    if (!parsed && firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      parsed = tryParseJsonObject<RawLLMOutput>(
        jsonString.substring(firstBrace, lastBrace + 1)
      );
    }

    if (!parsed) {
      const repaired = repairTruncatedJson(jsonString);
      parsed = tryParseJsonObject<RawLLMOutput>(repaired);
      if (!parsed) {
        let parseError = 'unknown JSON parse error';
        try {
          JSON.parse(repaired);
        } catch (err: unknown) {
          parseError = err instanceof Error ? err.message : String(err);
        }
        throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
      }
    }
  }

  if (typeof parsed.error === 'string') {
    throw new Error(parsed.error);
  }

  const rawHighlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.filter(
        (item): item is RawHighlight => typeof item === 'object' && item !== null
      )
    : [];

  const highlights: HighlightItem[] = rawHighlights.map((item, index) => {
    const { seconds, timeStr } = normalizedTimestamp(
      item.timestamp ?? item.time
    );
    return {
      id: index + 1,
      timestamp: seconds,
      timestampStr: timeStr,
      title: (item.title || `亮点 ${index + 1}`).trim(),
      keyPoint: (item.keyPoint || item.point || item.description || '').trim(),
    };
  });

  if (highlights.length === 0) {
    throw new Error('LLM 未能提炼出有效的视频核心亮点。');
  }

  const glossary = (Array.isArray(parsed.glossary) ? parsed.glossary : [])
    .filter(
      (entry): entry is RawGlossaryEntry =>
        typeof entry === 'object' && entry !== null
    )
    .map((entry) => ({
      term: typeof entry.term === 'string' ? entry.term.trim() : '',
      definition:
        typeof entry.definition === 'string' ? entry.definition.trim() : '',
    }))
    .filter((entry) => entry.term.length > 0 && entry.definition.length > 0);

  const actionableTakeaways = (
    Array.isArray(parsed.actionableTakeaways) ? parsed.actionableTakeaways : []
  )
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const punchlineQuotes: OriginalQuote[] = (
    Array.isArray(parsed.punchlineQuotes) ? parsed.punchlineQuotes : []
  )
    .filter(
      (item): item is RawPunchlineQuote =>
        typeof item === 'object' && item !== null
    )
    .map((item) => {
      const { seconds, timeStr } = normalizedTimestamp(
        item.timestamp ?? item.time
      );
      const rawContent = item.content ?? item.quote;
      return {
        timestamp: seconds,
        timestampStr: timeStr,
        content: typeof rawContent === 'string' ? rawContent.trim() : '',
      };
    })
    .filter((quote) => quote.content.length > 0);

  return {
    bvid: meta.bvid,
    cid: meta.cid,
    title: meta.title,
    oneSentenceSummary: (parsed.oneSentenceSummary || parsed.summary || '').trim(),
    highlights,
    followUpQuestions: (Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions
      : []
    )
      .filter((question): question is string => typeof question === 'string')
      .map((question) => question.trim())
      .filter((question) => question.length > 0),
    glossary,
    actionableTakeaways,
    punchlineQuotes,
    createdAt: Date.now(),
    schemaVersion: 2,
  };
}

interface RawMapKeyPoint {
  timestamp?: string | number;
  time?: string | number;
  text?: unknown;
  content?: unknown;
}

interface RawMapOutput {
  summary?: unknown;
  keyPoints?: RawMapKeyPoint[];
  punchlineQuotes?: RawPunchlineQuote[];
}

/**
 * Parses one Map phase result. Empty local content is valid; malformed JSON
 * still throws so the whole provider pipeline can fail over.
 */
export function parseMapPhaseOutput(rawText: string): MapPhaseResult {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Map phase output is empty or invalid.');
  }

  const jsonString = cleanRawLLMText(rawText);
  let parsed = tryParseJsonObject<RawMapOutput>(jsonString);
  if (!parsed) {
    parsed = tryParseJsonObject<RawMapOutput>(repairTruncatedJson(jsonString));
  }
  if (!parsed) {
    throw new Error('Failed to parse map phase output as JSON.');
  }

  const keyPoints = (Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [])
    .filter(
      (item): item is RawMapKeyPoint =>
        typeof item === 'object' && item !== null
    )
    .map((item) => {
      const { seconds, timeStr } = normalizedTimestamp(
        item.timestamp ?? item.time
      );
      const rawText = item.text ?? item.content;
      return {
        timestamp: seconds,
        timestampStr: timeStr,
        text: typeof rawText === 'string' ? rawText.trim() : '',
      };
    })
    .filter((item) => item.text.length > 0);

  const punchlineQuotes: OriginalQuote[] = (
    Array.isArray(parsed.punchlineQuotes) ? parsed.punchlineQuotes : []
  )
    .filter(
      (item): item is RawPunchlineQuote =>
        typeof item === 'object' && item !== null
    )
    .map((item) => {
      const { seconds, timeStr } = normalizedTimestamp(
        item.timestamp ?? item.time
      );
      const rawContent = item.content ?? item.quote;
      return {
        timestamp: seconds,
        timestampStr: timeStr,
        content: typeof rawContent === 'string' ? rawContent.trim() : '',
      };
    })
    .filter((quote) => quote.content.length > 0);

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    keyPoints,
    punchlineQuotes,
  };
}
