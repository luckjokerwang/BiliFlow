// ==========================================
// BiliFlow Native Note & Reflection Types
// ==========================================

import { VideoSummaryResult } from './index';

export type UserAnnotationType = 'insight' | 'question' | 'action' | 'keypoint';

export interface UserAnnotation {
  id: string;
  timestamp: number;          // In seconds
  timestampStr: string;       // "mm:ss"
  type: UserAnnotationType;   // 'insight' (💡), 'question' (❓), 'action' (🎯), 'keypoint' (⭐)
  content: string;            // User's personal reflection or thought
  highlightId?: number | string; // Bound highlight card ID
  hasScreenshot?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Standard Quill Delta Operation used by Bilibili Native Notes */
export interface QuillDeltaOp {
  insert: string | Record<string, any>;
  attributes?: {
    bold?: boolean;
    header?: number;
    blockquote?: boolean;
    list?: 'bullet' | 'ordered';
    link?: string;
    italic?: boolean;
    [key: string]: any;
  };
}

/** Combined Study Note: AI Factual Summary + User Subjective Thoughts */
export interface VideoStudyNote {
  bvid: string;
  cid: string;
  aid?: string;
  title: string;
  summary: VideoSummaryResult;
  annotations: UserAnnotation[];
}
