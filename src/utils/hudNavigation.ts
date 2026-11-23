export type HudViewMode = 'summary' | 'transcript' | 'community';

const HUD_VIEW_ORDER: readonly HudViewMode[] = ['summary', 'transcript', 'community'];
export function getNextHudViewMode(mode: HudViewMode, reverse: boolean): HudViewMode {
  const index = HUD_VIEW_ORDER.indexOf(mode);
  const current = index >= 0 ? index : 0;
  const delta = reverse ? -1 : 1;
  return HUD_VIEW_ORDER[(current + delta + HUD_VIEW_ORDER.length) % HUD_VIEW_ORDER.length];
}

