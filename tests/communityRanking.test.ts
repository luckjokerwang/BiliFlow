import { describe, it, expect } from 'vitest';
import {
  normalizeComment,
  selectFeaturedComments,
  selectFeaturedDanmaku,
} from '../src/utils/communityRanking';
import { CommunityDanmakuItem } from '../src/types';

function rawComment(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    rpid: id,
    member: { uname: `user-${id}` },
    content: { message: `content-${id}` },
    like: 1,
    rcount: 0,
    ctime: 100,
    reply_control: {},
    up_action: {},
    ...overrides,
  };
}

describe('selectFeaturedComments', () => {
  it('prioritizes pinned, then UP-liked, then likes/replies/time', () => {
    const result = selectFeaturedComments([
      rawComment('plain', { like: 100 }),
      rawComment('up', { like: 1, up_action: { like: 1 } }),
      rawComment('pinned', { like: 0, reply_control: { is_up_top: 1 } }),
    ]);
    expect(result.map((item) => item.id)).toEqual(['pinned', 'up', 'plain']);
  });

  it('dedupes by rpid across different sort pages', () => {
    const result = selectFeaturedComments([
      rawComment('same', { like: 5 }),
      rawComment('same', { like: 9 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].likeCount).toBe(5);
  });

  it('filters hidden comments and empty content', () => {
    const result = selectFeaturedComments([
      rawComment('hidden', { state: 17 }),
      rawComment('invisible', { invisible: true }),
      rawComment('empty', { content: { message: '' } }),
      rawComment('fine'),
    ]);
    expect(result.map((item) => item.id)).toEqual(['fine']);
  });

  it('caps at 12 items', () => {
    const all = Array.from({ length: 20 }, (_, i) => rawComment(String(i)));
    expect(selectFeaturedComments(all)).toHaveLength(12);
  });

  it('extracts and sorts subReplies by likeCount descending, preserving likeCount', () => {
    const raw = rawComment('parent', {
      like: 10,
      rcount: 3,
      replies: [
        rawComment('sub1', { like: 100, content: { message: 'sub comment 1' } }),
        rawComment('sub2', { like: 1050, content: { message: 'sub comment god tier' } }),
        rawComment('sub3', { like: 50, content: { message: 'sub comment 3' } }),
        rawComment('sub-hidden', { state: 17, content: { message: 'hidden' } }),
      ],
    });
    const result = normalizeComment(raw, false);
    expect(result).not.toBeNull();
    expect(result?.subReplies).toHaveLength(3);
    expect(result?.subReplies?.[0].id).toBe('sub2');
    expect(result?.subReplies?.[0].likeCount).toBe(1050);
    expect(result?.subReplies?.[0].content).toBe('sub comment god tier');
    expect(result?.subReplies?.[1].id).toBe('sub1');
    expect(result?.subReplies?.[1].likeCount).toBe(100);
    expect(result?.subReplies?.[2].id).toBe('sub3');
    expect(result?.subReplies?.[2].likeCount).toBe(50);
  });

  it('leaves subReplies undefined when record has no replies', () => {
    const raw = rawComment('single', { like: 5 });
    const result = normalizeComment(raw, false);
    expect(result).not.toBeNull();
    expect(result?.subReplies).toBeUndefined();
  });
});

function danmaku(
  id: string,
  content: string,
  timestampSec: number,
  resonanceCount = 1
): CommunityDanmakuItem {
  return { id, content, timestampSec, resonanceCount, heatRatio: 0 };
}

describe('selectFeaturedDanmaku', () => {
  it('merges identical normalized texts and keeps the earliest', () => {
    const result = selectFeaturedDanmaku([
      danmaku('b', '  同 文 ', 20, 5),
      danmaku('a', '同文', 10, 2),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(result[0].resonanceCount).toBe(2);
  });

  it('adds nearby heat ratio within 15 seconds', () => {
    const result = selectFeaturedDanmaku(
      [danmaku('a', 'hello', 10), danmaku('b', 'world', 100)],
      [
        { timestampSec: 20, densityRatio: 0.8 },
        { timestampSec: 200, densityRatio: 0.1 },
      ]
    );
    const hello = result.find((item) => item.id === 'a')!;
    const world = result.find((item) => item.id === 'b')!;
    expect(hello.heatRatio).toBe(0.8);
    expect(world.heatRatio).toBe(0);
  });

  it('caps at 20 and sorts output by timestamp', () => {
    const all = Array.from({ length: 30 }, (_, i) => danmaku(String(i), `text-${i}`, i));
    const result = selectFeaturedDanmaku(all);
    expect(result).toHaveLength(20);
    const times = result.map((item) => item.timestampSec);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('returns empty for empty input', () => {
    expect(selectFeaturedDanmaku([])).toEqual([]);
  });
});
