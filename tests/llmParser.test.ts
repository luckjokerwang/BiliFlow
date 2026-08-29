import { describe, it, expect } from 'vitest';
import { parseLLMSummaryOutput } from '../src/utils/llmParser';

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

  it('throws error when JSON is invalid', () => {
    expect(() => parseLLMSummaryOutput('invalid string without json', meta)).toThrow();
  });
});
