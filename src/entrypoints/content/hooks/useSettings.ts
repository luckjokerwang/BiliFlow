import { useState, useEffect, useCallback } from 'react';
import { UserSettings } from '../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../constants';
import {
  getStoredSettings,
  saveStoredSettings,
  subscribeSettingsChange,
} from '../../../services/settingsService';

export interface UseSettingsReturn {
  settings: UserSettings;
  isReady: boolean;
  updateSettings: (partial: Partial<UserSettings>) => Promise<UserSettings>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    getStoredSettings().then((loaded) => {
      if (isMounted) {
        setSettings(loaded);
        setIsReady(true);
      }
    });

    const unsubscribe = subscribeSettingsChange((newSettings) => {
      if (isMounted) {
        setSettings(newSettings);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>): Promise<UserSettings> => {
      // Optimistic update
      setSettings((prev) => ({ ...prev, ...partial }));
      const saved = await saveStoredSettings(partial);
      setSettings(saved);
      return saved;
    },
    []
  );

  return { settings, isReady, updateSettings };
}
