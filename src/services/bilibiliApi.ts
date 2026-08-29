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

  let url = `https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`;
  if (aid) {
    url += `&aid=${aid}`;
  }

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Bilibili player metadata: HTTP ${res.status}`);
  }

  const json: BiliSubtitleResponse = await res.json();
  if (json.code !== 0) {
    throw new Error(`Bilibili API error (${json.code}): ${json.message}`);
  }

  const subtitlesList = json.data?.subtitle?.subtitles;
  if (!subtitlesList || subtitlesList.length === 0) {
    throw new Error('该视频未包含任何官方字幕或 AI 生成字幕。');
  }

  // Pick first available subtitle track (prefer zh-CN)
  const preferredTrack =
    subtitlesList.find((s) => s.lan.includes('zh') || s.lan_doc.includes('中')) ||
    subtitlesList[0];

  let subUrl = preferredTrack.subtitle_url;
  if (subUrl.startsWith('//')) {
    subUrl = `https:${subUrl}`;
  }

  const subRes = await fetch(subUrl);
  if (!subRes.ok) {
    throw new Error(`Failed to download subtitle content: HTTP ${subRes.status}`);
  }

  const subData = await subRes.json();
  const rawBody = subData?.body;

  if (!Array.isArray(rawBody) || rawBody.length === 0) {
    throw new Error('字幕数据为空。');
  }

  return rawBody.map((item: any) => ({
    from: Number(item.from) || 0,
    to: Number(item.to) || 0,
    content: String(item.content || ''),
  }));
}
