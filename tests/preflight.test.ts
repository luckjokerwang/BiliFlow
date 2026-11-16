import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractDanmakuHeatmapPeaks } from '../src/utils/danmakuHeatmap';
import { fetchVideoPreflightMetadata } from '../src/services/bilibiliApi';

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

describe('extractDanmakuHeatmapPeaks', () => {
  it('returns normalized local maxima in chronological order', () => {
    const peaks = extractDanmakuHeatmapPeaks(
      [1, 4, 2, 8, 3, 6, 5, 9, 1],
      3
    );
    expect(peaks).toEqual([
      { timestampSec: 3, densityRatio: 0.444 },
      { timestampSec: 9, densityRatio: 0.889 },
      { timestampSec: 15, densityRatio: 0.667 },
      { timestampSec: 21, densityRatio: 1 },
    ]);
  });

  it('returns no peaks for all-zero, single-zero, or invalid step samples', () => {
    expect(extractDanmakuHeatmapPeaks([0, 0, 0], 3)).toEqual([]);
    expect(extractDanmakuHeatmapPeaks([0], 3)).toEqual([]);
    expect(extractDanmakuHeatmapPeaks([1, 3, 1], Number.NaN)).toEqual([]);
    expect(extractDanmakuHeatmapPeaks([1, 3, 1], Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('keeps timestamps aligned to original indices around invalid samples', () => {
    const peaks = extractDanmakuHeatmapPeaks([1, Number.NaN, 5, 1], 2);
    expect(peaks).toEqual([
      { timestampSec: 0, densityRatio: 0.2 },
      { timestampSec: 4, densityRatio: 1 },
    ]);
  });
});

describe('fetchVideoPreflightMetadata', () => {
  const params = {
    bvid: 'BV1Preflight',
    cid: '12345',
    aid: '678',
    description: '00:30 简介锚点',
    durationSec: 300,
  };

  it('maps raw view_points.content to chapters and pbp samples to peaks', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/player/v2')) {
        return Promise.resolve(
          jsonResponse({
            code: 0,
            data: {
              view_points: [
                { type: 2, from: 0, to: 60, content: '开场章节' },
                { type: 1, from: 60, to: 90, content: '非章节节点' },
                { type: 2, from: 320, to: 350, content: '超出时长' },
                { type: 2, from: 90, to: 150, content: '' },
              ],
            },
          })
        );
      }
      if (url.includes('/pbp/data')) {
        return Promise.resolve(
          jsonResponse({
            step_sec: 3,
            events: { default: [1, 4, 2, 8, 3] },
          })
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    }) as unknown as typeof fetch;

    const result = await fetchVideoPreflightMetadata(params);
    expect(result.officialChapters).toEqual([
      { from: 0, to: 60, title: '开场章节' },
    ]);
    expect(result.descriptionTimestamps).toEqual([
      { seconds: 30, title: '简介锚点' },
    ]);
    expect(result.danmakuHeatmapPeaks).toEqual([
      { timestampSec: 3, densityRatio: 0.5 },
      { timestampSec: 9, densityRatio: 1 },
    ]);
  });

  it('returns partial metadata when one endpoint fails', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/x/player/v2')) {
        return Promise.reject(new Error('player offline'));
      }
      return Promise.resolve(
        jsonResponse({ step_sec: 3, events: { default: [0, 5, 0] } })
      );
    }) as unknown as typeof fetch;

    const result = await fetchVideoPreflightMetadata(params);
    expect(result.officialChapters).toBeUndefined();
    expect(result.descriptionTimestamps).toEqual([
      { seconds: 30, title: '简介锚点' },
    ]);
    expect(result.danmakuHeatmapPeaks).toEqual([
      { timestampSec: 3, densityRatio: 1 },
    ]);
  });
});
