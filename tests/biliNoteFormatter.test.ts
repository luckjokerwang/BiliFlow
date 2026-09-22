import { describe, it, expect } from 'vitest';
import {
  getTypeLabel,
  escapeHtml,
  formatCardToNoteHtml,
  formatStudyNoteToDelta,
  formatStudyNoteToMarkdown,
} from '../src/utils/biliNoteFormatter';
import { HighlightItem, VideoSummaryResult } from '../src/types';
import { UserAnnotation, VideoStudyNote } from '../src/types/biliNote';

describe('biliNoteFormatter', () => {
  const sampleHighlight: HighlightItem = {
    id: 1,
    timestamp: 125,
    timestampStr: '02:05',
    title: '状态管理反模式',
    keyPoint: '避免将所有临时表单状态无脑塞入全局 Store。',
  };

  const sampleAnnotation: UserAnnotation = {
    id: 'ann_1',
    timestamp: 125,
    timestampStr: '02:05',
    type: 'insight',
    content: '我们在结算页就犯了这个错误，周五重构一下。',
    highlightId: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const sampleSummary: VideoSummaryResult = {
    bvid: 'BV1test12345',
    cid: '99999',
    title: '前端架构实战指南',
    oneSentenceSummary: '系统阐述现代前端架构中的状态分治与性能边界。',
    highlights: [
      sampleHighlight,
      {
        id: 2,
        timestamp: 300,
        timestampStr: '05:00',
        title: '编译期优化',
        keyPoint: '将运行时计算前置到打包构建阶段。',
      },
    ],
    createdAt: 1700000000000,
  };

  describe('getTypeLabel', () => {
    it('should return correct emoji and label for each annotation type', () => {
      expect(getTypeLabel('insight')).toBe('💡 启发');
      expect(getTypeLabel('question')).toBe('❓ 存疑');
      expect(getTypeLabel('action')).toBe('🎯 行动');
      expect(getTypeLabel('keypoint')).toBe('⭐ 重点');
    });
  });

  describe('escapeHtml', () => {
    it('should escape dangerous characters to prevent XSS in HTML output', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#039;s');
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('formatCardToNoteHtml', () => {
    it('should format a highlight card without annotation into clean HTML', () => {
      const html = formatCardToNoteHtml(sampleHighlight);
      expect(html).toContain('<p><strong>[02:05] 状态管理反模式</strong></p>');
      expect(html).toContain('<blockquote>🤖 视频观点：避免将所有临时表单状态无脑塞入全局 Store。</blockquote>');
      expect(html).not.toContain('💬');
      expect(html).toContain('<p><br></p>');
    });

    it('should format a highlight card with user annotation included', () => {
      const html = formatCardToNoteHtml(sampleHighlight, sampleAnnotation);
      expect(html).toContain('<p><strong>[02:05] 状态管理反模式</strong></p>');
      expect(html).toContain('<blockquote>🤖 视频观点：避免将所有临时表单状态无脑塞入全局 Store。</blockquote>');
      expect(html).toContain('<p>💬 <strong>💡 启发</strong>：我们在结算页就犯了这个错误，周五重构一下。</p>');
    });

    it('should escape malicious input inside titles or user thoughts', () => {
      const maliciousHighlight: HighlightItem = {
        id: 99,
        timestamp: 0,
        timestampStr: '00:00',
        title: '<img src=x onerror=alert(1)>',
        keyPoint: '<b>test</b>',
      };
      const maliciousAnnotation: UserAnnotation = {
        id: 'ann_evil',
        timestamp: 0,
        timestampStr: '00:00',
        type: 'question',
        content: '<script>evil()</script>',
        createdAt: 0,
        updatedAt: 0,
      };

      const html = formatCardToNoteHtml(maliciousHighlight, maliciousAnnotation);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    });
  });

  describe('formatStudyNoteToDelta', () => {
    it('should generate valid Quill Delta operations for complete study note', () => {
      const studyNote: VideoStudyNote = {
        bvid: 'BV1test12345',
        cid: '99999',
        title: '前端架构实战指南',
        summary: sampleSummary,
        annotations: [
          sampleAnnotation,
          {
            id: 'ann_standalone',
            timestamp: 450,
            timestampStr: '07:30',
            type: 'action',
            content: '查阅相关 RFC 提案',
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
      };

      const delta = formatStudyNoteToDelta(studyNote);
      expect(Array.isArray(delta)).toBe(true);

      // Verify title header
      const titleOp = delta.find(
        (op) => typeof op.insert === 'string' && op.insert.includes('前端架构实战指南')
      );
      expect(titleOp).toBeDefined();
      expect(titleOp?.attributes?.header).toBe(2);

      // Verify one-sentence summary
      const coreOp = delta.find(
        (op) => typeof op.insert === 'string' && op.insert.includes('全片核心')
      );
      expect(coreOp).toBeDefined();

      // Verify bound annotation
      const boundOp = delta.find(
        (op) => typeof op.insert === 'string' && op.insert.includes('我们在结算页就犯了这个错误')
      );
      expect(boundOp).toBeDefined();

      // Verify unbound annotation section
      const unboundHeader = delta.find(
        (op) => typeof op.insert === 'string' && op.insert.includes('随看随记感悟')
      );
      expect(unboundHeader).toBeDefined();

      const unboundOp = delta.find(
        (op) => typeof op.insert === 'string' && op.insert.includes('查阅相关 RFC 提案')
      );
      expect(unboundOp).toBeDefined();
    });
  });

  describe('formatStudyNoteToMarkdown', () => {
    it('should format study note into dual-track markdown', () => {
      const studyNote: VideoStudyNote = {
        bvid: 'BV1test12345',
        cid: '99999',
        title: '前端架构实战指南',
        summary: sampleSummary,
        annotations: [sampleAnnotation],
      };

      const md = formatStudyNoteToMarkdown(studyNote);
      expect(md).toContain('# ⚡ 《前端架构实战指南》AI 精读与学习笔记');
      expect(md).toContain('> **全片核心**：系统阐述现代前端架构中的状态分治与性能边界。');
      expect(md).toContain('### 1. [02:05] 状态管理反模式');
      expect(md).toContain('> 🤖 **视频观点**：避免将所有临时表单状态无脑塞入全局 Store。');
      expect(md).toContain('💬 **我的感悟**：');
      expect(md).toContain('- **💡 启发**：我们在结算页就犯了这个错误，周五重构一下。');
      expect(md).toContain('*由 BiliFlow (极速心流) 协同记录*');
    });
  });
});
