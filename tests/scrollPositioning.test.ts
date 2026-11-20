import { describe, it, expect, vi, type Mock } from 'vitest';
import { alignElementInViewport, ScrollAlignOptions } from '../src/utils/scrollPositioning';

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };

function makeContainer(scrollTop: number, clientHeight: number, scrollHeight: number) {
  const rect = { top: 100, bottom: 100 + clientHeight, left: 0, right: 370, width: 370, height: clientHeight } as Rect;
  const scrollTo = vi.fn();
  const container = {
    getBoundingClientRect: () => rect,
    scrollTop,
    clientHeight,
    scrollHeight,
    scrollTo,
  } as unknown as HTMLElement;
  return { container, scrollTo, rect };
}

function makeTarget(top: number, height: number) {
  const rect = { top, bottom: top + height, left: 0, right: 350, width: 350, height } as Rect;
  return {
    target: {
      getBoundingClientRect: () => rect,
      clientHeight: height,
      // Offset values that must not be used by the helper.
      offsetTop: 9999,
    } as unknown as HTMLElement,
    rect,
  };
}

function lastTop(scrollTo: Mock): number {
  return scrollTo.mock.calls[scrollTo.mock.calls.length - 1][0].top;
}

describe('alignElementInViewport', () => {
  it('aligns the target at 30% of the container viewport', () => {
    const { container, scrollTo } = makeContainer(0, 400, 4000);
    // Container top 100; target top 500 -> relativeTop = 500 - 100 + 0 = 400.
    // Desired = 400 - 400 * 0.3 + 20/2 = 290.
    const { target } = makeTarget(500, 20);
    alignElementInViewport(container, target, { behavior: 'auto' });
    expect(lastTop(scrollTo)).toBe(290);
    expect(scrollTo.mock.calls[0][0].behavior).toBe('auto');
  });

  it('clamps to zero at the top', () => {
    const { container, scrollTo } = makeContainer(200, 400, 4000);
    const { target } = makeTarget(10, 20);
    alignElementInViewport(container, target);
    expect(lastTop(scrollTo)).toBe(0);
  });

  it('clamps to the maximum scrollTop at the bottom', () => {
    const { container, scrollTo } = makeContainer(0, 400, 1000);
    const { target } = makeTarget(1500, 20);
    alignElementInViewport(container, target);
    expect(lastTop(scrollTo)).toBe(600);
  });

  it('does not scroll when the target is comfortably visible and onlyIfOutside is set', () => {
    const { container, scrollTo } = makeContainer(100, 400, 4000);
    const { target } = makeTarget(200, 40);
    const options: ScrollAlignOptions = { onlyIfOutside: true };
    alignElementInViewport(container, target, options);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls when the target is partially outside the comfort zone', () => {
    const { container, scrollTo } = makeContainer(100, 400, 4000);
    const { target } = makeTarget(95, 40);
    alignElementInViewport(container, target, { onlyIfOutside: true });
    expect(scrollTo).toHaveBeenCalled();
  });

  it('ignores offsetTop and uses getBoundingClientRect', () => {
    const { container, scrollTo } = makeContainer(0, 400, 4000);
    const { target } = makeTarget(500, 20);
    alignElementInViewport(container, target);
    // If offsetTop (9999) were used, result would be far from 290.
    expect(lastTop(scrollTo)).toBe(290);
  });
});
