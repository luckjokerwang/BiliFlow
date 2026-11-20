import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCommunityDigest } from '../src/services/communityService';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function textResponse(text: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(text),
  } as Response;
}

const payload = { bvid: 'BV1', cid: '123', aid: '456', durationSec: 300 };
const danmakuXml =
  '<i><d p="10,1,25,0,0,0,1,a">first danmaku</d><d p="20,1,25,0,0,0,2,b">second danmaku</d></i>';

function commentReply(replies: unknown[]): unknown {
  return { code: 0, data: { replies, page: { count: 99 } } };
}

describe('fetchCommunityDigest', () => {
  it('merges both comment sort pages with XML and heatmap in parallel', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/v2/reply')) {
        const sort = new URL(url).searchParams.get('sort');
        return Promise.resolve(
          jsonResponse(
            commentReply([
              {
                rpid: sort === '1' ? 'like' : 'reply',
                member: { uname: 'u' },
                content: { message: `from ${sort}` },
                like: sort === '1' ? 50 : 10,
                rcount: 0,
                ctime: 1,
              },
            ])
          )
        );
      }
      if (url.includes('/x/v1/dm/list.so')) return Promise.resolve(textResponse(danmakuXml));
      if (url.includes('/pbp/data')) {
        return Promise.resolve(jsonResponse({ step_sec: 10, events: { default: [1, 5, 1] } }));
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    }) as unknown as typeof fetch;

    const digest = await fetchCommunityDigest(payload);
    expect(digest.comments.map((c) => c.id).sort()).toEqual(['like', 'reply']);
    expect(digest.commentTotal).toBe(99);
    expect(digest.danmaku).toHaveLength(2);
    expect(digest.danmakuSampleCount).toBe(2);
    expect(digest.errors).toEqual({});
  });

  it('keeps danmaku when the comment path fails', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/v2/reply')) return Promise.resolve(jsonResponse({ code: -1 }));
      if (url.includes('/x/v1/dm/list.so')) return Promise.resolve(textResponse(danmakuXml));
      if (url.includes('/pbp/data')) return Promise.reject(new Error('heat failed'));
      return Promise.reject(new Error(`unexpected ${url}`));
    }) as unknown as typeof fetch;

    const digest = await fetchCommunityDigest(payload);
    expect(digest.comments).toEqual([]);
    expect(digest.danmaku).toHaveLength(2);
    expect(digest.errors.comments).toBe('评论数据加载失败');
    expect(digest.errors.danmaku).toBe('弹幕热度不可用，已按共鸣度排序');
  });

  it('keeps comments when the XML danmaku path fails', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/v2/reply')) {
        return Promise.resolve(
          jsonResponse(
            commentReply([
              {
                rpid: '1',
                member: { uname: 'u' },
                content: { message: 'hi' },
                like: 3,
                rcount: 0,
                ctime: 1,
              },
            ])
          )
        );
      }
      if (url.includes('/x/v1/dm/list.so')) return Promise.resolve(textResponse('', false, 500));
      if (url.includes('/pbp/data')) return Promise.reject(new Error('heat failed'));
      return Promise.reject(new Error(`unexpected ${url}`));
    }) as unknown as typeof fetch;

    const digest = await fetchCommunityDigest(payload);
    expect(digest.comments).toHaveLength(1);
    expect(digest.danmaku).toEqual([]);
    expect(digest.errors.danmaku).toBe('实时弹幕池加载失败');
  });

  it('throws when both paths fail', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await expect(fetchCommunityDigest(payload)).rejects.toThrow('社区精选数据加载失败');
  });
});
