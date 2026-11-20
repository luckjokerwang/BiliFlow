import { CommunityCommentItem, CommunityDanmakuItem } from '../types';
import { DanmakuHeatmapPeak } from './danmakuHeatmap';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface FeaturedCommentCandidate extends CommunityCommentItem {
  raw: UnknownRecord;
  fromPinnedUpper: boolean;
}

export function normalizeComment(raw: unknown, fromPinnedUpper: boolean): FeaturedCommentCandidate | null {
  const record = asRecord(raw);
  if (!record) return null;
  const member = asRecord(record.member);
  const content = asRecord(record.content);
  const replyControl = asRecord(record.reply_control);
  const upAction = asRecord(record.up_action);

  const id = String(record.rpid ?? '');
  const author = stringValue(member?.uname) || '匿名网友';
  const text = stringValue(content?.message);
  if (!id || !text) return null;

  const likeCount = finiteNumber(record.like) ?? 0;
  const replyCount = finiteNumber(record.rcount) ?? 0;
  const publishedAt = finiteNumber(record.ctime) ?? 0;
  const isUpLiked = Boolean(upAction?.like || replyControl?.is_up_liked);
  const isPinned = Boolean(replyControl?.is_up_top) || fromPinnedUpper;

  return {
    id,
    author,
    content: text,
    likeCount,
    replyCount,
    publishedAt,
    isPinned,
    isUpLiked,
    raw: record,
    fromPinnedUpper,
  };
}

/** Ranks comments by pinned, UP-like, likes, replies, then oldest first; caps at 12. */
/** Ranks already-normalized comments; used after the service merges pinned sources. */
export function rankFeaturedComments(
  candidates: CommunityCommentItem[]
): CommunityCommentItem[] {
  return candidates
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.isUpLiked !== b.isUpLiked) return a.isUpLiked ? -1 : 1;
      if (a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
      if (a.replyCount !== b.replyCount) return b.replyCount - a.replyCount;
      return a.publishedAt - b.publishedAt;
    })
    .slice(0, 12);
}

export function selectFeaturedComments(rawComments: unknown[]): CommunityCommentItem[] {
  const seen = new Set<string>();
  const candidates: FeaturedCommentCandidate[] = [];
  for (const raw of rawComments) {
    const record = normalizeComment(raw, false);
    if (!record || record.raw.state === 17 || record.raw.invisible === true) continue;
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    candidates.push(record);
  }

  return rankFeaturedComments(
    candidates.map(({ raw: _raw, fromPinnedUpper: _pinned, ...item }) => item)
  );
}

function normalizedText(content: string): string {
  return content.trim().replace(/\s+/g, '').toLowerCase();
}

/** Ranks danmaku by resonance plus nearby heat, dedupes identical text, caps at 20. */
export function selectFeaturedDanmaku(
  items: CommunityDanmakuItem[],
  peaks: DanmakuHeatmapPeak[] = []
): CommunityDanmakuItem[] {
  const earliestByText = new Map<string, CommunityDanmakuItem>();
  for (const item of items) {
    if (typeof item?.content !== 'string') continue;
    const key = normalizedText(item.content);
    if (!key) continue;
    const existing = earliestByText.get(key);
    if (!existing || item.timestampSec < existing.timestampSec) {
      earliestByText.set(key, item);
    }
  }

  const ranked = Array.from(earliestByText.values()).map((item) => {
    const heatRatio = peaks.reduce((best, peak) => {
      if (Math.abs(peak.timestampSec - item.timestampSec) > 15) return best;
      return Math.max(best, peak.densityRatio);
    }, 0);
    return {
      ...item,
      heatRatio,
      resonanceCount: Math.max(1, item.resonanceCount),
    };
  });

  ranked.sort((a, b) => {
    const scoreA = Math.log1p(a.resonanceCount) + a.heatRatio;
    const scoreB = Math.log1p(b.resonanceCount) + b.heatRatio;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.timestampSec - b.timestampSec;
  });

  return ranked
    .slice(0, 20)
    .sort((a, b) => a.timestampSec - b.timestampSec);
}
