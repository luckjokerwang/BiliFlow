export type HudViewMode = 'summary' | 'transcript' | 'community';

const HUD_VIEW_ORDER: readonly HudViewMode[] = ['summary', 'transcript', 'community'];
export function getNextHudViewMode(mode: HudViewMode, reverse: boolean): HudViewMode {
  const index = HUD_VIEW_ORDER.indexOf(mode);
  const current = index >= 0 ? index : 0;
  const delta = reverse ? -1 : 1;
  return HUD_VIEW_ORDER[(current + delta + HUD_VIEW_ORDER.length) % HUD_VIEW_ORDER.length];
}

/**
 * Calculates smooth scrolling offset for HUD scrollable containers.
 */
export function calculateHudScrollTop(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  direction: -1 | 1,
  step = 96
): number {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  return Math.max(0, Math.min(maxScrollTop, scrollTop + direction * step));
}

/**
 * Attaches a native non-passive wheel event listener to isolate HUD scrolling
 * and prevent events from bubbling to the parent Bilibili player container.
 */
export function attachHudWheelIsolation(container: HTMLElement): () => void {
  const handleWheel = (e: WheelEvent) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  container.addEventListener('wheel', handleWheel, { passive: false });
  return () => {
    container.removeEventListener('wheel', handleWheel);
  };
}
