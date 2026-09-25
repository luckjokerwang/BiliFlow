import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorageState: Record<string, any> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | null) => {
          if (keys === null) {
            return { ...mockStorageState };
          }
          if (typeof keys === 'string') {
            return { [keys]: mockStorageState[keys] };
          }
          if (Array.isArray(keys)) {
            const res: Record<string, any> = {};
            for (const k of keys) {
              if (mockStorageState[k] !== undefined) {
                res[k] = mockStorageState[k];
              }
            }
            return res;
          }
          return {};
        }),
        set: vi.fn(async (items: Record<string, any>) => {
          Object.assign(mockStorageState, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) {
            delete mockStorageState[k];
          }
        }),
      },
    },
  },
}));

import {
  CACHE_INDEX_KEY,
  estimateObjectSize,
  pruneLruEntries,
  saveSummaryToCache,
  getCachedSummary,
  deleteCachedSummary,
  isCachedSummaryValid,
  getCacheStats,
  clearAllSummaryCache,
} from '../src/services/summaryCacheService';
import { VideoSummaryResult, CacheIndexEntry } from '../src/types';
import { browser } from 'wxt/browser';

describe('summaryCacheService', () => {
  beforeEach(() => {
    // Clear storage mock state before each test
    for (const key of Object.keys(mockStorageState)) {
      delete mockStorageState[key];
    }
    vi.clearAllMocks();
  });

  const mockSummary1: VideoSummaryResult = {
    bvid: 'BV1xx411c7mD',
    cid: '10001',
    title: '视频测试1',
    oneSentenceSummary: '这是视频1的总结',
    highlights: [
      { id: 1, timestamp: 10, timestampStr: '00:10', title: '节点1', keyPoint: '要点1' },
    ],
    createdAt: 1000,
  };

  const mockSummary2: VideoSummaryResult = {
    bvid: 'BV2yy411c7mE',
    cid: '20002',
    title: '视频测试2',
    oneSentenceSummary: '这是视频2的总结',
    highlights: [
      { id: 1, timestamp: 20, timestampStr: '00:20', title: '节点2', keyPoint: '要点2' },
    ],
    createdAt: 2000,
  };

  const mockSummary3: VideoSummaryResult = {
    bvid: 'BV3zz411c7mF',
    cid: '30003',
    title: '视频测试3',
    oneSentenceSummary: '这是视频3的总结',
    highlights: [
      { id: 1, timestamp: 30, timestampStr: '00:30', title: '节点3', keyPoint: '要点3' },
    ],
    createdAt: 3000,
  };

  describe('estimateObjectSize', () => {
    it('should estimate string and object sizes in bytes', () => {
      expect(estimateObjectSize('hello')).toBe(10);
      expect(estimateObjectSize({ a: 1 })).toBeGreaterThan(0);
      expect(estimateObjectSize(null)).toBe(8); // 'null'.length * 2
    });
  });

  describe('pruneLruEntries', () => {
    it('should not evict when entry count <= maxLimit', () => {
      const entries: CacheIndexEntry[] = [
        { key: 'k1', bvid: 'b1', cid: 'c1', title: 't1', updatedAt: 100, sizeEstimatedBytes: 50 },
      ];
      const { kept, evicted } = pruneLruEntries(entries, 5);
      expect(kept.length).toBe(1);
      expect(evicted.length).toBe(0);
    });

    it('should evict oldest entries by updatedAt when exceeding maxLimit', () => {
      const entries: CacheIndexEntry[] = [
        { key: 'k1', bvid: 'b1', cid: 'c1', title: 't1', updatedAt: 100, sizeEstimatedBytes: 50 },
        { key: 'k2', bvid: 'b2', cid: 'c2', title: 't2', updatedAt: 300, sizeEstimatedBytes: 50 },
        { key: 'k3', bvid: 'b3', cid: 'c3', title: 't3', updatedAt: 200, sizeEstimatedBytes: 50 },
      ];
      // Limit to 2: k1 has oldest updatedAt (100) and must be evicted
      const { kept, evicted } = pruneLruEntries(entries, 2);
      expect(kept.map((e) => e.key)).toEqual(['k2', 'k3']);
      expect(evicted.map((e) => e.key)).toEqual(['k1']);
    });
  });

  describe('saveSummaryToCache & getCachedSummary', () => {
    it('should save a summary to cache and update index', async () => {
      await saveSummaryToCache(mockSummary1);

      const cached = await getCachedSummary('BV1xx411c7mD', '10001');
      expect(cached).toEqual(mockSummary1);

      const index = mockStorageState[CACHE_INDEX_KEY] as CacheIndexEntry[];
      expect(index).toHaveLength(1);
      expect(index[0].key).toBe('summary_BV1xx411c7mD_10001');
      expect(index[0].title).toBe('视频测试1');
    });

    it('should refresh updatedAt on getCachedSummary (LRU touch)', async () => {
      await saveSummaryToCache(mockSummary1);
      const originalTime = mockStorageState[CACHE_INDEX_KEY][0].updatedAt;

      // Advance time slightly
      await new Promise((r) => setTimeout(r, 10));

      const hit = await getCachedSummary('BV1xx411c7mD', '10001');
      expect(hit).toBeDefined();

      const newTime = mockStorageState[CACHE_INDEX_KEY][0].updatedAt;
      expect(newTime).toBeGreaterThanOrEqual(originalTime);
    });

    it('should evict oldest entry when exceeding maxLimit', async () => {
      // Set maxLimit to 2
      await saveSummaryToCache(mockSummary1, 2);
      await new Promise((r) => setTimeout(r, 5));
      await saveSummaryToCache(mockSummary2, 2);
      await new Promise((r) => setTimeout(r, 5));
      await saveSummaryToCache(mockSummary3, 2);

      // Now mockSummary1 should be evicted from storage
      expect(mockStorageState['summary_BV1xx411c7mD_10001']).toBeUndefined();
      expect(mockStorageState['summary_BV2yy411c7mE_20002']).toBeDefined();
      expect(mockStorageState['summary_BV3zz411c7mF_30003']).toBeDefined();

      const index = mockStorageState[CACHE_INDEX_KEY] as CacheIndexEntry[];
      expect(index).toHaveLength(2);
      expect(index.map((e) => e.key)).toEqual([
        'summary_BV3zz411c7mF_30003',
        'summary_BV2yy411c7mE_20002',
      ]);
    });

    it('should return null for non-existent video', async () => {
      const result = await getCachedSummary('BV_nonexistent', '9999');
      expect(result).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return 0 stats on empty storage', async () => {
      const stats = await getCacheStats(100);
      expect(stats.count).toBe(0);
      expect(stats.totalEstimatedBytes).toBe(0);
      expect(stats.maxLimit).toBe(100);
    });

    it('should calculate correct count and total bytes', async () => {
      await saveSummaryToCache(mockSummary1);
      await saveSummaryToCache(mockSummary2);

      const stats = await getCacheStats(100);
      expect(stats.count).toBe(2);
      expect(stats.totalEstimatedBytes).toBeGreaterThan(0);
    });
  });

  describe('deleteCachedSummary', () => {
    it('should delete a specific cached summary and remove it from index', async () => {
      await saveSummaryToCache(mockSummary1);
      await saveSummaryToCache(mockSummary2);

      await deleteCachedSummary(mockSummary1.bvid, mockSummary1.cid);

      expect(mockStorageState['summary_BV1xx411c7mD_10001']).toBeUndefined();
      expect(mockStorageState['summary_BV2yy411c7mE_20002']).toBeDefined();

      const index = mockStorageState[CACHE_INDEX_KEY];
      expect(index.some((item: any) => item.key === 'summary_BV1xx411c7mD_10001')).toBe(false);
      expect(index.some((item: any) => item.key === 'summary_BV2yy411c7mE_20002')).toBe(true);
    });

    it('should do nothing gracefully if key does not exist', async () => {
      await deleteCachedSummary('non_existent', '99999');
      // Should not throw or crash
    });
  });

  describe('isCachedSummaryValid', () => {
    it('returns true for a fully matched and consistent cached summary', () => {
      const valid = isCachedSummaryValid(mockSummary1, {
        bvid: 'BV1xx411c7mD',
        cid: '10001',
        title: '视频测试1',
        duration: 60,
      });
      expect(valid).toBe(true);
    });

    it('returns false if bvid or cid does not match', () => {
      expect(
        isCachedSummaryValid(mockSummary1, {
          bvid: 'BV_DIFFERENT',
          cid: '10001',
        })
      ).toBe(false);

      expect(
        isCachedSummaryValid(mockSummary1, {
          bvid: 'BV1xx411c7mD',
          cid: '99999',
        })
      ).toBe(false);
    });

    it('returns false if highlights array is missing or empty', () => {
      expect(
        isCachedSummaryValid(
          { ...mockSummary1, highlights: [] },
          { bvid: 'BV1xx411c7mD', cid: '10001' }
        )
      ).toBe(false);
    });

    it('returns false if cached title completely contradicts current title', () => {
      const corrupted = {
        ...mockSummary1,
        title: '【医学科普】火锅店猝死与脑出血急救预防',
      };
      expect(
        isCachedSummaryValid(corrupted, {
          bvid: 'BV1xx411c7mD',
          cid: '10001',
          title: '闪存芯片与半导体供应链深度调查',
        })
      ).toBe(false);
    });

    it('returns false for severely truncated summary on long videos (e.g. 33min video with only 2min highlights)', () => {
      const truncatedSummary: VideoSummaryResult = {
        bvid: 'BV1rHh16CEfm',
        cid: '42183360876',
        title: '闪存，涨价和三万个零件：为什么偏偏今年都在涨？',
        oneSentenceSummary: '视频通过火锅店猝死和桑拿脑出血两个真实病例...',
        highlights: [
          { id: 1, timestamp: 36, timestampStr: '00:36', title: '案例一', keyPoint: '...' },
          { id: 2, timestamp: 71, timestampStr: '01:11', title: '案例二', keyPoint: '...' },
          { id: 3, timestamp: 108, timestampStr: '01:48', title: '机制', keyPoint: '...' },
          { id: 4, timestamp: 126, timestampStr: '02:06', title: '建议', keyPoint: '...' },
        ],
        createdAt: 1000,
      };

      // Video duration is 1972s (32:52)
      const valid = isCachedSummaryValid(truncatedSummary, {
        bvid: 'BV1rHh16CEfm',
        cid: '42183360876',
        title: '闪存，涨价和三万个零件：为什么偏偏今年都在涨？',
        duration: 1972,
      });

      expect(valid).toBe(false);
    });
  });
});
