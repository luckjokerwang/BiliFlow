import {
  ProviderConfig,
  VideoSummaryResult,
  BiliRawSubtitleItem,
  HighlightItem,
  OriginalQuote,
  TranscriptWindow,
  MapPhaseResult,
  VideoPreflightMetadata,
  CreatorChapter,
} from '../types';
import {
  chunkSubtitles,
  formatTranscriptForPrompt,
  partitionSubtitlesIntoWindows,
} from '../utils/transcriptChunker';
import { parseLLMSummaryOutput, parseMapPhaseOutput } from '../utils/llmParser';
import { extractQuotesForHighlight, snapTimestampToUtterance } from '../utils/subtitleUtils';
import {
  applyCreatorChapterStructure,
  resolveCreatorChapters,
} from '../utils/officialChapters';
import { formatSeconds } from '../utils/timeParser';

const SUMMARY_SYSTEM_PROMPT = `
你是一个专业的 B 站视频核心内容提炼专家。
请仔细阅读给出的带时间戳视频字幕，并结合提供的官方章节、简介时间戳与弹幕高能点，提炼出高信息密度的结构化总结。

请严格输出 JSON 格式（不要有前置或后置的多余客套话），格式如下：
{
  "oneSentenceSummary": "用 1-2 句话概括全片核心观点与主旨",
  "highlights": [
    {
      "timestamp": "mm:ss (对应字幕中该论点或演示开始的时间戳，如 01:25)",
      "title": "简明主题标题 (< 15字)",
      "keyPoint": "用 1 句精炼的话说明此处的要点/干货"
    }
  ],
  "followUpQuestions": [
    "针对视频核心内容延伸出的 2-3 个好问题"
  ],
  "glossary": [
    { "term": "视频中出现的专业术语", "definition": "结合视频语境的简明定义" }
  ],
  "actionableTakeaways": [
    "具体可执行的收获或操作步骤"
  ],
  "punchlineQuotes": [
    { "timestamp": "mm:ss", "content": "必须是字幕中出现的原文" }
  ]
}

要求：
1. 三种结构互斥，按优先级只选一种输出 highlights：
   - 若提供了【UP 主官方章节】：每个有效章节生成一个 highlight，使用原章节标题与原章节起点时间（章节区间左端），不受 3 到 6 个上限，也不要求章节起点严格等于某句字幕的起始时间。
   - 否则若提供了至少两个【简介时间戳】：每个简介时间段生成一个 highlight，使用原简介标题与该时间点作为起点，最后一个时间段延续到视频结尾；同样不受 3 到 6 个上限，也不要求起点严格等于字幕起始时间。
   - 以上两者都没有时：自行生成 3 到 6 个最核心节点，timestamp 必须吸附到字幕中真实出现的起始时间戳（格式 mm:ss 或 hh:mm:ss）。
2. 每个 highlight 的 keyPoint 必须概括该段字幕中的具体结论、步骤或信息，不得只复述标题；若该段字幕没有实质内容，keyPoint 返回空字符串，禁止补写。
3. AI 自由节点阶段应让核心节点按时间线覆盖视频全片脉络（包含起承转合、核心论点推进与结尾结论），严禁全部拥挤在开篇前几分钟。
4. 【简介时间戳】仅在存在至少两个点时作为上述第二种结构的直接依据；只有一个点时视作普通参考，仍走 AI 自由节点结构并保持 3 到 6 个 highlights。
5. 逐一核对【弹幕高能时间点】附近字幕；有实质内容的高能段必须在对应章节 keyPoint 或独立 highlight 中覆盖，密度数值本身不得被当作事实。
6. 无 preflight 数据时保持纯字幕提炼；语言保持客观、干练、直击要害。
7. 术语定义必须来自视频语境；行动项必须具体可执行，不是泛泛的 bullet point。
8. punchlineQuotes 必须是字幕原文并带开始时间，禁止改写或编造；没有内容时返回空数组。
9. glossary、actionableTakeaways 没有有效内容时也返回空数组，禁止编造。
10. 提炼内容必须紧密围绕【视频标题】与实际字幕内容展开；若提供的字幕与视频标题完全不匹配（如数据源错位），请在 JSON 中返回 {"error": "字幕内容与视频标题不匹配，可能存在数据源错位"}。
11. 长视频 reduce 阶段的 punchlineQuotes 只能逐字选自【逐字金句候选】，不得从记忆或概括中生成新原文。
`.trim();

const MAP_SYSTEM_PROMPT = `
你是长视频字幕的局部 Map 阶段分析器。只处理当前时间窗口，提炼局部事实与逐字金句候选，不要输出全片总结。

请严格输出 JSON 格式（不要有前置或后置的多余客套话），格式如下：
{
  "summary": "当前窗口的 1-2 句局部摘要",
  "keyPoints": [
    { "timestamp": "mm:ss (必须落在当前窗口)", "text": "局部事实要点" }
  ],
  "punchlineQuotes": [
    { "timestamp": "mm:ss", "content": "必须逐字摘录当前窗口字幕" }
  ]
}

要求：
1. keyPoints 数量控制在 3 到 6 个；窗口没有实质内容时 summary 返回空字符串且两个数组返回空数组。
2. 时间戳必须落在当前窗口范围，且对应字幕中出现的起始时间。
3. punchlineQuotes 必须逐字摘自当前窗口字幕，禁止改写、拼接或编造；没有合适原文时返回空数组。
4. 只输出 JSON，不输出 Markdown 或解释文字。
`.trim();

function cleanDescriptionForPrompt(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return cleaned.slice(0, 1000).trim();
}

function buildPreflightPrompt(metadata?: VideoPreflightMetadata): string {
  if (!metadata) return '';
  const blocks: string[] = [];

  const chapters = metadata.officialChapters || [];
  if (chapters.length > 0) {
    blocks.push(
      `【UP 主官方章节】\n${chapters
        .map(
          (chapter) =>
            `- [${formatSeconds(chapter.from)} ~ ${formatSeconds(chapter.to)}] ${chapter.title}`
        )
        .join('\n')}`
    );
  }

  const cleanedDescription = cleanDescriptionForPrompt(metadata.description);
  if (cleanedDescription) {
    blocks.push(`【视频简介 / UP主背景说明】\n${cleanedDescription}`);
  }

  const descriptionPoints = metadata.descriptionTimestamps || [];
  if (descriptionPoints.length > 0) {
    blocks.push(
      `【简介时间戳】\n${descriptionPoints
        .map((point) => `- [${formatSeconds(point.seconds)}] ${point.title}`)
        .join('\n')}`
    );
  }

  const peaks = metadata.danmakuHeatmapPeaks || [];
  if (peaks.length > 0) {
    blocks.push(
      `【弹幕高能时间点】\n${peaks
        .map(
          (peak) =>
            `- [${formatSeconds(peak.timestampSec)}] 密度 ${peak.densityRatio.toFixed(3)}`
        )
        .join('\n')}`
    );
  }

  return blocks.join('\n\n');
}

function matchPunchlineQuotesToSubtitles(
  quotes: OriginalQuote[],
  subtitles: BiliRawSubtitleItem[]
): OriginalQuote[] {
  const normalizedSubtitles = subtitles.map((item) => ({
    item,
    normalized: item.content.replace(/\s+/g, ''),
  }));

  return quotes.flatMap((quote) => {
    const normalizedQuote = quote.content.replace(/\s+/g, '');
    if (!normalizedQuote) return [];

    const candidates = normalizedSubtitles.filter(({ normalized }) =>
      normalized.includes(normalizedQuote)
    );
    if (candidates.length === 0) return [];

    const best = candidates.reduce((closest, candidate) =>
      Math.abs(candidate.item.from - quote.timestamp) <
      Math.abs(closest.item.from - quote.timestamp)
        ? candidate
        : closest
    );

    return [
      {
        timestamp: best.item.from,
        timestampStr: formatSeconds(best.item.from),
        content: best.item.content,
      },
    ];
  });
}

function filterPreflightForWindow(
  metadata: VideoPreflightMetadata | undefined,
  window: TranscriptWindow
): VideoPreflightMetadata {
  if (!metadata) return {};
  const result: VideoPreflightMetadata = {};

  const chapters = (metadata.officialChapters || []).filter(
    (chapter) => chapter.from < window.endTime && chapter.to > window.startTime
  );
  const descriptionTimestamps = (metadata.descriptionTimestamps || []).filter(
    (point) =>
      point.seconds >= window.startTime && point.seconds <= window.endTime
  );
  const peaks = (metadata.danmakuHeatmapPeaks || []).filter(
    (peak) =>
      peak.timestampSec >= window.startTime &&
      peak.timestampSec <= window.endTime
  );

  if (chapters.length > 0) result.officialChapters = chapters;
  if (metadata.description) result.description = metadata.description;
  if (descriptionTimestamps.length > 0) {
    result.descriptionTimestamps = descriptionTimestamps;
  }
  if (peaks.length > 0) result.danmakuHeatmapPeaks = peaks;
  return result;
}

function buildMapPrompt(
  title: string,
  window: TranscriptWindow,
  preflight: VideoPreflightMetadata | undefined
): string {
  const anchors = buildPreflightPrompt(
    filterPreflightForWindow(preflight, window)
  );
  const anchorBlock = anchors ? `${anchors}\n` : '';
  return `
【视频标题】：${title}
【字幕窗口】：${window.timestampStr}
${anchorBlock}【当前窗口字幕】：
${window.text}
`.trim();
}

function buildReducePrompt(
  title: string,
  preflight: VideoPreflightMetadata | undefined,
  mapResults: MapPhaseResult[],
  punchlineCandidates: OriginalQuote[]
): string {
  const anchors = buildPreflightPrompt(preflight);
  const anchorBlock = anchors ? `${anchors}\n` : '';
  const segments = mapResults
    .map((result, index) => {
      const points = result.keyPoints
        .map((point) => `- [${point.timestampStr}] ${point.text}`)
        .join('\n');
      return `【分段 ${index + 1}】\n局部摘要：${result.summary || '（无）'}\n${points || '（无局部要点）'}`;
    })
    .join('\n\n');
  const candidates = punchlineCandidates.length
    ? punchlineCandidates
        .map((quote) => `- [${quote.timestampStr}] ${quote.content}`)
        .join('\n')
    : '（无可用候选）';

  return `
【视频标题】：${title}
${anchorBlock}【分段摘要】：
${segments}

【逐字金句候选】：
${candidates}
`.trim();
}

export function formatBaseUrl(rawUrl: string, path: string): string {
  let clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    throw new Error(`API 接口地址格式错误: "${rawUrl || '(空)'}"。必须以 https:// 或 http:// 开头`);
  }
  if (!clean.endsWith('/v1') && !clean.endsWith('/v4') && !clean.endsWith('/openai')) {
    clean = `${clean}/v1`;
  }
  return `${clean}/${path.replace(/^\/+/, '')}`;
}

/**
 * Automatically fetch model list from OpenAI-compatible /v1/models endpoint.
 */
export async function fetchRemoteModels(config: {
  baseUrl: string;
  apiKey: string;
}): Promise<string[]> {
  const { baseUrl, apiKey } = config;
  if (!baseUrl) {
    throw new Error('请先填写 API 接口地址 (Base URL)');
  }
  if (!apiKey) {
    throw new Error('请先填写 API Key');
  }

  const endpoint = formatBaseUrl(baseUrl, 'models');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('API Key 无效或未授权 (401 Unauthorized)，请检查 Key 是否正确。');
      }
      throw new Error(`获取模型列表失败 (HTTP ${response.status}): ${errText || response.statusText}`);
    }

    const data: unknown = await response.json();
    const root = data as { data?: unknown } | null;
    const rawList: unknown[] = Array.isArray(root?.data)
      ? root.data
      : Array.isArray(data)
        ? data
        : [];

    const modelIds: string[] = rawList
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as { id?: unknown; name?: unknown };
          if (typeof record.id === 'string') return record.id;
          if (typeof record.name === 'string') return record.name;
        }
        return '';
      })
      .filter((id) => id.trim().length > 0);

    if (modelIds.length === 0) {
      throw new Error('远程接口已连通，但返回的模型列表为空。');
    }

    return Array.from(new Set<string>(modelIds)).sort();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('获取模型列表超时 (12s)，请检查网络连接或接口地址是否正确。');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test connectivity and measure latency for a provider configuration.
 */
export async function testProviderConnection(config: {
  baseUrl: string;
  apiKey: string;
  model?: string;
}): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const { baseUrl, apiKey, model } = config;
  if (!baseUrl || !apiKey) {
    return { success: false, latencyMs: 0, error: 'Base URL 与 API Key 不能为空' };
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const endpoint = formatBaseUrl(baseUrl, 'chat/completions');
    const targetModel = model || 'deepseek-chat';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 2,
      }),
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let friendlyMsg = `HTTP ${response.status}: ${errText || response.statusText}`;

      try {
        const errJson = JSON.parse(errText) as {
          error?: { message?: string };
        };
        if (errJson?.error?.message) {
          if (
            response.status === 402 ||
            errJson.error.message.toLowerCase().includes('insufficient balance')
          ) {
            friendlyMsg = '账户余额不足 (Insufficient Balance)，请前往服务商充值。';
          } else if (response.status === 401) {
            friendlyMsg = 'API Key 无效 (401 Unauthorized)，请检查 Key 是否填写正确。';
          } else {
            friendlyMsg = `错误: ${errJson.error.message}`;
          }
        }
      } catch {}

      return {
        success: false,
        latencyMs,
        error: friendlyMsg,
      };
    }

    return { success: true, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        error: '网络请求超时 (12s)。若测试海外模型 (如 OpenAI/Gemini)，请检查网络代理；若为本地模型 (如 Ollama)，请确认服务已启动。',
      };
    }
    return {
      success: false,
      latencyMs,
      error:
        (err instanceof Error ? err.message : String(err)) ||
        '网络连接超时或无法访问该地址 (Failed to fetch)',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface LlmCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface LlmRequestError extends Error {
  status?: number;
  isFatal?: boolean;
}

export const MAP_REDUCE_WINDOW_SEC = 1200; // 20 minutes per window (up from 600s / 10min)
export const MAP_REDUCE_MIN_DURATION_SEC = 2400; // 40 minutes minimum duration threshold (up from 1200s / 20min)
export const MAP_REDUCE_CHAR_THRESHOLD = 24000; // 24k chars single-shot prompt budget
export const MAP_CONCURRENCY_LIMIT = 3; // Maximum concurrent LLM requests during Map phase

export interface SummaryProgressEvent {
  stage: 'map' | 'reduce';
  current?: number;
  total?: number;
  message: string;
}

export function shouldTriggerMapReduce(params: {
  effectiveDurationSec: number;
  totalSubtitleChars: number;
}): boolean {
  const { effectiveDurationSec, totalSubtitleChars } = params;
  if (totalSubtitleChars > MAP_REDUCE_CHAR_THRESHOLD) {
    return true;
  }
  if (effectiveDurationSec > MAP_REDUCE_MIN_DURATION_SEC) {
    return true;
  }
  return false;
}

/**
 * Concurrently executes asynchronous tasks with a maximum concurrency limit.
 * Preserves task order in the returned results array.
 * Immediately cancels remaining / in-flight tasks upon fatal error via AbortSignal.
 */
export async function runConcurrentTasks<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T, index: number, signal: AbortSignal) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown = null;
  const abortController = new AbortController();

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      if (firstError || abortController.signal.aborted) break;
      const index = nextIndex++;
      try {
        const res = await taskFn(items[index], index, abortController.signal);
        results[index] = res;
      } catch (err) {
        if (!firstError) {
          firstError = err;
          abortController.abort();
        }
        break;
      }
    }
  });

  await Promise.all(workers);
  if (firstError) {
    throw firstError;
  }
  return results;
}

async function executeSingleChatCompletion(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxRetries?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const {
    endpoint,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    maxRetries = 2,
    signal,
  } = params;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('请求已取消');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const onExternalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) {
          controller.abort();
        } else {
          signal.addEventListener('abort', onExternalAbort, { once: true });
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onExternalAbort);
        }
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errMessage = `HTTP ${response.status}: ${errorBody || response.statusText}`;
        let isFatal = false;

        try {
          const errJson = JSON.parse(errorBody) as {
            error?: { message?: string };
          };
          if (errJson?.error?.message) {
            errMessage = errJson.error.message;
          }
        } catch {}

        if (response.status === 402 || errMessage.toLowerCase().includes('insufficient balance')) {
          errMessage = '账户余额不足 (Insufficient Balance)';
          isFatal = true;
        } else if (response.status === 401) {
          errMessage = 'API Key 无效或未授权 (401 Unauthorized)';
          isFatal = true;
        } else if (response.status === 404) {
          errMessage = `模型或接口路径不存在 (404 Not Found): ${model}`;
          isFatal = true;
        }

        const error = new Error(
          `LLM 报错 (${model}): ${errMessage}`
        ) as LlmRequestError;
        error.status = response.status;
        error.isFatal = isFatal;

        if (isFatal || attempt >= maxRetries || (response.status !== 429 && response.status < 500)) {
          throw error;
        }

        lastError = error;
      } else {
        const data = (await response.json()) as LlmCompletionResponse;
        const rawContent = data.choices?.[0]?.message?.content;
        if (typeof rawContent !== 'string' || !rawContent) {
          throw new Error(`模型 ${model} 返回内容为空`);
        }
        return rawContent;
      }
    } catch (err: unknown) {
      lastError = err;
      const requestError = err as LlmRequestError;
      if (signal?.aborted) {
        throw err;
      }
      if (requestError?.isFatal || attempt >= maxRetries) {
        throw err;
      }

      // Exponential backoff with jitter: 1s -> 2s (+ 0~200ms jitter)
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 4000);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[BiliFlow LLM] 请求【${model}】失败 (${errMsg})，${Math.round(delayMs)}ms 后进行第 ${attempt + 1}/${maxRetries} 次重试...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`模型 ${model} 请求失败`);
}

/**
 * Generate structured video summary with automatic Cross-Provider Fallback failover strategy.
 */
export interface AttachQuotesOptions {
  preserveTimestamps?: boolean;
  creatorChapters?: CreatorChapter[];
}

export function attachQuotesToHighlights(
  rawHighlights: HighlightItem[],
  subtitles: BiliRawSubtitleItem[],
  options: AttachQuotesOptions = {}
): HighlightItem[] {
  const { preserveTimestamps = false, creatorChapters } = options;
  const chapterMode = Array.isArray(creatorChapters) && creatorChapters.length > 0;

  const snappedList = rawHighlights.map((item) => {
    const rawSec = item.timestamp ?? item.timestampSec ?? 0;
    const snappedSec = preserveTimestamps
      ? rawSec
      : snapTimestampToUtterance(rawSec, subtitles);
    return {
      ...item,
      timestamp: snappedSec,
      timestampSec: snappedSec,
      timestampStr: formatSeconds(snappedSec),
    };
  });

  return snappedList.map((item, idx, arr) => {
    const chapter = chapterMode ? creatorChapters[idx] : undefined;
    const nextItem = arr[idx + 1];
    const nextSec = nextItem ? nextItem.timestampSec : undefined;
    const quoteOptions = chapter
      ? { sectionEndSec: chapter.to, allowNearestFallback: false }
      : nextSec !== undefined
        ? { sectionEndSec: nextSec }
        : {};
    return {
      ...item,
      originalQuotes: extractQuotesForHighlight(item.timestampSec, subtitles, quoteOptions),
    };
  });
}

export interface GenerateVideoSummaryParams {
  bvid: string;
  cid: string;
  title: string;
  subtitles: BiliRawSubtitleItem[];
  durationSec?: number;
  preflight?: VideoPreflightMetadata;
  description?: string;
  provider: ProviderConfig;
  model?: string;
  fallbackProvider?: ProviderConfig;
  fallbackModel?: string;
  candidateProviders?: ProviderConfig[];
  enableFallback?: boolean;
  onProgress?: (event: SummaryProgressEvent) => void;
}

export async function generateVideoSummary(
  params: GenerateVideoSummaryParams
): Promise<VideoSummaryResult> {
  const {
    bvid,
    cid,
    title,
    subtitles,
    durationSec,
    preflight: rawPreflight,
    description,
    provider,
    model,
    fallbackProvider,
    fallbackModel,
    candidateProviders,
    enableFallback = true,
    onProgress,
  } = params;

  let preflight = rawPreflight;
  if (description && (!preflight || !preflight.description)) {
    preflight = { ...preflight, description };
  }

  if (!provider.apiKey) {
    throw new Error(`厂商【${provider.name}】未配置 API Key，请打开设置中心填入 Key。`);
  }

  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    throw new Error('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
  }

  const validSubtitles = subtitles.filter(
    (item) => item && item.content && item.content.trim().length > 0
  );
  if (validSubtitles.length === 0) {
    throw new Error('该视频未包含任何有效字幕文本，无法提炼要点。');
  }

  const subtitleEnd = validSubtitles.reduce(
    (end, item) =>
      Number.isFinite(item.to) && item.to > end ? item.to : end,
    0
  );
  const validDurationSec =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : 0;
  const effectiveDurationSec = Math.max(validDurationSec, subtitleEnd);
  const totalSubtitleChars = validSubtitles.reduce(
    (sum, item) => sum + (item.content ? item.content.length : 0),
    0
  );

  const useMapReduce = shouldTriggerMapReduce({
    effectiveDurationSec,
    totalSubtitleChars,
  });
  const rawWindows = useMapReduce
    ? partitionSubtitlesIntoWindows(validSubtitles, MAP_REDUCE_WINDOW_SEC)
    : [];
  const effectiveUseMapReduce = useMapReduce && rawWindows.length > 1;
  const windows = effectiveUseMapReduce ? rawWindows : [];

  function buildShortPrompt(): string {
    const chunks = chunkSubtitles(validSubtitles, {
      maxDurationSeconds: 25,
      maxCharCount: 200,
    });
    const formattedTranscript = formatTranscriptForPrompt(chunks);
    if (!formattedTranscript || !formattedTranscript.trim()) {
      throw new Error('格式化后的字幕内容为空，无法进行 AI 提炼。');
    }

    const preflightPrompt = buildPreflightPrompt(preflight);
    const preflightBlock = preflightPrompt ? `${preflightPrompt}\n` : '';
    return `
【视频标题】：${title}
${preflightBlock}【视频字幕】：
${formattedTranscript}
`.trim();
  }

  const primaryModel =
    model || provider.selectedModel || provider.models[0] || 'deepseek-chat';

  interface ExecutionTarget {
    provider: ProviderConfig;
    model: string;
    isFallback: boolean;
  }

  const queue: ExecutionTarget[] = [
    { provider, model: primaryModel, isFallback: false },
  ];

  if (enableFallback) {
    const hasExplicitCross =
      fallbackProvider &&
      fallbackProvider.apiKey &&
      (fallbackProvider.id !== provider.id || Boolean(fallbackModel));
    const targetFallbackProvider = hasExplicitCross ? fallbackProvider : provider;
    const targetFallbackModel =
      fallbackModel ||
      targetFallbackProvider.fallbackModel ||
      (targetFallbackProvider.models.find((m) => m !== primaryModel) ||
        targetFallbackProvider.selectedModel ||
        targetFallbackProvider.models[0]);

    if (
      targetFallbackProvider.apiKey &&
      targetFallbackModel &&
      (targetFallbackProvider.id !== provider.id || targetFallbackModel !== primaryModel)
    ) {
      queue.push({
        provider: targetFallbackProvider,
        model: targetFallbackModel,
        isFallback: true,
      });
    }

    if (Array.isArray(candidateProviders)) {
      for (const cp of candidateProviders) {
        if (!cp.apiKey || cp.apiKey.trim().length === 0) continue;
        if (queue.some((q) => q.provider.id === cp.id)) continue;
        queue.push({
          provider: cp,
          model: cp.selectedModel || cp.models[0] || 'default',
          isFallback: true,
        });
      }
    }
  }

  async function runPipelineForTarget(
    target: ExecutionTarget,
    endpoint: string
  ): Promise<string> {
    const requestBase = {
      endpoint,
      apiKey: target.provider.apiKey,
      model: target.model,
    };

    if (!effectiveUseMapReduce) {
      return executeSingleChatCompletion({
        ...requestBase,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        userPrompt: buildShortPrompt(),
      });
    }

    if (windows.length === 0) {
      throw new Error('长视频分段未产生任何可用内容');
    }

    onProgress?.({
      stage: 'map',
      current: 0,
      total: windows.length,
      message: `正在并行提炼 ${windows.length} 个视频分段...`,
    });

    let completedWindows = 0;

    const mapResults = await runConcurrentTasks(
      windows,
      MAP_CONCURRENCY_LIMIT,
      async (window, _index, signal) => {
        const rawMapOutput = await executeSingleChatCompletion({
          ...requestBase,
          systemPrompt: MAP_SYSTEM_PROMPT,
          userPrompt: buildMapPrompt(title, window, preflight),
          signal,
        });
        const parsedMap = parseMapPhaseOutput(rawMapOutput);
        const keyPoints = parsedMap.keyPoints.filter(
          (point) =>
            point.timestamp >= window.startTime && point.timestamp <= window.endTime
        );
        const punchlineQuotes = matchPunchlineQuotesToSubtitles(
          parsedMap.punchlineQuotes,
          window.items
        );

        completedWindows++;
        onProgress?.({
          stage: 'map',
          current: completedWindows,
          total: windows.length,
          message: `正在并行提炼视频分段 (${completedWindows}/${windows.length})...`,
        });

        return {
          summary: parsedMap.summary,
          keyPoints,
          punchlineQuotes,
        };
      }
    );

    const hasContent = mapResults.some(
      (result) =>
        result.summary.trim().length > 0 ||
        result.keyPoints.length > 0 ||
        result.punchlineQuotes.length > 0
    );
    if (!hasContent) {
      throw new Error('长视频分段未产生任何可用内容');
    }

    const punchlineCandidates: OriginalQuote[] = [];
    for (const res of mapResults) {
      punchlineCandidates.push(...res.punchlineQuotes);
    }

    onProgress?.({
      stage: 'reduce',
      message: '正在综合各分段生成全片总结与高光点...',
    });

    return executeSingleChatCompletion({
      ...requestBase,
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt: buildReducePrompt(
        title,
        preflight,
        mapResults,
        punchlineCandidates
      ),
    });
  }

  const errors: string[] = [];

  for (let i = 0; i < queue.length; i++) {
    const target = queue[i];
    const isPrimary = i === 0;
    const endpoint = formatBaseUrl(target.provider.baseUrl, 'chat/completions');

    if (!isPrimary) {
      console.warn(
        `[BiliFlow Failover] 正在自动切换至【${target.provider.name} · ${target.model}】(第 ${i + 1}/${queue.length} 级容灾兜底)...`
      );
    }

    try {
      const rawContent = await runPipelineForTarget(target, endpoint);
      const parsed = parseLLMSummaryOutput(rawContent, { bvid, cid, title });
      const resolvedChapters = resolveCreatorChapters(preflight, effectiveDurationSec);
      const structuredHighlights = resolvedChapters
        ? applyCreatorChapterStructure(parsed.highlights, resolvedChapters.chapters)
        : parsed.highlights;
      const highlightsWithQuotes = attachQuotesToHighlights(
        structuredHighlights,
        subtitles,
        resolvedChapters
          ? {
              preserveTimestamps: true,
              creatorChapters: resolvedChapters.chapters,
            }
          : {}
      );
      const punchlineQuotes = matchPunchlineQuotesToSubtitles(
        parsed.punchlineQuotes || [],
        validSubtitles
      );

      return {
        ...parsed,
        highlights: highlightsWithQuotes,
        punchlineQuotes,
        chapterSource: resolvedChapters?.source,
        usedModel: target.model,
        usedProviderName: target.provider.name,
        isFallbackUsed: target.isFallback,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`【${target.provider.name} · ${target.model}】: ${errMsg}`);

      if (i === queue.length - 1) {
        if (queue.length > 1) {
          throw new Error(
            `全线容灾尝试均失败 (共尝试 ${queue.length} 个服务商模型):\n${errors.join('\n')}`
          );
        }
        throw err;
      }
    }
  }

  throw new Error('未配置任何可用的 AI 服务商模型。');
}
