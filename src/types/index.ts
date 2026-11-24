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

export interface TranscriptWindow {
  startTime: number;
  endTime: number;
  timestampStr: string;
  items: BiliRawSubtitleItem[];
  text: string;
}

export interface OriginalQuote {
  timestamp: number;     // Start seconds
  timestampStr: string;  // "mm:ss"
  content: string;       // Original transcript content
}

export interface MapPhaseResult {
  summary: string;
  keyPoints: Array<{ timestamp: number; timestampStr: string; text: string }>;
  punchlineQuotes: OriginalQuote[];
}

export interface HighlightItem {
  id: number | string;
  timestamp?: number;    // In seconds
  timestampSec?: number; // In seconds (alias for defensive compatibility)
  timestampStr: string;  // "mm:ss"
  title: string;         // Short headline (< 20 chars)
  keyPoint?: string;     // 1-2 sentence core insight
  originalQuotes?: OriginalQuote[]; // 3-5 original transcript quotes around this highlight
}

export type CreatorChapterSource = 'official' | 'description';

export interface CreatorChapter {
  from: number;
  to: number;
  title: string;
}


export type VideoCategoryKey =
  | 'cinephile'
  | 'entertainment'
  | 'music'
  | 'dance'
  | 'douga'
  | 'painting'
  | 'kichiku'
  | 'game'
  | 'information'
  | 'knowledge'
  | 'ai'
  | 'tech'
  | 'car'
  | 'fashion'
  | 'home'
  | 'outdoors'
  | 'gym'
  | 'sports'
  | 'handmake'
  | 'food'
  | 'shortplay'
  | 'travel'
  | 'rural'
  | 'animal'
  | 'parenting'
  | 'health'
  | 'emotion'
  | 'mysticism'
  | 'vlog'
  | 'life_joy'
  | 'life_experience'
  | 'anime'
  | 'guochuang'
  | 'documentary'
  | 'movie'
  | 'tv'
  | 'life';

export interface VideoCategoryInfo {
  key: VideoCategoryKey;
  label: string;
  rawName?: string;
}

export interface VideoSummaryResult {
  bvid: string;
  cid: string;
  title: string;
  oneSentenceSummary: string;
  highlights: HighlightItem[];
  followUpQuestions?: string[];
  glossary?: Array<{ term: string; definition: string }>;
  actionableTakeaways?: string[];
  punchlineQuotes?: OriginalQuote[];
  createdAt: number;
  schemaVersion: 2;
  usedModel?: string;    // Actual model used (useful when fallback triggered)
  usedProviderName?: string; // Actual provider name used (useful when cross-provider fallback triggered)
  isFallbackUsed?: boolean;
  chapterSource?: CreatorChapterSource;


}

export interface ResolvedVideoInfo {
  bvid: string;
  cid: string;
  aid: string;
  title: string;
  duration: number;
  description?: string;
  tid?: number;
  tidV2?: number;
  tname?: string;
  tnameV2?: string;
  category?: VideoCategoryInfo | null;
}

export interface VideoPreflightMetadata {
  officialChapters?: CreatorChapter[];
  danmakuHeatmapPeaks?: Array<{ timestampSec: number; densityRatio: number }>;
  descriptionTimestamps?: Array<{ seconds: number; title: string }>;
  description?: string;
}


// Per-highlight playback resume position
export interface HighlightPlaybackPosition {
  positionSec: number;
  updatedAt: number;
}
export type VideoPlaybackPositions = Record<string, HighlightPlaybackPosition>;
// HUD navigation
export type { HudViewMode } from '../utils/hudNavigation';
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
  fallbackProviderId?: string; // Fallback provider ID (for cross-provider disaster recovery)
  fallbackModel?: string; // Fallback disaster-recovery model
  isCustom?: boolean;    // Whether user-created custom provider
  docUrl?: string;       // Link to get API Key / documentation
  icon?: string;         // Emoji or custom icon tag
}

export type ThemeMode = 'dark' | 'light';

// ------------------------------------------
// Summary Cache Contracts (LRU)
// ------------------------------------------

export interface CacheIndexEntry {
  key: string;         // e.g. "summary_BV123_456"
  bvid: string;
  cid: string;
  title: string;
  updatedAt: number;   // Epoch timestamp for LRU
  sizeEstimatedBytes: number;
}

export interface CacheStats {
  count: number;
  totalEstimatedBytes: number;
  maxLimit: number;
}

export * from './settings';
export * from './community';
export * from './biliNote';

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
  | 'OPEN_OPTIONS_PAGE'
  | 'GET_CACHE_STATS'
  | 'CLEAR_CACHE'
  | 'DELETE_CACHED_SUMMARY'
  | 'FETCH_COMMUNITY_DIGEST';

export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
