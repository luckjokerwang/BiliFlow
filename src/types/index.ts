// ==========================================
// BiliFlow Data Contracts & Types
// ==========================================

export interface BiliRawSubtitleItem {
  from: number; // Start timestamp in seconds (e.g. 0.22)
  to: number;   // End timestamp in seconds (e.g. 3.50)
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
  timestamp: number;     // In seconds (e.g. 154)
  timestampStr: string;  // "mm:ss" formatted (e.g. "02:34")
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
}

export interface LLMConfig {
  provider: 'deepseek' | 'gemini' | 'openai' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface UserSettings {
  llmConfig: LLMConfig;
  autoFetch: boolean;
  shortcutToggle: string;
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
    };

export type ExtensionResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
