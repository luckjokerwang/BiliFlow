import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBilibiliSubtitles } from '../src/services/bilibiliApi';

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

  it('successfully fetches and parses subtitle body items', async () => {
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
                  lan: 'zh-CN',
                  lan_doc: '中文（自动生成）',
                  subtitle_url: 'https://i0.hdslb.com/bfs/subtitle/test.json',
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

    expect(subtitles).toHaveLength(2);
    expect(subtitles[0].content).toBe('日元对美元汇率持续下行');
    expect(subtitles[0].from).toBe(0.5);
    expect(subtitles[1].to).toBe(7.1);
  });
});
