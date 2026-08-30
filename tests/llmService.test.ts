import { describe, it, expect } from 'vitest';
import { formatBaseUrl } from '../src/services/llmService';

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
