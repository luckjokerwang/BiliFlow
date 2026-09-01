import { BiliRawSubtitleItem, BiliSubtitleResponse } from '../types';
import {
  selectPreferredSubtitleTrack,
  fuseSubtitles,
} from '../utils/subtitleUtils';

/**
 * Fetches subtitle items for a Bilibili video using official / AI subtitle endpoints.
 * Waterfall Strategy:
 * 1. Primary: x/v2/dm/view (captures all modern AI subtitles and manual CC tracks)
 * 2. Fallback: x/player/v2 & x/player/wbi/v2 (traditional player init metadata)
 * 3. Priority: UP Manual Chinese > Bilibili AI Chinese > Manual others > AI translated
 * 4. Sentence Fusion: merges raw chopped ASR segments into natural coherent sentences.
 *
 * Note: Must be executed in the Background Service Worker context to bypass CORS/CSP.
 */
export async function fetchBilibiliSubtitles(params: {
  bvid: string;
  cid: string;
  aid?: string;
}): Promise<BiliRawSubtitleItem[]> {
  const { bvid, cid, aid } = params;

  if (!bvid || !cid) {
    throw new Error('缺少视频标识参数 (bvid 或 cid 为空)');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: `https://www.bilibili.com/video/${bvid}`,
  };

  let subtitlesList: any[] | undefined;

  // 1. Primary: Query modern Danmaku & AI Subtitle gateway (x/v2/dm/view)
  try {
    let dmUrl = `https://api.bilibili.com/x/v2/dm/view?oid=${cid}&type=1`;
    if (aid) {
      dmUrl += `&pid=${aid}`;
    }

    const res = await fetch(dmUrl, {
      headers,
      credentials: 'include',
    });

    if (res.ok) {
      const json: BiliSubtitleResponse = await res.json();
      if (json.code === 0 && json.data?.subtitle?.subtitles?.length) {
        subtitlesList = json.data.subtitle.subtitles;
      }
    }
  } catch (e) {
    console.warn('[BiliFlow] fetch x/v2/dm/view failed, trying player fallback:', e);
  }

  // 2. Fallback: Query traditional player/v2 if primary returned empty
  if (!subtitlesList || subtitlesList.length === 0) {
    try {
      let playerUrl = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`;
      if (aid) {
        playerUrl += `&aid=${aid}`;
      }
      const res = await fetch(playerUrl, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const json: BiliSubtitleResponse = await res.json();
        if (json.code === 0 && json.data?.subtitle?.subtitles?.length) {
          subtitlesList = json.data.subtitle.subtitles;
        }
      }
    } catch (e) {
      console.warn('[BiliFlow] fetch player/v2 fallback failed:', e);
    }
  }

  // 3. Fallback: Query player/wbi/v2
  if (!subtitlesList || subtitlesList.length === 0) {
    try {
      const wbiUrl = `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&bvid=${bvid}${aid ? `&aid=${aid}` : ''}`;
      const res = await fetch(wbiUrl, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const json: BiliSubtitleResponse = await res.json();
        if (json.code === 0 && json.data?.subtitle?.subtitles?.length) {
          subtitlesList = json.data.subtitle.subtitles;
        }
      }
    } catch (e) {
      console.warn('[BiliFlow] fetch player/wbi/v2 fallback failed:', e);
    }
  }

  if (!subtitlesList || subtitlesList.length === 0) {
    throw new Error('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
  }

  // 4. Select preferred subtitle track via Waterfall priority
  const preferredTrack = selectPreferredSubtitleTrack(subtitlesList);

  if (!preferredTrack || !preferredTrack.subtitle_url) {
    throw new Error('未找到可用的字幕下载地址。');
  }

  let subUrl = preferredTrack.subtitle_url;
  if (subUrl.startsWith('//')) {
    subUrl = `https:${subUrl}`;
  }

  const subRes = await fetch(subUrl, { credentials: 'include' });
  if (!subRes.ok) {
    throw new Error(`下载字幕数据失败: HTTP ${subRes.status}`);
  }

  const subData = await subRes.json();
  const rawBody = subData?.body;

  if (!Array.isArray(rawBody) || rawBody.length === 0) {
    throw new Error('获取到的字幕内容为空。');
  }

  const mappedItems: BiliRawSubtitleItem[] = rawBody.map((item: any) => ({
    from: Number(item.from) || 0,
    to: Number(item.to) || 0,
    content: String(item.content || ''),
  }));

  // 5. Apply Sentence Fusion to create coherent natural sentences and save tokens
  return fuseSubtitles(mappedItems);
}
