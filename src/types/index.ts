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

export interface OriginalQuote {
  timestamp: number;     // Start seconds
  timestampStr: string;  // "mm:ss"
  content: string;       // Original transcript content
}

export interface HighlightItem {
  id: number | string;
  timestamp: number;     // In seconds
  timestampSec?: number; // In seconds (alias for defensive compatibility)
  timestampStr: string;  // "mm:ss"
  title: string;         // Short headline (< 20 chars)
  keyPoint: string;      // 1-2 sentence core insight
  originalQuotes?: OriginalQuote[]; // 3-5 original transcript quotes around this highlight
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

export interface ResolvedVideoInfo {
  bvid: string;
  cid: string;
  aid: string;
  title: string;
  duration: number;
}

// ------------------------------------------
// Multi-Provider & Model Hub (Two-Tier Architecture)
// ------------------------------------------

export interface ProviderConfig {
  id: string;            // 'deepseek', 'sensenova', 'openai', or custom ID
  name: string;          // Human readable display name
  baseUrl: string;       // API endpoint base URL
  apiKey: string;        // User provided API Key (stored in local storage)
  enabled: boolean;
  models: string[];      // Curated/active models selected by user
  remoteModels?: string[]; // Full list of models fetched from provider /v1/models
  selectedModel: string; // Active model for summary generation
  fallbackModel?: string; // Fallback disaster-recovery model
  isCustom?: boolean;    // Whether user-created custom provider
  docUrl?: string;       // Link to get API Key / documentation
  icon?: string;         // Emoji or custom icon tag
}

export type ThemeMode = 'dark' | 'light';

export interface UserSettings {
  providers: ProviderConfig[];
  activeProviderId: string;
  activeModel?: string;
  enableFallback?: boolean;
  autoFetch?: boolean;
  shortcutToggle?: string;
  shortcutPrevNode?: string;
  shortcutNextNode?: string;
  shortcutToggleQuotes?: string;
  theme?: ThemeMode;
}

// ------------------------------------------
// Message Passing Contracts
// ------------------------------------------

export type MessageType =
  | 'RESOLVE_VIDEO_INFO'
  | 'FETCH_SUBTITLES'
  | 'GENERATE_SUMMARY'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_CACHED_SUMMARY'
  | 'TEST_PROVIDER_CONNECTION'
  | 'FETCH_PROVIDER_MODELS'
  | 'OPEN_OPTIONS_PAGE';

export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
