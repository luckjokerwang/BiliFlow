import { describe, it, expect, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

import { mergeSettingsWithDefaults } from '../src/services/settingsService';
import { DEFAULT_SETTINGS } from '../src/constants';
import { DEFAULT_FEATURE_FLAGS } from '../src/types/settings';

describe('settingsService - mergeSettingsWithDefaults', () => {
  it('should return complete default settings with all feature flags on null or empty input', () => {
    const result = mergeSettingsWithDefaults(null);
    expect(result.autoSummarize).toBe(DEFAULT_FEATURE_FLAGS.autoSummarize);
    expect(result.minDurationForAutoSec).toBe(DEFAULT_FEATURE_FLAGS.minDurationForAutoSec);
    expect(result.showTimelineMarkers).toBe(DEFAULT_FEATURE_FLAGS.showTimelineMarkers);
    expect(result.showHoverCard).toBe(DEFAULT_FEATURE_FLAGS.showHoverCard);
    expect(result.enableNumberKeySeek).toBe(DEFAULT_FEATURE_FLAGS.enableNumberKeySeek);
    expect(result.autoFullscreenHud).toBe(DEFAULT_FEATURE_FLAGS.autoFullscreenHud);
    expect(result.showToasts).toBe(DEFAULT_FEATURE_FLAGS.showToasts);
    expect(result.defaultHudOpen).toBe(DEFAULT_FEATURE_FLAGS.defaultHudOpen);
    expect(result.providers.length).toBeGreaterThan(0);
  });

  it('should safely migrate legacy autoFetch: false to autoSummarize: false', () => {
    const legacySettings = {
      autoFetch: false,
      activeProviderId: 'deepseek',
    };
    const result = mergeSettingsWithDefaults(legacySettings);
    expect(result.autoSummarize).toBe(false);
    expect(result.autoFetch).toBe(false);
  });

  it('should prefer autoSummarize when explicitly set over autoFetch', () => {
    const mixedSettings = {
      autoFetch: true,
      autoSummarize: false,
    };
    const result = mergeSettingsWithDefaults(mixedSettings);
    expect(result.autoSummarize).toBe(false);
    expect(result.autoFetch).toBe(false);
  });

  it('should preserve customized feature flags and fall back on missing ones', () => {
    const custom = {
      autoSummarize: false,
      minDurationForAutoSec: 120,
      showHoverCard: false,
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com',
          apiKey: 'sk-my-secret-key',
          enabled: true,
          models: ['deepseek-chat'],
          selectedModel: 'deepseek-chat',
        },
      ],
      activeProviderId: 'deepseek',
    };
    const result = mergeSettingsWithDefaults(custom);
    expect(result.autoSummarize).toBe(false);
    expect(result.minDurationForAutoSec).toBe(120);
    expect(result.showHoverCard).toBe(false);
    // Missing flags should take defaults
    expect(result.showTimelineMarkers).toBe(true);
    expect(result.enableNumberKeySeek).toBe(true);
    expect(result.showToasts).toBe(true);
    expect(result.defaultHudOpen).toBe(false);
    // Custom provider and API key must be preserved
    expect(result.providers[0].apiKey).toBe('sk-my-secret-key');
  });

  it('should defensively guard against negative or invalid minDurationForAutoSec', () => {
    const invalidDuration = {
      minDurationForAutoSec: -50,
    };
    const result = mergeSettingsWithDefaults(invalidDuration);
    expect(result.minDurationForAutoSec).toBe(DEFAULT_FEATURE_FLAGS.minDurationForAutoSec);
  });

  it('getStoredSettings should query storage and merge defaults', async () => {
    const { getStoredSettings } = await import('../src/services/settingsService');
    const { browser } = await import('wxt/browser');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      user_settings: { autoSummarize: false },
    } as any);

    const settings = await getStoredSettings();
    expect(settings.autoSummarize).toBe(false);
    expect(settings.showTimelineMarkers).toBe(true);
  });

  it('saveStoredSettings should persist merged settings and return them', async () => {
    const { saveStoredSettings } = await import('../src/services/settingsService');
    const { browser } = await import('wxt/browser');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      user_settings: DEFAULT_SETTINGS,
    } as any);
    vi.mocked(browser.storage.local.set).mockResolvedValueOnce(undefined as any);

    const updated = await saveStoredSettings({ showHoverCard: false });
    expect(updated.showHoverCard).toBe(false);
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      user_settings: expect.objectContaining({ showHoverCard: false }),
    });
  });
});
