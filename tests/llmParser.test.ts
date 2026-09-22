import { describe, it, expect } from 'vitest';
import {
  parseLLMSummaryOutput,
  cleanRawLLMText,
  repairTruncatedJson,
} from '../src/utils/llmParser';

describe('llmParser', () => {
  const meta = {
    bvid: 'BV1xx411c7mD',
    cid: '12345678',
    title: '测试科技视频',
  };

  it('parses valid JSON response cleanly', () => {
    const raw = JSON.stringify({
      oneSentenceSummary: '本视频展示了三项前沿科技发明。',
      highlights: [
        {
          timestamp: '00:22',
          title: '变形自行车',
          keyPoint: '轮子可自适应不同地形。',
        },
        {
          timestamp: '03:26',
          title: '汽车升降机',
          keyPoint: '支持现场快速更换零件。',
        },
      ],
      followUpQuestions: ['变形自行车的量产成本如何？'],
    });

    const result = parseLLMSummaryOutput(raw, meta);
    expect(result.bvid).toBe('BV1xx411c7mD');
    expect(result.oneSentenceSummary).toBe('本视频展示了三项前沿科技发明。');
    expect(result.highlights.length).toBe(2);
    expect(result.highlights[0].id).toBe(1);
    expect(result.highlights[0].timestamp).toBe(22);
    expect(result.highlights[0].timestampStr).toBe('00:22');
    expect(result.highlights[1].id).toBe(2);
    expect(result.highlights[1].timestamp).toBe(206);
    expect(result.highlights[1].timestampStr).toBe('03:26');
  });

  it('extracts JSON when wrapped in markdown code blocks', () => {
    const raw = `
这里是视频的总结内容：
\`\`\`json
{
  "oneSentenceSummary": "智能设备与自动化探索。",
  "highlights": [
    {
      "timestamp": "01:15",
      "title": "自供电屏幕",
      "keyPoint": "依靠环境光线实现不间断供电。"
    }
  ]
}
\`\`\`
希望对您有帮助！
    `;

    const result = parseLLMSummaryOutput(raw, meta);
    expect(result.oneSentenceSummary).toBe('智能设备与自动化探索。');
    expect(result.highlights.length).toBe(1);
    expect(result.highlights[0].timestamp).toBe(75);
    expect(result.highlights[0].title).toBe('自供电屏幕');
  });

  it('filters out <think> tags from reasoning models (e.g. DeepSeek-R1)', () => {
    const rawWithThink = `
<think>
用户想要一份结构化的视频亮点总结。
我需要先仔细阅读视频字幕，发现以下关键点：
1. 01:25 介绍了新电池材料
2. 04:30 讨论了能源转换效率
现在生成最终的 JSON 输出。
</think>
\`\`\`json
{
  "oneSentenceSummary": "新型石墨烯电池技术突破。",
  "highlights": [
    {
      "timestamp": "01:25",
      "title": "石墨烯电池结构",
      "keyPoint": "采用多层纳米孔径设计提升能量密度。"
    }
  ]
}
\`\`\`
`;

    const result = parseLLMSummaryOutput(rawWithThink, meta);
    expect(result.oneSentenceSummary).toBe('新型石墨烯电池技术突破。');
    expect(result.highlights.length).toBe(1);
    expect(result.highlights[0].title).toBe('石墨烯电池结构');
  });

  it('handles unclosed <think> tag when output was truncated mid-thought', () => {
    const rawTruncatedThink = `
<think>
正在思考视频内容...
`;
    expect(() => parseLLMSummaryOutput(rawTruncatedThink, meta)).toThrow();
  });

  it('automatically repairs truncated JSON missing closing brackets', () => {
    // Truncated JSON missing "]" and "}"
    const truncated = `
{
  "oneSentenceSummary": "长视频要点分析。",
  "highlights": [
    {
      "timestamp": "02:10",
      "title": "起点分析",
      "keyPoint": "分析了初始条件。"
    },
    {
      "timestamp": "05:40",
      "title": "核心突破",
      "keyPoint": "技术指标提升 30%"
`;

    const result = parseLLMSummaryOutput(truncated, meta);
    expect(result.oneSentenceSummary).toBe('长视频要点分析。');
    expect(result.highlights.length).toBe(2);
    expect(result.highlights[0].timestamp).toBe(130);
    expect(result.highlights[1].timestamp).toBe(340);
    expect(result.highlights[1].title).toBe('核心突破');
  });

  it('automatically repairs truncated JSON cut off inside a string literal', () => {
    const cutOffInString = `
{
  "oneSentenceSummary": "视频要点总结。",
  "highlights": [
    {
      "timestamp": "01:00",
      "title": "第一部
`;

    const repaired = repairTruncatedJson(cutOffInString);
    const parsed = JSON.parse(repaired);
    expect(parsed.oneSentenceSummary).toBe('视频要点总结。');
    expect(Array.isArray(parsed.highlights)).toBe(true);
  });

  it('throws error when JSON is invalid and irreparable', () => {
    expect(() => parseLLMSummaryOutput('invalid string without json', meta)).toThrow();
  });
});
