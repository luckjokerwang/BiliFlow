import { describe, it, expect } from 'vitest';
import {
  getNextHudViewMode,
  isViewSwitchTabKey,
} from '../src/utils/hudNavigation';
describe('getNextHudViewMode', () => {
  it('cycles forward summary -> transcript -> community -> summary', () => {
    expect(getNextHudViewMode('summary', false)).toBe('transcript');
    expect(getNextHudViewMode('transcript', false)).toBe('community');
    expect(getNextHudViewMode('community', false)).toBe('summary');
  });

  it('cycles backward summary -> community -> transcript -> summary', () => {
    expect(getNextHudViewMode('summary', true)).toBe('community');
    expect(getNextHudViewMode('community', true)).toBe('transcript');
    expect(getNextHudViewMode('transcript', true)).toBe('summary');
  });
});

describe('isViewSwitchTabKey', () => {
  const base = { key: 'Tab', ctrlKey: false, altKey: false, metaKey: false };

  it('accepts a bare Tab (Shift is handled separately via reverse)', () => {
    expect(isViewSwitchTabKey(base)).toBe(true);
  });

  it('rejects non-Tab keys', () => {
    expect(isViewSwitchTabKey({ ...base, key: 't' })).toBe(false);
  });

  it('rejects Tab with Ctrl/Alt/Meta modifiers', () => {
    expect(isViewSwitchTabKey({ ...base, ctrlKey: true })).toBe(false);
    expect(isViewSwitchTabKey({ ...base, altKey: true })).toBe(false);
    expect(isViewSwitchTabKey({ ...base, metaKey: true })).toBe(false);
  });
});
