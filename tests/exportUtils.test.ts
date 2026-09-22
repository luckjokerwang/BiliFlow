import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatSummaryAsMarkdown,
  formatSummaryForComment,
  copyTextToClipboard,
} from '../src/utils/exportUtils';
import { VideoSummaryResult } from '../src/types';

describe('exportUtils', () => {
  const sampleSummary: VideoSummaryResult = {
    bvid: 'BV1xx411c7mD',
    cid: '12345',
    title: '深入理解 TypeScript 类型系统',
    oneSentenceSummary: '系统讲解 TypeScript 高级类型与泛型设计模式。',
    highlights: [
      { id: 1, timestamp: 65, timestampStr: '01:05', title: '类型体操基础', keyPoint: '条件类型的推断原理。' },
      { id: 2, timestamp: 245, timestampStr: '04:05', title: '分布式条件类型', keyPoint: '联合类型触发分发的条件与修饰符。' },
    ],
    createdAt: 1600000000000,
  };

  describe('formatSummaryAsMarkdown', () => {
    it('should format a complete summary into structured markdown', () => {
      const md = formatSummaryAsMarkdown(sampleSummary);
      expect(md).toContain('### ⚡ 《深入理解 TypeScript 类型系统》AI 核心要点提炼');
      expect(md).toContain('> **全片核心**：系统讲解 TypeScript 高级类型与泛型设计模式。');
      expect(md).toContain('1. **[01:05] 类型体操基础**');
      expect(md).toContain('   条件类型的推断原理。');
      expect(md).toContain('2. **[04:05] 分布式条件类型**');
      expect(md).toContain('*由 BiliFlow (极速心流) 智能提炼*');
    });

    it('should handle summary without title gracefully', () => {
      const withoutTitle = { ...sampleSummary, title: '' };
      const md = formatSummaryAsMarkdown(withoutTitle);
      expect(md).toContain('### ⚡ AI 核心要点提炼');
    });

    it('should return empty string on null or undefined input', () => {
      expect(formatSummaryAsMarkdown(null as any)).toBe('');
      expect(formatSummaryAsMarkdown(undefined as any)).toBe('');
    });
  });

  describe('formatSummaryForComment', () => {
    it('should format a summary into Bilibili comment-friendly text with timestamps', () => {
      const comment = formatSummaryForComment(sampleSummary);
      expect(comment).toContain('【⚡ BiliFlow AI 视频亮点直达】');
      expect(comment).toContain('全片核心：系统讲解 TypeScript 高级类型与泛型设计模式。');
      expect(comment).toContain('1. 01:05 类型体操基础 - 条件类型的推断原理。');
      expect(comment).toContain('2. 04:05 分布式条件类型 - 联合类型触发分发的条件与修饰符。');
      expect(comment).toContain('(由 BiliFlow 极速心流生成)');
    });

    it('should return empty string on null or undefined input', () => {
      expect(formatSummaryForComment(null as any)).toBe('');
      expect(formatSummaryForComment(undefined as any)).toBe('');
    });
  });

  describe('copyTextToClipboard', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should call navigator.clipboard.writeText if available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const res = await copyTextToClipboard('test content');
      expect(res).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('test content');
    });

    it('should return false for empty string', async () => {
      const res = await copyTextToClipboard('');
      expect(res).toBe(false);
    });
  });
});
