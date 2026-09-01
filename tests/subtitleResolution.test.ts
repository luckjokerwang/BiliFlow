import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBilibiliSubtitles } from '../src/services/bilibiliApi';
import {
  getSubtitlePriorityScore,
  selectPreferredSubtitleTrack,
  fuseSubtitles,
  extractQuotesForHighlight,
} from '../src/utils/subtitleUtils';

describe('Subtitle Waterfall & Utilities', () => {
  describe('getSubtitlePriorityScore & selectPreferredSubtitleTrack', () => {
    it('prioritizes UP manual Chinese subtitles over AI generated subtitles', () => {
      const tracks = [
        { lan: 'ai-en', lan_doc: '英语（自动翻译）', type: 1, subtitle_url: 'http://en.json' },
        { lan: 'ai-zh', lan_doc: '中文（自动生成）', type: 1, subtitle_url: 'http://ai-zh.json' },
        { lan: 'zh-CN', lan_doc: '中文（UP主上传）', type: 0, subtitle_url: 'http://manual-zh.json' },
      ];

      expect(getSubtitlePriorityScore(tracks[2])).toBe(100);
      expect(getSubtitlePriorityScore(tracks[1])).toBe(80);
      expect(getSubtitlePriorityScore(tracks[0])).toBe(40);

      const best = selectPreferredSubtitleTrack(tracks);
      expect(best.lan).toBe('zh-CN');
      expect(best.subtitle_url).toBe('http://manual-zh.json');
    });

    it('falls back to AI Chinese subtitle when manual subtitles are absent', () => {
      const tracks = [
        { lan: 'ai-en', lan_doc: '英语（自动翻译）', type: 1, subtitle_url: 'http://en.json' },
        { lan: 'ai-zh', lan_doc: '中文（自动生成）', type: 1, subtitle_url: 'http://ai-zh.json' },
        { lan: 'ai-ja', lan_doc: '日文（自动翻译）', type: 1, subtitle_url: 'http://ja.json' },
      ];

      const best = selectPreferredSubtitleTrack(tracks);
      expect(best.lan).toBe('ai-zh');
      expect(best.subtitle_url).toBe('http://ai-zh.json');
    });
  });

  describe('fuseSubtitles', () => {
    it('merges fragmented subtitle chunks into a single natural sentence', () => {
      const raw = [
        { from: 0.0, to: 0.5, content: '朋友们' },
        { from: 0.5, to: 3.2, content: '今年日元又崩了' },
        { from: 3.3, to: 5.1, content: '怎么回事儿呢？' },
        { from: 8.0, to: 10.5, content: '这是第二句长停顿后开始的话' },
      ];

      const fused = fuseSubtitles(raw);
      expect(fused).toHaveLength(2);
      expect(fused[0].from).toBe(0.0);
      expect(fused[0].to).toBe(5.1);
      expect(fused[0].content).toBe('朋友们今年日元又崩了怎么回事儿呢？');

      expect(fused[1].from).toBe(8.0);
      expect(fused[1].to).toBe(10.5);
      expect(fused[1].content).toBe('这是第二句长停顿后开始的话');
    });
  });

  describe('extractQuotesForHighlight', () => {
    it('extracts relevant original subtitle quotes around the highlight timestamp', () => {
      const subs = [
        { from: 10.0, to: 15.0, content: '前面无关背景' },
        { from: 60.0, to: 65.0, content: '日元一度击穿164关口' },
        { from: 65.2, to: 70.0, content: '创下40年以来的历史新低' },
        { from: 70.5, to: 75.0, content: '而这次主导因素发生了变化' },
        { from: 150.0, to: 160.0, content: '后面的其他段落' },
      ];

      // Highlight at 62 seconds
      const quotes = extractQuotesForHighlight(62, subs);
      expect(quotes.length).toBeGreaterThanOrEqual(2);
      expect(quotes[0].content).toBe('日元一度击穿164关口');
      expect(quotes[0].timestampStr).toBe('01:00');
      expect(quotes[1].content).toBe('创下40年以来的历史新低');
    });
  });

  describe('fetchBilibiliSubtitles', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('throws descriptive error if bvid or cid is missing', async () => {
      await expect(fetchBilibiliSubtitles({ bvid: '', cid: '' })).rejects.toThrow(
        '缺少视频标识参数'
      );
    });

    it('throws clean error when subtitles list is empty', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          message: '0',
          data: {
            subtitle: {
              subtitles: [],
            },
          },
        }),
      } as any);

      await expect(
        fetchBilibiliSubtitles({ bvid: 'BV16rtc63EgT', cid: '41351774358' })
      ).rejects.toThrow('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
    });

    it('successfully fetches and parses subtitle body items via dm/view', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              subtitle: {
                subtitles: [
                  {
                    id: 1,
                    lan: 'ai-zh',
                    lan_doc: '中文（自动生成）',
                    subtitle_url: 'http://aisubtitle.hdslb.com/bfs/ai_subtitle/test.json',
                  },
                ],
              },
            },
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            body: [
              { from: 0.5, to: 3.2, content: '日元对美元汇率持续下行' },
              { from: 3.5, to: 7.1, content: '这是近40年来的历史性低位' },
            ],
          }),
        } as any);

      const subtitles = await fetchBilibiliSubtitles({
        bvid: 'BV16rtc63EgT',
        cid: '41351774358',
      });

      expect(subtitles).toHaveLength(1); // merged via fuseSubtitles
      expect(subtitles[0].content).toContain('日元对美元汇率持续下行这是近40年来的历史性低位');
      expect(subtitles[0].from).toBe(0.5);
      expect(subtitles[0].to).toBe(7.1);
    });
  });
});
