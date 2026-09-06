import { describe, it, expect } from 'vitest';
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

