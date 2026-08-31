import { BiliRawSubtitleItem, BiliSubtitleResponse } from '../types';

/**
 * Fetches subtitle items for a Bilibili video using official / AI subtitle endpoints.
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

  // 1. Try standard player/v2 endpoint with credentials
  let url = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`;
  if (aid) {
    url += `&aid=${aid}`;
  }

  let subtitlesList: any[] | undefined;

  try {
    const res = await fetch(url, {
      headers,
      credentials: 'include',
    });

    if (res.ok) {
      const json: BiliSubtitleResponse = await res.json();
      if (json.code === 0 && json.data?.subtitle?.subtitles) {
        subtitlesList = json.data.subtitle.subtitles;
      }
    }
  } catch (e) {
    console.warn('[BiliFlow] fetch player/v2 failed, trying fallback:', e);
  }

  // 2. Try wbi player endpoint if player/v2 returned empty
  if (!subtitlesList || subtitlesList.length === 0) {
    try {
      const wbiUrl = `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&bvid=${bvid}${aid ? `&aid=${aid}` : ''}`;
      const res = await fetch(wbiUrl, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const json: BiliSubtitleResponse = await res.json();
        if (json.code === 0 && json.data?.subtitle?.subtitles) {
          subtitlesList = json.data.subtitle.subtitles;
        }
      }
    } catch (e) {
      console.warn('[BiliFlow] fetch player/wbi/v2 failed:', e);
    }
  }

  if (!subtitlesList || subtitlesList.length === 0) {
    throw new Error('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
  }

  // Pick first available subtitle track (prefer zh-CN / 中文)
  const preferredTrack =
    subtitlesList.find((s) => s.lan?.includes('zh') || s.lan_doc?.includes('中')) ||
    subtitlesList[0];

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

  return rawBody.map((item: any) => ({
    from: Number(item.from) || 0,
    to: Number(item.to) || 0,
    content: String(item.content || ''),
  }));
}
