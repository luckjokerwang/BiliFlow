export interface ScrollAlignOptions {
  behavior?: ScrollBehavior;
  onlyIfOutside?: boolean;
  viewportRatio?: number;
  comfortMarginPx?: number;
}

const COMFORT_MARGIN_PX = 8;
const DEFAULT_VIEWPORT_RATIO = 0.3;

/**
 * Aligns `target` at `viewportRatio` of `container`'s visible area, clamped to
 * the container's scrollable range. Uses getBoundingClientRect so nested
 * offsetParent chains cannot skew the result.
 */
export function alignElementInViewport(
  container: HTMLElement,
  target: HTMLElement,
  options: ScrollAlignOptions = {}
): void {
  const {
    behavior = 'auto',
    onlyIfOutside = false,
    viewportRatio = DEFAULT_VIEWPORT_RATIO,
    comfortMarginPx = COMFORT_MARGIN_PX,
  } = options;

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  if (onlyIfOutside) {
    const comfortablyVisible =
      targetRect.top >= containerRect.top + comfortMarginPx &&
      targetRect.bottom <= containerRect.bottom - comfortMarginPx;
    if (comfortablyVisible) return;
  }

  const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
  const desired =
    relativeTop - container.clientHeight * viewportRatio + target.clientHeight / 2;
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const top = Math.min(maxScrollTop, Math.max(0, desired));

  container.scrollTo({ top, behavior });
}
