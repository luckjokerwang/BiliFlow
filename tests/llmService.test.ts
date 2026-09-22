import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBaseUrl, generateVideoSummary } from '../src/services/llmService';

describe('formatBaseUrl', () => {
  it('formats standard openai base urls correctly', () => {
    expect(formatBaseUrl('https://api.openai.com', 'chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(formatBaseUrl('https://api.openai.com/v1', 'chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(formatBaseUrl('https://api.openai.com/v1/', '/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('handles custom v4 and openai suffix endpoints', () => {
    expect(
      formatBaseUrl('https://open.bigmodel.cn/api/paas/v4', 'chat/completions')
    ).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');

    expect(
      formatBaseUrl(
        'https://generativelanguage.googleapis.com/v1beta/openai',
        'chat/completions'
      )
    ).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    );
  });

  it('handles localhost ollama urls', () => {
    expect(formatBaseUrl('http://localhost:11434/v1', 'models')).toBe(
      'http://localhost:11434/v1/models'
    );
  });

  it('throws error on missing protocol', () => {
    expect(() => formatBaseUrl('api.openai.com', 'chat/completions')).toThrow(
      /必须以 https:\/\/ 或 http:\/\/ 开头/
    );
  });
});

describe('generateVideoSummary validation', () => {
  it('rejects empty subtitles array to prevent LLM hallucination', async () => {
    await expect(
      generateVideoSummary({
        bvid: 'BV1Aztx6SE8N',
        cid: '12345',
        title: '测试视频',
        subtitles: [],
        provider: {
          id: 'test',
          name: 'Test Provider',
          baseUrl: 'https://api.test.com/v1',
          apiKey: 'test-key',
          enabled: true,
          models: ['test-model'],
          remoteModels: [],
          selectedModel: 'test-model',
          fallbackModel: '',
          docUrl: '',
          icon: '⚡',
        },
      })
    ).rejects.toThrow('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
  });

  it('rejects subtitles array containing only blank strings', async () => {
    await expect(
      generateVideoSummary({
        bvid: 'BV1Aztx6SE8N',
        cid: '12345',
        title: '测试视频',
        subtitles: [
          { from: 0, to: 5, content: '   ' },
          { from: 6, to: 10, content: '\n\t' },
        ],
        provider: {
          id: 'test',
          name: 'Test Provider',
          baseUrl: 'https://api.test.com/v1',
          apiKey: 'test-key',
          enabled: true,
          models: ['test-model'],
          remoteModels: [],
          selectedModel: 'test-model',
          fallbackModel: '',
          docUrl: '',
          icon: '⚡',
        },
      })
    ).rejects.toThrow('该视频未包含任何有效字幕文本，无法提炼要点。');
  });
});

describe('Cross-Provider Fallback & Resilience', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const validSubtitles = [
    { from: 0, to: 10, content: '大家好，欢迎来到本期视频。' },
    { from: 11, to: 30, content: '今天我们来讲解跨厂商容灾架构设计。' },
  ];

  const primaryProvider = {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-deepseek',
    enabled: true,
    models: ['deepseek-chat'],
    selectedModel: 'deepseek-chat',
    fallbackProviderId: 'siliconflow',
    fallbackModel: 'deepseek-ai/DeepSeek-V3',
  };

  const fallbackProvider = {
    id: 'siliconflow',
    name: 'SiliconFlow 硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: 'sk-siliconflow',
    enabled: true,
    models: ['deepseek-ai/DeepSeek-V3'],
    selectedModel: 'deepseek-ai/DeepSeek-V3',
  };

  it('successfully fails over to cross-provider when primary provider encounters 402 Insufficient Balance', async () => {
    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              oneSentenceSummary: '跨厂商容灾架构讲解。',
              highlights: [
                { timestamp: '00:11', title: '容灾设计', keyPoint: '主备自动切换' },
              ],
            }),
          },
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.deepseek.com')) {
        // DeepSeek fails with 402 balance exhausted
        return Promise.resolve({
          ok: false,
          status: 402,
          statusText: 'Payment Required',
          text: () => Promise.resolve(JSON.stringify({ error: { message: 'Insufficient balance' } })),
        });
      }
      if (url.includes('api.siliconflow.cn')) {
        // SiliconFlow succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSuccessResponse),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const result = await generateVideoSummary({
      bvid: 'BV1test',
      cid: '12345',
      title: '高可用测试',
      subtitles: validSubtitles,
      provider: primaryProvider,
      fallbackProvider: fallbackProvider,
      fallbackModel: 'deepseek-ai/DeepSeek-V3',
      enableFallback: true,
    });

    expect(result.isFallbackUsed).toBe(true);
    expect(result.usedModel).toBe('deepseek-ai/DeepSeek-V3');
    expect(result.usedProviderName).toBe('SiliconFlow 硅基流动');
    expect(result.highlights.length).toBe(1);
    expect(result.highlights[0].title).toBe('容灾设计');
  });

  it('retries on 429 transient rate limit and succeeds without failover', async () => {
    let callCount = 0;
    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              oneSentenceSummary: '重试成功总结。',
              highlights: [
                { timestamp: '00:05', title: '要点一', keyPoint: '内容说明' },
              ],
            }),
          },
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First attempt 429 rate limit
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: () => Promise.resolve('Rate limit exceeded'),
        });
      }
      // Second attempt succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });
    });

    const result = await generateVideoSummary({
      bvid: 'BV1test',
      cid: '12345',
      title: '重试测试',
      subtitles: validSubtitles,
      provider: primaryProvider,
      enableFallback: true,
    });

    expect(callCount).toBe(2);
    expect(result.isFallbackUsed).toBe(false);
    expect(result.usedModel).toBe('deepseek-chat');
    expect(result.usedProviderName).toBe('DeepSeek 官方');
  });
});
