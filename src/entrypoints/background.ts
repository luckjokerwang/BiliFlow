import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessage, ExtensionResponse, UserSettings } from '../types';
import { fetchBilibiliSubtitles } from '../services/bilibiliApi';
import { generateVideoSummary } from '../services/llmService';

const DEFAULT_SETTINGS: UserSettings = {
  llmConfig: {
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  autoFetch: true,
  shortcutToggle: 'Alt+S',
};

export default defineBackground(() => {
  console.log('[BiliFlow] Background Service Worker initialized.');

  // Initialize default settings if not set
  chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.local.get('user_settings');
    if (!data.user_settings) {
      await chrome.storage.local.set({ user_settings: DEFAULT_SETTINGS });
    }
  });

  // Handle messages from content script & popup
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender,
      sendResponse: (response: ExtensionResponse) => void
    ) => {
      (async () => {
        try {
          switch (message.type) {
            case 'FETCH_SUBTITLES': {
              const subtitles = await fetchBilibiliSubtitles(message.payload);
              sendResponse({ success: true, data: subtitles });
              break;
            }

            case 'GENERATE_SUMMARY': {
              const { bvid, cid, title, subtitles } = message.payload;
              const settingsRes = await chrome.storage.local.get('user_settings');
              const settings: UserSettings = settingsRes.user_settings || DEFAULT_SETTINGS;

              const summary = await generateVideoSummary({
                bvid,
                cid,
                title,
                subtitles,
                config: settings.llmConfig,
              });

              // Cache summary in local storage
              const cacheKey = `summary_${bvid}_${cid}`;
              await chrome.storage.local.set({ [cacheKey]: summary });

              sendResponse({ success: true, data: summary });
              break;
            }

            case 'GET_CACHED_SUMMARY': {
              const { bvid, cid } = message.payload;
              const cacheKey = `summary_${bvid}_${cid}`;
              const cached = await chrome.storage.local.get(cacheKey);
              sendResponse({ success: true, data: cached[cacheKey] || null });
              break;
            }

            case 'GET_SETTINGS': {
              const res = await chrome.storage.local.get('user_settings');
              sendResponse({ success: true, data: res.user_settings || DEFAULT_SETTINGS });
              break;
            }

            case 'SAVE_SETTINGS': {
              const curRes = await chrome.storage.local.get('user_settings');
              const updated = { ...(curRes.user_settings || DEFAULT_SETTINGS), ...message.payload };
              await chrome.storage.local.set({ user_settings: updated });
              sendResponse({ success: true, data: updated });
              break;
            }

            default: {
              sendResponse({ success: false, error: 'Unknown message type' });
            }
          }
        } catch (err: any) {
          console.error('[BiliFlow Background Error]:', err);
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();

      return true; // Keep message channel open for async response
    }
  );
});
