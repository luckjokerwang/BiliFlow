export interface CommunityCommentItem {
  id: string;
  author: string;
  content: string;
  likeCount: number;
  replyCount: number;
  publishedAt: number;
  isPinned: boolean;
  isUpLiked: boolean;
}

export interface CommunityDanmakuItem {
  id: string;
  content: string;
  timestampSec: number;
  resonanceCount: number;
  heatRatio: number;
}

export interface CommunityDigest {
  bvid: string;
  cid: string;
  aid: string;
  comments: CommunityCommentItem[];
  danmaku: CommunityDanmakuItem[];
  commentTotal: number | null;
  danmakuSampleCount: number;
  errors: { comments?: string; danmaku?: string };
  fetchedAt: number;
}
