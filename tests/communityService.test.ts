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

  it('fetches multiple pages concurrently without nohot and ranks high-like comments from later pages', async () => {
    const requestedUrls: string[] = [];

    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      if (url.includes('/x/v2/reply')) {
        const u = new URL(url);
        const pn = u.searchParams.get('pn');
        expect(u.searchParams.has('nohot')).toBe(false);

        if (pn === '1') {
          return Promise.resolve(
            jsonResponse(
              commentReply([
                {
                  rpid: 'p1_normal',
                  member: { uname: 'user1' },
                  content: { message: '普通评论' },
                  like: 50,
                  rcount: 2,
                  ctime: 10,
                },
                {
                  rpid: 'p1_dup',
                  member: { uname: 'dup_user' },
                  content: { message: '重复评论' },
                  like: 10,
                  rcount: 0,
                  ctime: 20,
                },
              ])
            )
          );
        }

        if (pn === '2') {
          return Promise.resolve(
            jsonResponse(
              commentReply([
                {
                  rpid: 'p2_god_tier',
                  member: { uname: 'god_user' },
                  content: { message: '秘银飞轮' },
                  like: 2500,
                  rcount: 80,
                  ctime: 30,
                  replies: [
                    {
                      rpid: 'sub_1',
                      member: { uname: 'sub_user' },
                      content: { message: '楼中楼神评' },
                      like: 1050,
                      rcount: 0,
                      ctime: 35,
                    },
                  ],
                },
                {
                  rpid: 'p1_dup', // Duplicate from page 1
                  member: { uname: 'dup_user' },
                  content: { message: '重复评论' },
                  like: 10,
                  rcount: 0,
                  ctime: 20,
                },
              ])
            )
          );
        }

        if (pn === '3') {
          return Promise.resolve(jsonResponse(commentReply([])));
        }
      }

      if (url.includes('/x/v1/dm/list.so')) return Promise.resolve(textResponse(danmakuXml));
      if (url.includes('/pbp/data')) {
        return Promise.resolve(jsonResponse({ step_sec: 10, events: { default: [1, 5, 1] } }));
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    }) as unknown as typeof fetch;

    const digest = await fetchCommunityDigest(payload);

    // Verify pn: 1, 2, 3 were requested
    const pns = requestedUrls
      .filter((u) => u.includes('/x/v2/reply'))
      .map((u) => new URL(u).searchParams.get('pn'));
    expect(pns).toContain('1');
    expect(pns).toContain('2');
    expect(pns).toContain('3');

    // High-like comment from page 2 (2500 likes) ranks first
    expect(digest.comments[0].id).toBe('p2_god_tier');
    expect(digest.comments[0].likeCount).toBe(2500);
    expect(digest.comments[0].content).toBe('秘银飞轮');
    expect(digest.comments[0].subReplies).toHaveLength(1);
    expect(digest.comments[0].subReplies?.[0].likeCount).toBe(1050);

    // Deduplication works: p1_dup appears only once
    const dupCount = digest.comments.filter((c) => c.id === 'p1_dup').length;
    expect(dupCount).toBe(1);
  });

  it('tolerates partial page failure in multi-page fetching', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/v2/reply')) {
        const u = new URL(url);
        const pn = u.searchParams.get('pn');
        if (pn === '3') {
          // Page 3 fails with 500
          return Promise.resolve(jsonResponse({ code: -500 }, false, 500));
        }
        return Promise.resolve(
          jsonResponse(
            commentReply([
              {
                rpid: `reply_p${pn}`,
                member: { uname: `user_${pn}` },
                content: { message: `content ${pn}` },
                like: pn === '1' ? 100 : 200,
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
    // Pages 1 and 2 succeeded despite page 3 failing
    expect(digest.comments.length).toBeGreaterThanOrEqual(1);
    const ids = digest.comments.map((c) => c.id);
    expect(ids).toContain('reply_p1');
    expect(ids).toContain('reply_p2');
  });
});
