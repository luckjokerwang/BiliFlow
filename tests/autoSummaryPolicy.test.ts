import { describe, it, expect } from 'vitest';
import { isVideoCategoryKey, resolveVideoCategory } from '../src/utils/videoCategory';
import { evaluateAutoSummaryGate } from '../src/utils/autoSummaryPolicy';
import type { VideoCategoryKey } from '../src/types';

describe('resolveVideoCategory', () => {
  it('prefers tid_v2 and maps subcategories to their root', () => {
    expect(resolveVideoCategory({ tidV2: 2087, tname: '', tnameV2: '' })).toEqual({
      key: 'knowledge',
      label: '知识',
    });
    expect(resolveVideoCategory({ tidV2: 2017 })).toEqual({ key: 'music', label: '音乐' });
    expect(resolveVideoCategory({ tidV2: 2012 })).toEqual({ key: 'entertainment', label: '娱乐' });
  });

  it('falls back to legacy tid and names', () => {
    expect(resolveVideoCategory({ tid: 160 })).toEqual({ key: 'life', label: '生活' });
    expect(resolveVideoCategory({ tname: '科技' })).toEqual({
      key: 'tech',
      label: '科技数码',
      rawName: '科技',
    });
    expect(resolveVideoCategory({ tname: '动物圈' })).toEqual({
      key: 'animal',
      label: '动物',
      rawName: '动物圈',
    });
  });

  it('returns null for unknown categories and validates selection keys', () => {
    expect(resolveVideoCategory({})).toBeNull();
    expect(resolveVideoCategory({ tid: -1, tidV2: 9999, tname: '不存在' })).toBeNull();
    expect(isVideoCategoryKey('entertainment')).toBe(true);
    expect(isVideoCategoryKey('not_a_category')).toBe(false);
  });
});

describe('evaluateAutoSummaryGate', () => {
  const category = resolveVideoCategory({ tidV2: 2012 })!;

  it('honors global toggle before duration and category', () => {
    expect(
      evaluateAutoSummaryGate({
        autoSummarize: false,
        minDurationForAutoSec: 60,
        durationSec: 10,
        category,
        categoryMode: 'include',
        selectedCategories: [],
      })
    ).toEqual({ allowed: false, reason: 'autoDisabled' });
  });

  it('keeps unknown duration allowed', () => {
    expect(
      evaluateAutoSummaryGate({
        autoSummarize: true,
        minDurationForAutoSec: 60,
        durationSec: 0,
        category,
        categoryMode: 'exclude',
        selectedCategories: ['entertainment'],
      })
    ).toEqual({ allowed: false, reason: 'categoryExcluded' });
    expect(
      evaluateAutoSummaryGate({
        autoSummarize: true,
        minDurationForAutoSec: 0,
        durationSec: 0,
        category,
        categoryMode: 'include',
        selectedCategories: ['entertainment'],
      })
    ).toEqual({ allowed: true, reason: null });
  });

  it('applies short-duration threshold only with known positive values', () => {
    expect(
      evaluateAutoSummaryGate({
        autoSummarize: true,
        minDurationForAutoSec: 60,
        durationSec: 30,
        category,
        categoryMode: 'all',
        selectedCategories: [],
      })
    ).toEqual({ allowed: false, reason: 'tooShort' });
  });

  it('implements include and exclude semantics', () => {
    const base = {
      autoSummarize: true,
      minDurationForAutoSec: 0,
      durationSec: 600,
      category,
    };
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'include',
        selectedCategories: ['entertainment' as VideoCategoryKey],
      })
    ).toEqual({ allowed: true, reason: null });
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'include',
        selectedCategories: ['knowledge'],
      })
    ).toEqual({ allowed: false, reason: 'categoryNotIncluded' });
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'exclude',
        selectedCategories: ['entertainment'],
      })
    ).toEqual({ allowed: false, reason: 'categoryExcluded' });
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'exclude',
        selectedCategories: ['knowledge'],
      })
    ).toEqual({ allowed: true, reason: null });
  });

  it('treats unknown category as blocked only in include mode', () => {
    const base = {
      autoSummarize: true,
      minDurationForAutoSec: 0,
      durationSec: 600,
      category: null,
    };
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'include',
        selectedCategories: ['entertainment'],
      })
    ).toEqual({ allowed: false, reason: 'categoryUnknown' });
    expect(
      evaluateAutoSummaryGate({
        ...base,
        categoryMode: 'exclude',
        selectedCategories: ['entertainment'],
      })
    ).toEqual({ allowed: true, reason: null });
  });
});
