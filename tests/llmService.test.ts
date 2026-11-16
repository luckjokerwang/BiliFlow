import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBaseUrl, generateVideoSummary } from '../src/services/llmService';
import { ProviderConfig } from '../src/types';

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

  it('cascades sequentially across 3 providers when primary and secondary both fail', async () => {
    const primaryProvider: ProviderConfig = {
      id: 'deepseek',
      name: 'DeepSeek 官方',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-deepseek',
      enabled: true,
      models: ['deepseek-chat'],
      selectedModel: 'deepseek-chat',
    };

    const secondProvider: ProviderConfig = {
      id: 'siliconflow',
      name: 'SiliconFlow 硅基流动',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'sk-silicon',
      enabled: true,
      models: ['deepseek-ai/DeepSeek-V3'],
      selectedModel: 'deepseek-ai/DeepSeek-V3',
    };

    const thirdProvider: ProviderConfig = {
      id: 'zhipu',
      name: '智谱清言',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: 'sk-zhipu',
      enabled: true,
      models: ['glm-4-flash'],
      selectedModel: 'glm-4-flash',
    };

    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              oneSentenceSummary: '三级瀑布容灾成功。',
              highlights: [
                { timestamp: '00:10', title: '智谱兜底成功', keyPoint: '全厂商容灾' },
              ],
            }),
          },
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.deepseek.com')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: () => Promise.resolve('DeepSeek 503 Overloaded'),
        });
      }
      if (url.includes('api.siliconflow.cn')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: () => Promise.resolve('SiliconFlow Rate Limit'),
        });
      }
      if (url.includes('open.bigmodel.cn')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSuccessResponse),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const result = await generateVideoSummary({
      bvid: 'BV1cascade',
      cid: '99999',
      title: '多级容灾测试',
      subtitles: validSubtitles,
      provider: primaryProvider,
      fallbackProvider: secondProvider,
      candidateProviders: [secondProvider, thirdProvider],
      enableFallback: true,
    });

    expect(result.isFallbackUsed).toBe(true);
    expect(result.usedProviderName).toBe('智谱清言');
    expect(result.usedModel).toBe('glm-4-flash');
    expect(result.highlights[0].title).toBe('智谱兜底成功');
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

describe('preflight prompt assembly', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const provider: ProviderConfig = {
    id: 'prompt-test',
    name: 'Prompt Test',
    baseUrl: 'https://api.prompt.test/v1',
    apiKey: 'key',
    enabled: true,
    models: ['prompt-model'],
    selectedModel: 'prompt-model',
  };
  const subtitles = [
    { from: 0, to: 10, content: '开场内容' },
    { from: 30, to: 40, content: '高能内容' },
  ];

  it('injects official chapters, description points and heatmap peaks', async () => {
    const capturedPrompts: string[] = [];
    const llmResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  oneSentenceSummary: '带锚点的总结。',
                  highlights: [
                    { timestamp: '00:00', title: '开场', keyPoint: '开场内容' },
                  ],
                }),
              },
            },
          ],
        }),
      text: () => Promise.resolve(''),
    } as unknown as Response;

    global.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      capturedPrompts.push(
        body.messages?.find((message) => message.role === 'user')?.content || ''
      );
      return Promise.resolve(llmResponse);
    }) as unknown as typeof fetch;

    const result = await generateVideoSummary({
      bvid: 'BV1Prompt',
      cid: '1',
      title: '锚点测试',
      subtitles,
      durationSec: 120,
      preflight: {
        officialChapters: [{ from: 0, to: 60, title: '官方开场' }],
        descriptionTimestamps: [{ seconds: 30, title: '简介锚点' }],
        danmakuHeatmapPeaks: [{ timestampSec: 45, densityRatio: 0.75 }],
      },
      provider,
      enableFallback: false,
    });

    expect(result.oneSentenceSummary).toBe('带锚点的总结。');
    expect(capturedPrompts).toHaveLength(1);
    expect(capturedPrompts[0]).toContain('【UP 主官方章节】');
    expect(capturedPrompts[0]).toContain('[00:00 ~ 01:00] 官方开场');
    expect(capturedPrompts[0]).toContain('【简介时间戳】');
    expect(capturedPrompts[0]).toContain('[00:30] 简介锚点');
    expect(capturedPrompts[0]).toContain('【弹幕高能时间点】');
    expect(capturedPrompts[0]).toContain('[00:45] 密度 0.750');
  });

  it('does not inject empty preflight blocks', async () => {
    let capturedPrompt = '';
    const llmResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  oneSentenceSummary: '纯字幕总结。',
                  highlights: [
                    { timestamp: '00:00', title: '开场', keyPoint: '开场内容' },
                  ],
                }),
              },
            },
          ],
        }),
      text: () => Promise.resolve(''),
    } as unknown as Response;

    global.fetch = vi.fn((_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      capturedPrompt =
        body.messages?.find((message) => message.role === 'user')?.content || '';
      return Promise.resolve(llmResponse);
    }) as unknown as typeof fetch;

    await generateVideoSummary({
      bvid: 'BV1PromptEmpty',
      cid: '2',
      title: '空锚点测试',
      subtitles,
      preflight: {},
      provider,
      enableFallback: false,
    });

    expect(capturedPrompt).not.toContain('【UP 主官方章节】');
    expect(capturedPrompt).not.toContain('【简介时间戳】');
    expect(capturedPrompt).not.toContain('【弹幕高能时间点】');
    expect(capturedPrompt).toContain('【视频字幕】');
  });
});

describe('punchline quote source verification', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('drops forged quotes, corrects timestamps and chooses the nearest duplicate source', async () => {
    const provider: ProviderConfig = {
      id: 'quote-test',
      name: 'Quote Test',
      baseUrl: 'https://api.quote.test/v1',
      apiKey: 'key',
      enabled: true,
      models: ['quote-model'],
      selectedModel: 'quote-model',
    };
    const subtitles = [
      { from: 0, to: 5, content: '开场唯一金句' },
      { from: 10, to: 15, content: '高能原文' },
      { from: 100, to: 105, content: '高能原文' },
    ];
    const llmResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  oneSentenceSummary: '含金句的总结。',
                  highlights: [
                    { timestamp: '00:00', title: '开场', keyPoint: '开场内容' },
                  ],
                  glossary: [
                    { term: 'Token', definition: '模型处理文本的基本单位' },
                  ],
                  actionableTakeaways: ['打开设置配置 Key'],
                  punchlineQuotes: [
                    { timestamp: '01:40', content: '高能原文' },
                    { timestamp: '16:39', content: '开场唯一金句' },
                    { timestamp: '00:30', content: '模型伪造文本' },
                  ],
                }),
              },
            },
          ],
        }),
      text: () => Promise.resolve(''),
    } as unknown as Response;

    global.fetch = vi.fn(() => Promise.resolve(llmResponse)) as unknown as typeof fetch;

    const result = await generateVideoSummary({
      bvid: 'BV1Quote',
      cid: '3',
      title: '金句校验',
      subtitles,
      provider,
      enableFallback: false,
    });

    expect(result.schemaVersion).toBe(2);
    expect(result.glossary).toEqual([
      { term: 'Token', definition: '模型处理文本的基本单位' },
    ]);
    expect(result.actionableTakeaways).toEqual(['打开设置配置 Key']);
    expect(result.punchlineQuotes).toEqual([
      { timestamp: 100, timestampStr: '01:40', content: '高能原文' },
      { timestamp: 0, timestampStr: '00:00', content: '开场唯一金句' },
    ]);
  });
});

describe('hierarchical Map-Reduce summary pipeline', () => {
  const originalFetch = global.fetch;
  const longSubtitles = [
    { from: 0, to: 5, content: '开场局部事实' },
    { from: 600, to: 605, content: '中段局部事实' },
    { from: 1200, to: 1205, content: '结尾局部事实' },
  ];
  const finalContent = JSON.stringify({
    oneSentenceSummary: '覆盖全片的总结。',
    highlights: [
      { timestamp: '20:00', title: '结尾', keyPoint: '结尾局部事实' },
    ],
    glossary: [{ term: 'LRU', definition: '最近最少使用缓存策略' }],
    actionableTakeaways: ['打开设置配置缓存上限'],
    punchlineQuotes: [
      { timestamp: '20:00', content: '结尾局部事实' },
    ],
  });

  interface RequestLog {
    url: string;
    systemPrompt: string;
    userPrompt: string;
  }

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeResponse(content: string, status = 200): Response {
    const ok = status >= 200 && status < 300;
    const body = ok
      ? { choices: [{ message: { content } }] }
      : { error: { message: 'Unauthorized' } };
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Unauthorized',
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response;
  }

  function parseRequest(init?: RequestInit): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const body = JSON.parse(String(init?.body)) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    return {
      systemPrompt:
        body.messages?.find((message) => message.role === 'system')?.content || '',
      userPrompt:
        body.messages?.find((message) => message.role === 'user')?.content || '',
    };
  }

  function mapContent(index: number, label = '窗口'): string {
    const sources = ['开场局部事实', '中段局部事实', '结尾局部事实'];
    const timestamps = ['00:00', '10:00', '20:00'];
    const source = sources[index - 1];
    return JSON.stringify({
      summary: `${label}${index}局部摘要`,
      keyPoints: [{ timestamp: timestamps[index - 1], text: source }],
      punchlineQuotes: [
        { timestamp: timestamps[index - 1], content: source },
        { timestamp: timestamps[index - 1], content: '伪造逐字候选' },
      ],
    });
  }

  const primaryProvider: ProviderConfig = {
    id: 'primary-map',
    name: 'Primary Map',
    baseUrl: 'https://primary.test/v1',
    apiKey: 'key',
    enabled: true,
    models: ['primary-model'],
    selectedModel: 'primary-model',
  };
  const fallbackProvider: ProviderConfig = {
    id: 'fallback-map',
    name: 'Fallback Map',
    baseUrl: 'https://fallback.test/v1',
    apiKey: 'key',
    enabled: true,
    models: ['fallback-model'],
    selectedModel: 'fallback-model',
  };

  it('runs three maps and one reduce with verified quote candidates and global anchors', async () => {
    const logs: RequestLog[] = [];
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      const parsed = parseRequest(init);
      logs.push({ url: String(url), ...parsed });
      if (parsed.systemPrompt.includes('Map 阶段')) {
        const mapIndex = logs.filter((log) =>
          log.systemPrompt.includes('Map 阶段')
        ).length;
        return Promise.resolve(makeResponse(mapContent(mapIndex)));
      }
      return Promise.resolve(makeResponse(finalContent));
    }) as unknown as typeof fetch;

    const result = await generateVideoSummary({
      bvid: 'BV1MapReduce',
      cid: '1',
      title: '长视频测试',
      subtitles: longSubtitles,
      durationSec: 1201,
      preflight: {
        officialChapters: [{ from: 0, to: 1200, title: '官方全片' }],
        descriptionTimestamps: [{ seconds: 600, title: '中段锚点' }],
        danmakuHeatmapPeaks: [{ timestampSec: 1200, densityRatio: 0.9 }],
      },
      provider: primaryProvider,
      enableFallback: false,
    });

    expect(logs).toHaveLength(4);
    expect(logs.slice(0, 3).every((log) => log.systemPrompt.includes('Map 阶段'))).toBe(true);
    expect(logs[3].systemPrompt).toContain('核心内容提炼专家');
    expect(logs[3].userPrompt).toContain('【UP 主官方章节】');
    expect(logs[3].userPrompt).toContain('【逐字金句候选】');
    expect(logs[3].userPrompt).toContain('窗口1局部摘要');
    expect(logs[3].userPrompt).toContain('窗口2局部摘要');
    expect(logs[3].userPrompt).toContain('窗口3局部摘要');
    expect(logs[3].userPrompt).toContain('结尾局部事实');
    expect(logs[3].userPrompt).not.toContain('伪造逐字候选');
    expect(result.schemaVersion).toBe(2);
    expect(result.glossary).toEqual([
      { term: 'LRU', definition: '最近最少使用缓存策略' },
    ]);
    expect(result.punchlineQuotes).toEqual([
      { timestamp: 1200, timestampStr: '20:00', content: '结尾局部事实' },
    ]);
  });

  it('uses one request at exactly 1200s and still map-reduces when duration is missing', async () => {
    const logs: RequestLog[] = [];
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      const parsed = parseRequest(init);
      logs.push({ url: String(url), ...parsed });
      if (parsed.systemPrompt.includes('Map 阶段')) {
        const mapIndex = logs.filter((log) =>
          log.systemPrompt.includes('Map 阶段')
        ).length;
        return Promise.resolve(makeResponse(mapContent(mapIndex)));
      }
      return Promise.resolve(makeResponse(finalContent));
    }) as unknown as typeof fetch;

    await generateVideoSummary({
      bvid: 'BV1Boundary',
      cid: '2',
      title: '边界测试',
      subtitles: [{ from: 0, to: 100, content: '短视频字幕' }],
      durationSec: 1200,
      provider: primaryProvider,
      enableFallback: false,
    });
    expect(logs).toHaveLength(1);

    logs.length = 0;
    await generateVideoSummary({
      bvid: 'BV1NoDuration',
      cid: '3',
      title: '无时长元数据测试',
      subtitles: longSubtitles,
      durationSec: 0,
      provider: primaryProvider,
      enableFallback: false,
    });
    expect(logs).toHaveLength(4);
    expect(logs.slice(0, 3).every((log) => log.systemPrompt.includes('Map 阶段'))).toBe(true);
  });

  it('does not reduce empty maps and restarts the whole pipeline on fallback', async () => {
    const logs: RequestLog[] = [];
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      const parsed = parseRequest(init);
      logs.push({ url: String(url), ...parsed });
      const isPrimary = String(url).includes('primary.test');
      if (parsed.systemPrompt.includes('Map 阶段')) {
        if (isPrimary) {
          return Promise.resolve(
            makeResponse(
              JSON.stringify({ summary: '', keyPoints: [], punchlineQuotes: [] })
            )
          );
        }
        const fallbackMapCount = logs.filter(
          (log) =>
            log.url.includes('fallback.test') &&
            log.systemPrompt.includes('Map 阶段')
        ).length;
        return Promise.resolve(
          makeResponse(mapContent(fallbackMapCount, '备用窗口'))
        );
      }
      return Promise.resolve(makeResponse(finalContent));
    }) as unknown as typeof fetch;

    const result = await generateVideoSummary({
      bvid: 'BV1EmptyMaps',
      cid: '4',
      title: '空 Map 回退',
      subtitles: longSubtitles,
      durationSec: 1201,
      provider: primaryProvider,
      fallbackProvider,
      enableFallback: true,
    });

    expect(logs).toHaveLength(7);
    expect(
      logs.filter(
        (log) =>
          log.url.includes('primary.test') &&
          log.systemPrompt.includes('核心内容提炼专家')
      )
    ).toHaveLength(0);
    expect(result.isFallbackUsed).toBe(true);
    expect(result.usedProviderName).toBe('Fallback Map');
  });

  it('reruns all maps after a primary map 401 without mixing primary partial results', async () => {
    const logs: RequestLog[] = [];
    global.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      const parsed = parseRequest(init);
      logs.push({ url: String(url), ...parsed });
      const isPrimary = String(url).includes('primary.test');
      if (parsed.systemPrompt.includes('Map 阶段')) {
        if (isPrimary) {
          const primaryMapCount = logs.filter(
            (log) =>
              log.url.includes('primary.test') &&
              log.systemPrompt.includes('Map 阶段')
          ).length;
          if (primaryMapCount === 2) {
            return Promise.resolve(makeResponse('', 401));
          }
          return Promise.resolve(
            makeResponse(mapContent(1, '主用废弃'))
          );
        }
        const fallbackMapCount = logs.filter(
          (log) =>
            log.url.includes('fallback.test') &&
            log.systemPrompt.includes('Map 阶段')
        ).length;
        return Promise.resolve(
          makeResponse(mapContent(fallbackMapCount, '备用窗口'))
        );
      }
      return Promise.resolve(makeResponse(finalContent));
    }) as unknown as typeof fetch;

    const result = await generateVideoSummary({
      bvid: 'BV1Map401',
      cid: '5',
      title: 'Map 401 回退',
      subtitles: longSubtitles,
      durationSec: 1201,
      provider: primaryProvider,
      fallbackProvider,
      enableFallback: true,
    });

    expect(logs).toHaveLength(6);
    const reducePrompt = logs.at(-1)?.userPrompt || '';
    expect(reducePrompt).not.toContain('主用废弃');
    expect(reducePrompt).toContain('备用窗口1局部摘要');
    expect(reducePrompt).toContain('备用窗口3局部摘要');
    expect(result.isFallbackUsed).toBe(true);
    expect(result.usedModel).toBe('fallback-model');
  });
});
