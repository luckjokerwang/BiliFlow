import { describe, it, expect } from 'vitest';
import {
  cleanDescription,
  isValidDescription,
} from '../src/entrypoints/content/components/VideoDescriptionCard';

describe('isValidDescription', () => {
  it('returns false for null, undefined, or empty string', () => {
    expect(isValidDescription(null)).toBe(false);
    expect(isValidDescription(undefined)).toBe(false);
    expect(isValidDescription('')).toBe(false);
    expect(isValidDescription('   ')).toBe(false);
  });

  it('returns false for descriptions shorter than or equal to 5 chars', () => {
    expect(isValidDescription('12345')).toBe(false);
    expect(isValidDescription('你好世界')).toBe(false); // 4 chars
  });

  it('returns false for placeholder strings', () => {
    expect(isValidDescription('暂无简介')).toBe(false);
    expect(isValidDescription('无简介')).toBe(false);
    expect(isValidDescription('视频简介')).toBe(false);
    expect(isValidDescription('......')).toBe(false);
    expect(isValidDescription('-------')).toBe(false);
    expect(isValidDescription('  ~~~   ')).toBe(false);
    expect(isValidDescription('null')).toBe(false);
    expect(isValidDescription('undefined')).toBe(false);
  });

  it('returns true for genuine informative descriptions', () => {
    expect(
      isValidDescription('本期视频将深入探讨 Rust 异步运行时底层实现原理与设计权衡。')
    ).toBe(true);
  });
});

describe('cleanDescription', () => {
  it('handles null, undefined or empty strings', () => {
    expect(cleanDescription(null)).toBe('');
    expect(cleanDescription(undefined)).toBe('');
    expect(cleanDescription('')).toBe('');
  });

  it('compresses excessive consecutive newlines to two newlines', () => {
    const raw = '第一行\n\n\n\n\n第二行\r\n\r\n\r\n第三行';
    const cleaned = cleanDescription(raw);
    expect(cleaned).toBe('第一行\n\n第二行\n\n第三行');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanDescription('   hello world \n\n  ')).toBe('hello world');
  });
});

