import { describe, it, expect } from 'vitest';
import { BiliRawSubtitleItem } from '../src/types';
import { filterTranscriptItems } from '../src/utils/transcriptSearch';

const items: BiliRawSubtitleItem[] = [
  { from: 0, to: 2, content: 'Hello TypeScript' },
  { from: 3, to: 5, content: '中文关键词' },
  { from: 6, to: 8, content: 'HELLO again' },
];

describe('filterTranscriptItems', () => {
  it('returns all items with original indices for an empty or whitespace query', () => {
    expect(filterTranscriptItems(items, '')).toEqual([
      { item: items[0], index: 0 },
      { item: items[1], index: 1 },
      { item: items[2], index: 2 },
    ]);
    expect(filterTranscriptItems(items, '   ')).toHaveLength(3);
  });

  it('matches case-insensitively and preserves original indices', () => {
    expect(filterTranscriptItems(items, 'hello')).toEqual([
      { item: items[0], index: 0 },
      { item: items[2], index: 2 },
    ]);
  });

  it('matches Chinese content and trims surrounding whitespace in the query', () => {
    expect(filterTranscriptItems(items, '  关键词  ')).toEqual([
      { item: items[1], index: 1 },
    ]);
  });

  it('returns empty results for a missing match or non-array input', () => {
    expect(filterTranscriptItems(items, 'not present')).toEqual([]);
    expect(
      filterTranscriptItems(undefined as unknown as BiliRawSubtitleItem[], 'x')
    ).toEqual([]);
  });
});
