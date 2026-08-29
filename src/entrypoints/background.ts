import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessage, ExtensionResponse, ProviderConfig, UserSettings } from '../types';
import { fetchBilibiliSubtitles } from '../services/bilibiliApi';
import {
  generateVideoSummary,
  fetchRemoteModels,
  testProviderConnection,
} from '../services/llmService';

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek (官方)',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    enabled: true,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    selectedModel: 'deepseek-chat',
    docUrl: 'https://platform.deepseek.com/api_keys',
    icon: '⚡',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    enabled: true,
    models: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'THUDM/glm-4-9b-chat',
    ],
    selectedModel: 'deepseek-ai/DeepSeek-V3',
    docUrl: 'https://cloud.siliconflow.cn/account/ak',
    icon: '🌊',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    enabled: true,
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    selectedModel: 'gemini-2.5-flash',
    docUrl: 'https://aistudio.google.com/app/apikey',
    icon: '✨',
  },
  {
    id: 'openai',
    name: 'OpenAI (官方)',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    enabled: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    selectedModel: 'gpt-4o-mini',
    docUrl: 'https://platform.openai.com/api-keys',
    icon: '🤖',
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: '',
    enabled: true,
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    selectedModel: 'moonshot-v1-8k',
    docUrl: 'https://platform.moonshot.cn/console/api-keys',
    icon: '🌙',
  },
  {
    id: 'zhipu',
    name: '智谱 BigModel (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: '',
    enabled: true,
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air'],
    selectedModel: 'glm-4-flash',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    icon: '🧠',
  },
  {
    id: 'ollama',
    name: 'Ollama (本地模型)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    enabled: true,
    models: ['deepseek-r1:7b', 'qwen2.5:7b', 'llama3.1'],
    selectedModel: 'deepseek-r1:7b',
    docUrl: 'https://ollama.com',
    icon: '🦙',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    enabled: true,
    models: [
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-flash-1.5',
    ],
    selectedModel: 'deepseek/deepseek-chat',
    docUrl: 'https://openrouter.ai/keys',
    icon: '🌐',
  },
];

export const DEFAULT_SETTINGS: UserSettings = {
  providers: DEFAULT_PROVIDERS,
  activeProviderId: 'deepseek',
  activeModel: 'deepseek-chat',
  autoFetch: true,
  shortcutToggle: 'Alt+S',
};

export default defineBackground(() => {
  console.log('[BiliFlow] Background Service Worker initialized.');

  // Initialize or migrate user settings on install/update
  chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.local.get('user_settings');
    if (!data.user_settings) {
      await chrome.storage.local.set({ user_settings: DEFAULT_SETTINGS });
    } else {
      // Migrate from old single llmConfig format if needed
      const old = data.user_settings;
      if (!old.providers || !Array.isArray(old.providers)) {
        await chrome.storage.local.set({ user_settings: DEFAULT_SETTINGS });
      }
    }
  });

  // Handle messages from content script & options/popup
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
              const updated: UserSettings = {
                ...(curRes.user_settings || DEFAULT_SETTINGS),
                ...message.payload,
              };
              await chrome.storage.local.set({ user_settings: updated });
              sendResponse({ success: true, data: updated });
              break;
            }

            case 'FETCH_PROVIDER_MODELS': {
              const models = await fetchRemoteModels(message.payload);
              sendResponse({ success: true, data: models });
              break;
            }

            case 'TEST_PROVIDER_CONNECTION': {
              const testResult = await testProviderConnection(message.payload);
              sendResponse({ success: true, data: testResult });
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
