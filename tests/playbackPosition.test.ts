import { describe, it, expect } from 'vitest';
import { HighlightItem, VideoPlaybackPositions } from '../src/types';
import {
  getHighlightStart,
  resolveHighlightResumeSeconds,
} from '../src/utils/playbackPosition';

const highlights: HighlightItem[] = [
  { id: 'a', timestamp: 10, timestampStr: '00:10', title: 'A' },
  { id: 'b', timestampSec: 60, timestampStr: '01:00', title: 'B' },
  { id: 'c', timestamp: 120, timestampStr: '02:00', title: 'C' },
];

function positions(record: Record<string, number>): VideoPlaybackPositions {
  const result: VideoPlaybackPositions = {};
  for (const [id, positionSec] of Object.entries(record)) {
    result[id] = { positionSec, updatedAt: 1 };
  }
  return result;
}

describe('getHighlightStart', () => {
  it('prefers timestamp then timestampSec', () => {
    expect(getHighlightStart(highlights[0])).toBe(10);
    expect(getHighlightStart(highlights[1])).toBe(60);
  });

  it('falls back to zero for invalid values', () => {
    expect(getHighlightStart({ id: 'x', timestamp: NaN, timestampStr: '', title: '' })).toBe(0);
  });
});

describe('resolveHighlightResumeSeconds', () => {
  it('falls back to the chapter start with no record', () => {
    expect(resolveHighlightResumeSeconds(highlights, 0, {}, 200)).toBe(10);
  });

  it('restores a valid stored position', () => {
    expect(resolveHighlightResumeSeconds(highlights, 1, positions({ b: 75 }), 200)).toBe(75);
  });

  it('falls back at the next-chapter boundary', () => {
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ a: 60 }), 200)).toBe(10);
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ a: 59.9 }), 200)).toBe(59.9);
  });

  it('falls back at the duration boundary for the last chapter', () => {
    expect(resolveHighlightResumeSeconds(highlights, 2, positions({ c: 200 }), 200)).toBe(120);
    expect(resolveHighlightResumeSeconds(highlights, 2, positions({ c: 150 }), 200)).toBe(150);
  });

  it('rejects non-finite and negative records', () => {
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ a: NaN }), 200)).toBe(10);
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ a: Infinity }), 200)).toBe(10);
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ a: -1 }), 200)).toBe(10);
  });

  it('for the last chapter without duration, only requires position >= start', () => {
    expect(resolveHighlightResumeSeconds([highlights[2]], 0, positions({ c: 9999 }), 0)).toBe(9999);
  });

  it('ignores records belonging to other highlights', () => {
    expect(resolveHighlightResumeSeconds(highlights, 0, positions({ b: 65 }), 200)).toBe(10);
  });
});
