import { browser } from 'wxt/browser';
import { UserSettings, DEFAULT_FEATURE_FLAGS, FeatureFlags } from '../types/settings';
import { DEFAULT_SETTINGS, DEFAULT_PROVIDERS } from '../constants';

/**
 * Safely merges raw stored settings with defaults, providing 100% backward-compatibility
 * and resilient fallbacks for corrupted or missing fields.
 */
export function mergeSettingsWithDefaults(raw: any): UserSettings {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  // 1. Backward compatibility: autoFetch -> autoSummarize
  let autoSummarize = DEFAULT_FEATURE_FLAGS.autoSummarize;
  if (typeof raw.autoSummarize === 'boolean') {
    autoSummarize = raw.autoSummarize;
  } else if (typeof raw.autoFetch === 'boolean') {
    autoSummarize = raw.autoFetch;
  }

  // 2. Feature Flags safe extraction with defaults
  const featureFlags: FeatureFlags = {
    autoSummarize,
    minDurationForAutoSec:
      typeof raw.minDurationForAutoSec === 'number' && raw.minDurationForAutoSec >= 0
        ? raw.minDurationForAutoSec
        : DEFAULT_FEATURE_FLAGS.minDurationForAutoSec,
    showTimelineMarkers:
      typeof raw.showTimelineMarkers === 'boolean'
        ? raw.showTimelineMarkers
        : DEFAULT_FEATURE_FLAGS.showTimelineMarkers,
    showHoverCard:
      typeof raw.showHoverCard === 'boolean'
        ? raw.showHoverCard
        : DEFAULT_FEATURE_FLAGS.showHoverCard,
    enableNumberKeySeek:
      typeof raw.enableNumberKeySeek === 'boolean'
        ? raw.enableNumberKeySeek
        : DEFAULT_FEATURE_FLAGS.enableNumberKeySeek,
    autoFullscreenHud:
      typeof raw.autoFullscreenHud === 'boolean'
        ? raw.autoFullscreenHud
        : DEFAULT_FEATURE_FLAGS.autoFullscreenHud,
    showToasts:
      typeof raw.showToasts === 'boolean'
        ? raw.showToasts
        : DEFAULT_FEATURE_FLAGS.showToasts,
    defaultHudOpen:
      typeof raw.defaultHudOpen === 'boolean'
        ? raw.defaultHudOpen
        : DEFAULT_FEATURE_FLAGS.defaultHudOpen,
  };

  // 3. Providers defensive fallback
  const providers =
    Array.isArray(raw.providers) && raw.providers.length > 0
      ? raw.providers
      : JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    ...featureFlags,
    autoFetch: autoSummarize, // keep legacy field synchronized
    providers,
    activeProviderId: raw.activeProviderId || DEFAULT_SETTINGS.activeProviderId,
    activeModel: typeof raw.activeModel === 'string' ? raw.activeModel : DEFAULT_SETTINGS.activeModel,
    enableFallback: typeof raw.enableFallback === 'boolean' ? raw.enableFallback : DEFAULT_SETTINGS.enableFallback,
    theme: raw.theme === 'light' ? 'light' : 'dark',
  };
}

/**
 * Loads current settings from browser.storage.local with defaults merged.
 */
export async function getStoredSettings(): Promise<UserSettings> {
  try {
    if (!browser?.storage?.local) {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    const data = await browser.storage.local.get('user_settings');
    return mergeSettingsWithDefaults(data.user_settings);
  } catch (err) {
    console.warn('[BiliFlow] Failed to load stored settings, using defaults:', err);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

/**
 * Merges partial settings and saves to browser.storage.local.
 */
export async function saveStoredSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getStoredSettings();
  const updated: UserSettings = mergeSettingsWithDefaults({
    ...current,
    ...partial,
  });

  if (browser?.storage?.local) {
    await browser.storage.local.set({ user_settings: updated });
  }

  return updated;
}

/**
 * Subscribes to settings changes from any extension page (Options, Popup, Background).
 */
export function subscribeSettingsChange(
  callback: (settings: UserSettings) => void
): () => void {
  if (!browser?.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes: any, areaName: string) => {
    if (areaName === 'local' && changes.user_settings) {
      const merged = mergeSettingsWithDefaults(changes.user_settings.newValue);
      callback(merged);
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
