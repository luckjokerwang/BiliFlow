import {
  ProviderConfig,
  VideoSummaryResult,
  BiliRawSubtitleItem,
} from '../types';
import { chunkSubtitles, formatTranscriptForPrompt } from '../utils/transcriptChunker';
import { parseLLMSummaryOutput } from '../utils/llmParser';
import { extractQuotesForHighlight } from '../utils/subtitleUtils';

const SYSTEM_PROMPT = `
你是一个专业的 B 站视频核心内容提炼专家。
请仔细阅读给出的带时间戳视频字幕，提炼出高信息密度的结构化总结。

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
  ]
}

要求：
1. highlights 数量控制在 3 到 6 个最核心的节点。
2. timestamp 必须严格对应字幕里出现的起始时间戳（格式 mm:ss 或 hh:mm:ss）。
3. 语言保持客观、干练、直击要害。
`.trim();

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

    const data = await response.json();
    const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

    const modelIds = rawList
      .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.name))
      .filter((id: any) => typeof id === 'string' && id.trim().length > 0);

    if (modelIds.length === 0) {
      throw new Error('远程接口已连通，但返回的模型列表为空。');
    }

    return Array.from(new Set(modelIds)).sort();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
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
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          if (response.status === 402 || errJson.error.message.toLowerCase().includes('insufficient balance')) {
            friendlyMsg = '账户余额不足 (Insufficient Balance)，请前往服务商充值。';
          } else if (response.status === 401) {
            friendlyMsg = 'API Key 无效 (401 Unauthorized)，请检查 Key 是否填写正确。';
          } else {
            friendlyMsg = `错误: ${errJson.error.message}`;
          }
        }
      } catch (_) {}

      return {
        success: false,
        latencyMs,
        error: friendlyMsg,
      };
    }

    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (err?.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        error: '网络请求超时 (12s)。若测试海外模型 (如 OpenAI/Gemini)，请检查网络代理；若为本地模型 (如 Ollama)，请确认服务已启动。',
      };
    }
    return {
      success: false,
      latencyMs,
      error: err?.message || '网络连接超时或无法访问该地址 (Failed to fetch)',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeSingleChatCompletion(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  userPrompt: string;
  maxRetries?: number;
}): Promise<string> {
  const { endpoint, apiKey, model, userPrompt, maxRetries = 2 } = params;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errMessage = `HTTP ${response.status}: ${errorBody || response.statusText}`;
        let isFatal = false;

        try {
          const errJson = JSON.parse(errorBody);
          if (errJson?.error?.message) {
            errMessage = errJson.error.message;
          }
        } catch (_) {}

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

        const error = new Error(`LLM 报错 (${model}): ${errMessage}`);
        (error as any).status = response.status;
        (error as any).isFatal = isFatal;

        if (isFatal || attempt >= maxRetries || (response.status !== 429 && response.status < 500)) {
          throw error;
        }

        lastError = error;
      } else {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) {
          throw new Error(`模型 ${model} 返回内容为空`);
        }
        return rawContent;
      }
    } catch (err: any) {
      lastError = err;
      if (err?.isFatal || attempt >= maxRetries) {
        throw err;
      }

      // Exponential backoff with jitter: 1s -> 2s (+ 0~200ms jitter)
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 4000);
      console.warn(
        `[BiliFlow LLM] 请求【${model}】失败 (${err?.message || err})，${Math.round(delayMs)}ms 后进行第 ${attempt + 1}/${maxRetries} 次重试...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError || new Error(`模型 ${model} 请求失败`);
}

/**
 * Generate structured video summary with automatic Cross-Provider Fallback failover strategy.
 */
export async function generateVideoSummary(params: {
  bvid: string;
  cid: string;
  title: string;
  subtitles: BiliRawSubtitleItem[];
  provider: ProviderConfig;
  model?: string;
  fallbackProvider?: ProviderConfig;
  fallbackModel?: string;
  enableFallback?: boolean;
}): Promise<VideoSummaryResult> {
  const {
    bvid,
    cid,
    title,
    subtitles,
    provider,
    model,
    fallbackProvider,
    fallbackModel,
    enableFallback = true,
  } = params;

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

  const chunks = chunkSubtitles(validSubtitles, { maxDurationSeconds: 25, maxCharCount: 200 });
  const formattedTranscript = formatTranscriptForPrompt(chunks);

  if (!formattedTranscript || !formattedTranscript.trim()) {
    throw new Error('格式化后的字幕内容为空，无法进行 AI 提炼。');
  }

  const userPrompt = `
【视频标题】：${title}
【视频字幕】：
${formattedTranscript}
`.trim();

  const endpoint = formatBaseUrl(provider.baseUrl, 'chat/completions');
  const primaryModel =
    model || provider.selectedModel || provider.models[0] || 'deepseek-chat';

  // Determine fallback target: can be Cross-Provider OR Same-Provider
  const hasCrossProvider =
    fallbackProvider &&
    fallbackProvider.apiKey &&
    (fallbackProvider.id !== provider.id || Boolean(fallbackModel));

  const targetFallbackProvider = hasCrossProvider ? fallbackProvider : provider;
  const targetFallbackModel =
    fallbackModel ||
    targetFallbackProvider.fallbackModel ||
    (targetFallbackProvider.models.find((m) => m !== primaryModel) || targetFallbackProvider.selectedModel || targetFallbackProvider.models[0]);

  const canFailover =
    enableFallback &&
    targetFallbackProvider &&
    Boolean(targetFallbackProvider.apiKey) &&
    Boolean(targetFallbackModel) &&
    (targetFallbackProvider.id !== provider.id || targetFallbackModel !== primaryModel);

  try {
    const rawContent = await executeSingleChatCompletion({
      endpoint,
      apiKey: provider.apiKey,
      model: primaryModel,
      userPrompt,
    });

    const parsed = parseLLMSummaryOutput(rawContent, { bvid, cid, title });
    const highlightsWithQuotes = parsed.highlights.map((item) => ({
      ...item,
      originalQuotes: extractQuotesForHighlight(item.timestamp, subtitles),
    }));

    return {
      ...parsed,
      highlights: highlightsWithQuotes,
      usedModel: primaryModel,
      usedProviderName: provider.name,
      isFallbackUsed: false,
    };
  } catch (primaryErr: any) {
    // If fallback is enabled and candidate model is available, attempt failover!
    if (canFailover) {
      console.warn(
        `[BiliFlow Failover] 主用【${provider.name} · ${primaryModel}】请求失败 (${primaryErr.message})，正在自动切换至【${targetFallbackProvider.name} · ${targetFallbackModel}】容灾兜底...`
      );
      try {
        const fallbackEndpoint = formatBaseUrl(targetFallbackProvider.baseUrl, 'chat/completions');
        const fallbackContent = await executeSingleChatCompletion({
          endpoint: fallbackEndpoint,
          apiKey: targetFallbackProvider.apiKey,
          model: targetFallbackModel,
          userPrompt,
        });

        const parsed = parseLLMSummaryOutput(fallbackContent, { bvid, cid, title });
        const highlightsWithQuotes = parsed.highlights.map((item) => ({
          ...item,
          originalQuotes: extractQuotesForHighlight(item.timestamp, subtitles),
        }));

        return {
          ...parsed,
          highlights: highlightsWithQuotes,
          usedModel: targetFallbackModel,
          usedProviderName: targetFallbackProvider.name,
          isFallbackUsed: true,
        };
      } catch (fallbackErr: any) {
        throw new Error(
          `主用【${provider.name} · ${primaryModel}】与兜底【${targetFallbackProvider.name} · ${targetFallbackModel}】均请求失败: ${fallbackErr.message}`
        );
      }
    }

    throw primaryErr;
  }
}
