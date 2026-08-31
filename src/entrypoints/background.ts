import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { ExtensionMessage, ExtensionResponse, UserSettings, ResolvedVideoInfo } from '../types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from '../constants';
import { fetchBilibiliSubtitles } from '../services/bilibiliApi';
import {
  generateVideoSummary,
  fetchRemoteModels,
  testProviderConnection,
} from '../services/llmService';

export default defineBackground(() => {
  console.log('[BiliFlow] Background Service Worker initialized.');

  // Initialize or migrate user settings on install/update
  browser.runtime.onInstalled.addListener(async () => {
    const data = await browser.storage.local.get('user_settings');
    if (!data.user_settings) {
      await browser.storage.local.set({ user_settings: DEFAULT_SETTINGS });
    } else {
      const old: UserSettings = data.user_settings as UserSettings;
      if (!old.providers || !Array.isArray(old.providers)) {
        await browser.storage.local.set({ user_settings: DEFAULT_SETTINGS });
      } else {
        // Clean legacy hardcoded models from preset providers if never fetched
        let needsUpdate = false;
        const cleanedProviders = old.providers.map((p) => {
          if (!p.remoteModels || p.remoteModels.length === 0) {
            if ((p.models && p.models.length > 0) || p.selectedModel || p.fallbackModel) {
              needsUpdate = true;
              return {
                ...p,
                models: [],
                remoteModels: [],
                selectedModel: '',
                fallbackModel: '',
              };
            }
          }
          return p;
        });

        if (needsUpdate) {
          await browser.storage.local.set({
            user_settings: {
              ...old,
              providers: cleanedProviders,
            },
          });
        }
      }
    }
  });

  async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
    try {
      switch (message.type) {
        case 'RESOLVE_VIDEO_INFO': {
          const { bvid, pIndex = 1 } = message.payload;
          const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
            headers: {
              Accept: 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (!res.ok) {
            throw new Error(`获取视频信息失败: HTTP ${res.status}`);
          }
          const json = await res.json();
          if (json.code !== 0 || !json.data) {
            throw new Error(`B站接口返回错误 (${json.code}): ${json.message || '未知错误'}`);
          }

          const aid = String(json.data.aid || '');
          let cid = '';
          let title = json.data.title || '';
          let duration = json.data.duration || 0;

          const pages = json.data.pages || [];
          if (Array.isArray(pages) && pages.length > 0) {
            const targetPage = pages[pIndex - 1] || pages[0];
            cid = String(targetPage.cid);
            duration = targetPage.duration || duration;
            if (targetPage.part && pages.length > 1) {
              title = `${title} - ${targetPage.part}`;
            }
          } else {
            cid = String(json.data.cid || '');
          }

          const resolved: ResolvedVideoInfo = {
            bvid,
            cid,
            aid,
            title,
            duration,
          };

          return { success: true, data: resolved };
        }

        case 'FETCH_SUBTITLES': {
          const subtitles = await fetchBilibiliSubtitles(message.payload);
          return { success: true, data: subtitles };
        }

        case 'GENERATE_SUMMARY': {
          const { bvid, cid, title, subtitles } = message.payload;
          const settingsRes = await browser.storage.local.get('user_settings');
          const settings: UserSettings = (settingsRes.user_settings as UserSettings) || DEFAULT_SETTINGS;

          const activeProvider =
            settings.providers?.find((p) => p.id === settings.activeProviderId) ||
            settings.providers?.[0] ||
            DEFAULT_PROVIDERS[0];

          const summary = await generateVideoSummary({
            bvid,
            cid,
            title,
            subtitles,
            provider: activeProvider,
            model: settings.activeModel || activeProvider.selectedModel,
            enableFallback: settings.enableFallback ?? true,
          });

          // Cache summary in local storage
          const cacheKey = `summary_${bvid}_${cid}`;
          await browser.storage.local.set({ [cacheKey]: summary });

          return { success: true, data: summary };
        }

        case 'GET_CACHED_SUMMARY': {
          const { bvid, cid } = message.payload;
          const cacheKey = `summary_${bvid}_${cid}`;
          const cached = await browser.storage.local.get(cacheKey);
          return { success: true, data: cached[cacheKey] || null };
        }

        case 'GET_SETTINGS': {
          const res = await browser.storage.local.get('user_settings');
          return { success: true, data: (res.user_settings as UserSettings) || DEFAULT_SETTINGS };
        }

        case 'SAVE_SETTINGS': {
          const curRes = await browser.storage.local.get('user_settings');
          const updated: UserSettings = {
            ...((curRes.user_settings as UserSettings) || DEFAULT_SETTINGS),
            ...message.payload,
          };
          await browser.storage.local.set({ user_settings: updated });
          return { success: true, data: updated };
        }

        case 'FETCH_PROVIDER_MODELS': {
          const models = await fetchRemoteModels(message.payload);
          return { success: true, data: models };
        }

        case 'TEST_PROVIDER_CONNECTION': {
          const testResult = await testProviderConnection(message.payload);
          return { success: true, data: testResult };
        }

        case 'OPEN_OPTIONS_PAGE': {
          if (browser.runtime?.openOptionsPage) {
            browser.runtime.openOptionsPage();
          } else {
            browser.tabs.create({ url: browser.runtime.getURL('options.html') });
          }
          return { success: true, data: null };
        }

        default: {
          return { success: false, error: 'Unknown message type' };
        }
      }
    } catch (err: any) {
      console.error('[BiliFlow Background Error]:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Handle messages from content script & options/popup
  browser.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender,
      sendResponse: (response: ExtensionResponse) => void
    ) => {
      const p = handleMessage(message);
      p.then((res) => {
        try {
          if (typeof sendResponse === 'function') sendResponse(res);
        } catch (_) {}
      });
      return p;
    }
  );
});
