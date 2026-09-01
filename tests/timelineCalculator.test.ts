import { describe, it, expect } from 'vitest';
import {
  calculateTimelineMarkers,
  findActiveHighlightIndex,
  findActiveQuoteIndex,
} from '../src/utils/timelineCalculator';
import { HighlightItem } from '../src/types';

describe('calculateTimelineMarkers', () => {
  const mockHighlights: HighlightItem[] = [
    {
      id: 'h1',
      title: '原材料涨价三大主因',
      timestampSec: 48,
      timestampStr: '00:48',
      keyPoint: '电池核心原材料碳酸锂从7万涨到18万每吨',
    },
    {
      id: 'h2',
      title: '车企成本激增实例',
      timestampSec: 217,
      timestampStr: '03:37',
      keyPoint: '赛力斯和蔚来均表示每辆车成本上涨约1.5-2万元',
    },
    {
      id: 'h3',
      title: '供应商的灰色降本',
      timestampSec: 241,
      timestampStr: '04:01',
      keyPoint: '供应商通过混用水口料等方式降本',
    },
    {
      id: 'h4',
      title: '尾部亮点',
      timestampSec: 490,
      timestampStr: '08:10',
    },
  ];

  it('calculates correct percentages for valid video duration', () => {
    const totalDuration = 501; // 08:21
    const markers = calculateTimelineMarkers(mockHighlights, totalDuration);

    expect(markers).toHaveLength(4);

    // 48 / 501 * 100 = 9.58%
    expect(markers[0].percentage).toBeCloseTo(9.58, 1);
    expect(markers[0].title).toBe('原材料涨价三大主因');

    // 217 / 501 * 100 = 43.31%
    expect(markers[1].percentage).toBeCloseTo(43.31, 1);

    // 241 / 501 * 100 = 48.10%
    expect(markers[2].percentage).toBeCloseTo(48.10, 1);

    // 490 / 501 * 100 = 97.80%
    expect(markers[3].percentage).toBeCloseTo(97.80, 1);
  });

  it('handles edge cases: zero duration, negative duration, NaN, or empty highlights', () => {
    expect(calculateTimelineMarkers(mockHighlights, 0)).toEqual([]);
    expect(calculateTimelineMarkers(mockHighlights, -10)).toEqual([]);
    expect(calculateTimelineMarkers(mockHighlights, NaN)).toEqual([]);
    expect(calculateTimelineMarkers([], 500)).toEqual([]);
  });

  it('clamps markers within valid progress bar bounds (0.8% ~ 99.2%)', () => {
    const edgeHighlights: HighlightItem[] = [
      {
        id: 'start',
        title: '片头',
        timestampSec: 0,
        timestampStr: '00:00',
      },
      {
        id: 'beyond',
        title: '超时',
        timestampSec: 9999,
        timestampStr: '99:99',
      },
    ];

    const markers = calculateTimelineMarkers(edgeHighlights, 100);
    expect(markers[0].percentage).toBe(0.8);
    expect(markers[1].percentage).toBe(99.2);
  });

  it('groups closely spaced markers into clusters', () => {
    const closeHighlights: HighlightItem[] = [
      {
        id: 'c1',
        title: '密集点1',
        timestampSec: 100,
        timestampStr: '01:40',
      },
      {
        id: 'c2',
        title: '密集点2',
        timestampSec: 105, // 1000s video -> 0.5% diff
        timestampStr: '01:45',
      },
      {
        id: 'c3',
        title: '远距离点',
        timestampSec: 500,
        timestampStr: '08:20',
      },
    ];

    const markers = calculateTimelineMarkers(closeHighlights, 1000);
    expect(markers[0].clusterGroup).toBeDefined();
    expect(markers[0].clusterGroup).toBe(markers[1].clusterGroup);
    expect(markers[2].clusterGroup).not.toBe(markers[0].clusterGroup);
  });
});

describe('findActiveHighlightIndex', () => {
  const highlights: HighlightItem[] = [
    { id: '1', title: 'A', timestamp: 20, timestampStr: '00:20', keyPoint: '' },
    { id: '2', title: 'B', timestamp: 60, timestampStr: '01:00', keyPoint: '' },
    { id: '3', title: 'C', timestamp: 120, timestampStr: '02:00', keyPoint: '' },
  ];

  it('returns 0 when currentSec is before first highlight or negative', () => {
    expect(findActiveHighlightIndex(highlights, 0)).toBe(0);
    expect(findActiveHighlightIndex(highlights, 10)).toBe(0);
    expect(findActiveHighlightIndex(highlights, -5)).toBe(0);
  });

  it('returns correct index when currentSec falls within middle or past last highlight', () => {
    expect(findActiveHighlightIndex(highlights, 20)).toBe(0);
    expect(findActiveHighlightIndex(highlights, 59)).toBe(0);
    expect(findActiveHighlightIndex(highlights, 60)).toBe(1);
    expect(findActiveHighlightIndex(highlights, 90)).toBe(1);
    expect(findActiveHighlightIndex(highlights, 120)).toBe(2);
    expect(findActiveHighlightIndex(highlights, 300)).toBe(2);
  });
});

describe('findActiveQuoteIndex', () => {
  const quotes = [
    { timestamp: 10, timestampStr: '00:10', content: '第一句' },
    { timestamp: 25, timestampStr: '00:25', content: '第二句' },
    { timestamp: 40, timestampStr: '00:40', content: '第三句' },
  ];

  it('returns -1 when currentSec is before all quotes', () => {
    expect(findActiveQuoteIndex(quotes, 5)).toBe(-1);
    expect(findActiveQuoteIndex([], 15)).toBe(-1);
  });

  it('returns the active quote index matching current playback time', () => {
    expect(findActiveQuoteIndex(quotes, 10)).toBe(0);
    expect(findActiveQuoteIndex(quotes, 20)).toBe(0);
    expect(findActiveQuoteIndex(quotes, 25)).toBe(1);
    expect(findActiveQuoteIndex(quotes, 39)).toBe(1);
    expect(findActiveQuoteIndex(quotes, 40)).toBe(2);
    expect(findActiveQuoteIndex(quotes, 100)).toBe(2);
  });
});
