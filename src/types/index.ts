// ==========================================
// BiliFlow Data Contracts & Types (v0.3)
// ==========================================

export interface BiliRawSubtitleItem {
  from: number; // Start timestamp in seconds
  to: number;   // End timestamp in seconds
  content: string;
}

export interface BiliSubtitleResponse {
  code: number;
  message: string;
  data?: {
    subtitle?: {
      subtitles?: Array<{
        id: number;
        lan: string;
        lan_doc: string;
        subtitle_url: string;
        type?: number;
        ai_type?: number;
        ai_status?: number;
      }>;
    };
  };
}

export interface TranscriptChunk {
  startTime: number;
  endTime: number;
  timestampStr: string;
  text: string;
}

export interface HighlightItem {
  id: number;
  timestamp: number;     // In seconds
  timestampStr: string;  // "mm:ss"
  title: string;         // Short headline (< 20 chars)
  keyPoint: string;      // 1-2 sentence core insight
}

export interface VideoSummaryResult {
  bvid: string;
  cid: string;
  title: string;
  oneSentenceSummary: string;
  highlights: HighlightItem[];
  followUpQuestions?: string[];
  createdAt: number;
  usedModel?: string;    // Actual model used (useful when fallback triggered)
  isFallbackUsed?: boolean;
}

// ------------------------------------------
// Multi-Provider & Model Hub (Two-Tier Architecture)
// ------------------------------------------

export interface ProviderConfig {
  id: string;              // Unique provider ID (e.g. 'deepseek', 'sensenova', 'custom-ollama')
  name: string;            // Display name
  baseUrl: string;         // Base URL (e.g. 'https://token.sensenova.cn/v1')
  apiKey: string;          // API Key
  enabled: boolean;
  models: string[];        // User-curated active models shown in UI
  remoteModels?: string[]; // Full list of models fetched from /v1/models (for picker modal)
  selectedModel: string;   // Primary selected model
  fallbackModel?: string;  // Fallback model if primary model fails
  isCustom?: boolean;
  docUrl?: string;
  icon?: string;
}

export type ThemeMode = 'dark' | 'light';

export interface UserSettings {
  providers: ProviderConfig[];
  activeProviderId: string;
  activeModel: string;
  enableFallback: boolean; // Auto failover to fallback model on failure
  fallbackProviderId?: string;
  shortcutToggle: string;  // e.g. 'Alt+S' or 'Ctrl+Shift+B'
  theme: ThemeMode;        // 'dark' | 'light'
}

// ------------------------------------------
// Manifest V3 Typed Message Protocol
// ------------------------------------------

export type ExtensionMessage =
  | {
      type: 'FETCH_SUBTITLES';
      payload: { bvid: string; cid: string; aid?: string };
    }
  | {
      type: 'GENERATE_SUMMARY';
      payload: {
        bvid: string;
        cid: string;
        title: string;
        subtitles: BiliRawSubtitleItem[];
      };
    }
  | {
      type: 'GET_CACHED_SUMMARY';
      payload: { bvid: string; cid: string };
    }
  | {
      type: 'GET_SETTINGS';
    }
  | {
      type: 'SAVE_SETTINGS';
      payload: Partial<UserSettings>;
    }
  | {
      type: 'FETCH_PROVIDER_MODELS';
      payload: { baseUrl: string; apiKey: string };
    }
  | {
      type: 'TEST_PROVIDER_CONNECTION';
      payload: { baseUrl: string; apiKey: string; model?: string };
    }
  | {
      type: 'OPEN_OPTIONS_PAGE';
    };

export type ExtensionResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
