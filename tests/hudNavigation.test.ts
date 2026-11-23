import { describe, it, expect } from 'vitest';
import { getNextHudViewMode } from '../src/utils/hudNavigation';

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
