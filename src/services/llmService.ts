import { BiliRawSubtitleItem, LLMConfig, VideoSummaryResult } from '../types';
import { chunkSubtitles, formatTranscriptForPrompt } from '../utils/transcriptChunker';
import { parseLLMSummaryOutput } from '../utils/llmParser';

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

export async function generateVideoSummary(params: {
  bvid: string;
  cid: string;
  title: string;
  subtitles: BiliRawSubtitleItem[];
  config: LLMConfig;
}): Promise<VideoSummaryResult> {
  const { bvid, cid, title, subtitles, config } = params;

  if (!config.apiKey) {
    throw new Error('未配置 API Key，请点击插件图标打开设置面板填入 API Key。');
  }

  // 1. Chunk and format transcript
  const chunks = chunkSubtitles(subtitles, { maxDurationSeconds: 25, maxCharCount: 200 });
  const formattedTranscript = formatTranscriptForPrompt(chunks);

  const userPrompt = `
【视频标题】：${title}
【视频字幕】：
${formattedTranscript}
`.trim();

  // 2. Format base URL
  let endpoint = config.baseUrl.replace(/\/+$/, '');
  if (!endpoint.endsWith('/v1')) {
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = `${endpoint}/chat/completions`;
    }
  } else {
    endpoint = `${endpoint}/chat/completions`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LLM API 请求失败 (HTTP ${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM 返回内容为空');
  }

  return parseLLMSummaryOutput(rawContent, { bvid, cid, title });
}
