import { describe, it, expect, vi } from 'vitest';
import {
  getNextHudViewMode,
  calculateHudScrollTop,
  attachHudWheelIsolation,
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

describe('calculateHudScrollTop', () => {
  it('scrolls downwards by the default step (96px)', () => {
    const next = calculateHudScrollTop(100, 1000, 400, 1);
    expect(next).toBe(196);
  });

  it('scrolls upwards by the default step (96px)', () => {
    const next = calculateHudScrollTop(200, 1000, 400, -1);
    expect(next).toBe(104);
  });

  it('clamps to zero when scrolling upwards beyond the top', () => {
    const next = calculateHudScrollTop(50, 1000, 400, -1);
    expect(next).toBe(0);
  });

  it('clamps to maxScrollTop when scrolling downwards beyond the bottom', () => {
    // maxScrollTop = scrollHeight (1000) - clientHeight (400) = 600
    const next = calculateHudScrollTop(550, 1000, 400, 1);
    expect(next).toBe(600);
  });

  it('returns 0 if content is smaller than container viewport', () => {
    const next = calculateHudScrollTop(0, 300, 400, 1);
    expect(next).toBe(0);
  });

  it('respects a custom step size', () => {
    const next = calculateHudScrollTop(100, 1000, 400, 1, 50);
    expect(next).toBe(150);
  });
});

describe('attachHudWheelIsolation', () => {
  it('registers a non-passive wheel event listener and cleans up on unmount', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mockContainer = {
      addEventListener,
      removeEventListener,
    } as unknown as HTMLElement;

    const cleanup = attachHudWheelIsolation(mockContainer);

    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
  });

  it('stops event propagation and immediate propagation without calling preventDefault', () => {
    let capturedHandler: ((e: WheelEvent) => void) | null = null;
    const mockContainer = {
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'wheel') capturedHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    attachHudWheelIsolation(mockContainer);
    expect(capturedHandler).toBeTypeOf('function');

    const stopPropagation = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const preventDefault = vi.fn();

    const mockWheelEvent = {
      stopPropagation,
      stopImmediatePropagation,
      preventDefault,
    } as unknown as WheelEvent;

    capturedHandler!(mockWheelEvent);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    // Crucial: preventDefault must NOT be called so native scrolling in child views is preserved!
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
