import {
  CommunityCommentItem,
  CommunityDanmakuItem,
  CommunityDigest,
} from '../types';
import {
  buildBiliUrl,
  fetchDanmakuHeatmapPeaks,
  fetchJsonWithTimeout,
  makeHeaders,
} from './bilibiliApi';
import {
  normalizeComment,
  rankFeaturedComments,
  selectFeaturedDanmaku,
} from '../utils/communityRanking';
import { parseDanmakuXml } from '../utils/danmakuXml';

type UnknownRecord = Record<string, unknown>;

export interface FetchCommunityDigestPayload {
  bvid: string;
  cid: string;
  aid: string;
  durationSec: number;
}

interface CommentSortResult {
  replies: unknown[];
  upperTop: unknown[];
  topReplies: unknown[];
  total: number | null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function isHiddenReply(reply: unknown): boolean {
  const record = asRecord(reply);
  if (!record) return true;
  if (record.state === 17 || record.invisible === true) return true;
  return false;
}

export async function fetchCommentSort(
  bvid: string,
  aid: string,
  sort: 1 | 2,
  pages: number[] = [1, 2, 3]
): Promise<CommentSortResult> {
  const fetchSinglePage = async (pn: number) => {
    const url = buildBiliUrl('/x/v2/reply', {
      type: '1',
      oid: aid,
      sort: String(sort),
      ps: '20',
      pn: String(pn),
    });
    const data = await fetchJsonWithTimeout<UnknownRecord>(url, makeHeaders(bvid));
    if (data.code !== 0) throw new Error(`评论接口返回 ${data.code}`);
    return asRecord(data.data) || {};
  };

  const results = await Promise.allSettled(pages.map((pn) => fetchSinglePage(pn)));
  const successfulData = results
    .filter((r): r is PromiseFulfilledResult<UnknownRecord> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (successfulData.length === 0) {
    const firstRejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw firstRejected ? firstRejected.reason : new Error('评论接口请求失败');
  }

  let total: number | null = null;
  const seenRpids = new Set<string>();
  const replies: unknown[] = [];
  const upperTop: unknown[] = [];
  const topReplies: unknown[] = [];

  const addUnique = (targetList: unknown[], item: unknown) => {
    if (isHiddenReply(item)) return;
    const rec = asRecord(item);
    const rpid = rec ? String(rec.rpid ?? '') : '';
    if (rpid) {
      if (seenRpids.has(rpid)) return;
      seenRpids.add(rpid);
    }
    targetList.push(item);
  };

  for (const pageData of successfulData) {
    const page = asRecord(pageData.page);
    if (total === null && page && typeof page.count === 'number' && Number.isFinite(page.count)) {
      total = page.count;
    }

    const upper = asRecord(pageData.upper);
    if (upper && Array.isArray(upper.top)) {
      upper.top.forEach((item) => addUnique(upperTop, item));
    }

    if (Array.isArray(pageData.top_replies)) {
      pageData.top_replies.forEach((item) => addUnique(topReplies, item));
    }

    if (Array.isArray(pageData.replies)) {
      pageData.replies.forEach((item) => addUnique(replies, item));
    }
  }

  return { replies, upperTop, topReplies, total };
}

async function fetchComments(
  bvid: string,
  aid: string
): Promise<{ comments: CommunityCommentItem[]; total: number | null; error?: string }> {
  if (!aid) {
    return { comments: [], total: null, error: '缺少视频 aid，无法加载评论' };
  }
  // Sequential first-page requests reduce the chance of Bilibili rate limiting.
  const likeResult = await fetchCommentSort(bvid, aid, 1).then(
    (value) => ({ ok: true as const, value }),
    (reason) => ({ ok: false as const, reason })
  );
  const replyResult = await fetchCommentSort(bvid, aid, 2).then(
    (value) => ({ ok: true as const, value }),
    (reason) => ({ ok: false as const, reason })
  );

  if (!likeResult.ok && !replyResult.ok) {
    throw new Error('评论数据加载失败');
  }

  const total = likeResult.ok
    ? likeResult.value.total
    : replyResult.ok
    ? replyResult.value.total
    : null;

  const seen = new Set<string>();
  const candidates: CommunityCommentItem[] = [];
  const add = (raw: unknown, pinned: boolean) => {
    const normalized = normalizeComment(raw, pinned);
    if (!normalized || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    const { raw: _raw, fromPinnedUpper: _pinned, ...item } = normalized;
    candidates.push(item);
  };

  for (const result of [likeResult, replyResult]) {
    if (!result.ok) continue;
    result.value.upperTop.forEach((raw) => add(raw, true));
    result.value.topReplies.forEach((raw) => add(raw, true));
    result.value.replies.forEach((raw) => add(raw, false));
  }

  return {
    comments: rankFeaturedComments(candidates),
    total,
    error: !likeResult.ok || !replyResult.ok ? '部分评论排序加载失败' : undefined,
  };
}

async function fetchDanmakuText(bvid: string, cid: string): Promise<string> {
  const url = buildBiliUrl('/x/v1/dm/list.so', { oid: cid });
  const response = await fetch(url, {
    headers: { ...makeHeaders(bvid), Accept: 'application/xml, text/xml, */*' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function fetchCommunityDigest(
  payload: FetchCommunityDigestPayload
): Promise<CommunityDigest> {
  const { bvid, cid, aid, durationSec } = payload;
  if (!bvid || !cid) throw new Error('缺少视频标识参数 (bvid 或 cid 为空)');

  const errors: CommunityDigest['errors'] = {};

  const [commentsResult, danmakuResult] = await Promise.allSettled([
    fetchComments(bvid, aid),
    (async () => {
      const [xmlResult, heatResult] = await Promise.allSettled([
        fetchDanmakuText(bvid, cid),
        fetchDanmakuHeatmapPeaks({ bvid, cid, aid }),
      ]);
      if (xmlResult.status === 'rejected') throw xmlResult.reason;
      const parsed = parseDanmakuXml(xmlResult.value, durationSec);
      const peaks = heatResult.status === 'fulfilled' ? heatResult.value || [] : [];
      return {
        danmaku: selectFeaturedDanmaku(
          parsed.map((item) => ({
            id: item.id,
            content: item.content,
            timestampSec: item.timestampSec,
            resonanceCount: 1,
            heatRatio: 0,
          })),
          peaks
        ),
        sampleCount: parsed.length,
        heatError: heatResult.status === 'rejected',
      };
    })(),
  ]);

  if (commentsResult.status === 'rejected' && danmakuResult.status === 'rejected') {
    throw new Error('社区精选数据加载失败');
  }

  let comments: CommunityCommentItem[] = [];
  let commentTotal: number | null = null;
  if (commentsResult.status === 'fulfilled') {
    comments = commentsResult.value.comments;
    commentTotal = commentsResult.value.total;
    if (commentsResult.value.error) errors.comments = commentsResult.value.error;
  } else {
    errors.comments = '评论数据加载失败';
  }

  let danmaku: CommunityDanmakuItem[] = [];
  let danmakuSampleCount = 0;
  if (danmakuResult.status === 'fulfilled') {
    danmaku = danmakuResult.value.danmaku;
    danmakuSampleCount = danmakuResult.value.sampleCount;
    if (danmakuResult.value.heatError) {
      errors.danmaku = '弹幕热度不可用，已按共鸣度排序';
    }
  } else {
    errors.danmaku = '实时弹幕池加载失败';
  }

  return {
    bvid,
    cid,
    aid,
    comments,
    danmaku,
    commentTotal,
    danmakuSampleCount,
    errors,
    fetchedAt: Date.now(),
  };
}
