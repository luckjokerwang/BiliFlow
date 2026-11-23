import {
  BiliRawSubtitleItem,
  CreatorChapter,
  VideoPreflightMetadata,
} from '../types';
import {
  selectPreferredSubtitleTrack,
  fuseSubtitles,
} from '../utils/subtitleUtils';
import { extractDescriptionTimestamps } from '../utils/timeParser';
import { extractDanmakuHeatmapPeaks } from '../utils/danmakuHeatmap';

type UnknownRecord = Record<string, unknown>;

interface PlayerV2Response {
  code: number;
  message?: string;
  data?: {
    view_points?: unknown;
  };
}

interface PbpDataResponse {
  step_sec?: unknown;
  events?: {
    default?: unknown;
  };
}

interface SubtitleEnvelope {
  code: number;
  data?: {
    subtitle?: {
      subtitles?: UnknownRecord[];
    };
  };
}

interface SubtitleBodyEnvelope {
  body?: UnknownRecord[];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseOfficialChapters(
  rawPoints: unknown,
  durationSec?: number
): CreatorChapter[] {
  if (!Array.isArray(rawPoints)) return [];

  const duration = finiteNumber(durationSec);
  return rawPoints
    .map((rawPoint) => {
      const point = rawPoint as UnknownRecord;
      const from = finiteNumber(point.from);
      const to = finiteNumber(point.to);
      const title =
        typeof point.content === 'string' ? point.content.trim() : '';
      if (
        point.type !== 2 ||
        from === null ||
        to === null ||
        from < 0 ||
        to <= from ||
        !title
      ) {
        return null;
      }

      const clampedFrom =
        duration !== null && duration > 0
          ? Math.max(0, Math.min(from, duration))
          : from;
      const clampedTo =
        duration !== null && duration > 0
          ? Math.max(0, Math.min(to, duration))
          : to;
      if (clampedTo <= clampedFrom) return null;
      return { from: clampedFrom, to: clampedTo, title };
    })
    .filter((chapter): chapter is CreatorChapter => chapter !== null)
    .sort((a, b) => a.from - b.from);
}

export function makeHeaders(bvid: string): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: `https://www.bilibili.com/video/${bvid}`,
  };
}

export function buildBiliUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`https://api.bilibili.com${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function fetchJson<T>(
  url: string,
  headers: Record<string, string>
): Promise<T> {
  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  return data as T;
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function subtitleTracksFromResponse(data: unknown): UnknownRecord[] | null {
  const envelope = data as SubtitleEnvelope;
  const subtitles = envelope?.data?.subtitle?.subtitles;
  if (!envelope || envelope.code !== 0 || !Array.isArray(subtitles)) return null;
  return subtitles.length > 0
    ? subtitles.filter(
        (track): track is UnknownRecord =>
          typeof track === 'object' && track !== null
      )
    : null;
}

/**
 * Fetches subtitle items for a Bilibili video using official / AI subtitle endpoints.
 * Must run in the Background Service Worker to bypass CORS/CSP.
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

  const headers = makeHeaders(bvid);
  let subtitlesList: UnknownRecord[] | undefined;

  const dmParams: Record<string, string> = { oid: cid, type: '1' };
  if (aid) dmParams.pid = aid;
  try {
    const json: unknown = await fetchJson<unknown>(
      buildBiliUrl('/x/v2/dm/view', dmParams),
      headers
    );
    subtitlesList = subtitleTracksFromResponse(json) || undefined;
  } catch (e) {
    console.warn('[BiliFlow] fetch x/v2/dm/view failed, trying player fallback:', e);
  }

  if (!subtitlesList || subtitlesList.length === 0) {
    const playerParams: Record<string, string> = { cid, bvid };
    if (aid) playerParams.aid = aid;
    try {
      const json: unknown = await fetchJson<unknown>(
        buildBiliUrl('/x/player/v2', playerParams),
        headers
      );
      subtitlesList = subtitleTracksFromResponse(json) || undefined;
    } catch (e) {
      console.warn('[BiliFlow] fetch player/v2 fallback failed:', e);
    }
  }

  if (!subtitlesList || subtitlesList.length === 0) {
    const wbiParams: Record<string, string> = { cid, bvid };
    if (aid) wbiParams.aid = aid;
    try {
      const json: unknown = await fetchJson<unknown>(
        buildBiliUrl('/x/player/wbi/v2', wbiParams),
        headers
      );
      subtitlesList = subtitleTracksFromResponse(json) || undefined;
    } catch (e) {
      console.warn('[BiliFlow] fetch player/wbi/v2 fallback failed:', e);
    }
  }

  if (!subtitlesList || subtitlesList.length === 0) {
    throw new Error('该视频未包含任何官方字幕或 AI 生成字幕，无法提炼要点。');
  }

  const preferredTrack: { subtitle_url?: string } | null =
    selectPreferredSubtitleTrack(subtitlesList);
  if (!preferredTrack || typeof preferredTrack.subtitle_url !== 'string') {
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
  const subData: unknown = await subRes.json();
  const bodyEnvelope = subData as SubtitleBodyEnvelope;
  const body = bodyEnvelope?.body;
  const rawBody: UnknownRecord[] = Array.isArray(body) ? body : [];
  if (rawBody.length === 0) {
    throw new Error('获取到的字幕内容为空。');
  }

  const mappedItems: BiliRawSubtitleItem[] = rawBody
    .map((record: UnknownRecord) => {
      return {
        from: typeof record.from === 'number' ? record.from : Number(record.from) || 0,
        to: typeof record.to === 'number' ? record.to : Number(record.to) || 0,
        content:
          typeof record.content === 'string'
            ? record.content.trim()
            : String(record.content ?? '').trim(),
      };
    })
    .filter((item) => item.content.length > 0);

  if (mappedItems.length === 0) {
    throw new Error('获取到的字幕内容为空。');
  }

  const fused = fuseSubtitles(mappedItems);
  if (!fused || fused.length === 0 || fused.every((item) => !item.content.trim())) {
    throw new Error('该视频未包含任何有效字幕文本，无法提炼要点。');
  }
  return fused;
}

export async function fetchVideoPreflightMetadata(params: {
  bvid: string;
  cid: string;
  aid?: string;
  description?: string;
  durationSec?: number;
}): Promise<VideoPreflightMetadata> {
  const { bvid, cid, aid, description, durationSec } = params;
  if (!bvid || !cid) return {};

  const result: VideoPreflightMetadata = {};
  const descriptionTimestamps = extractDescriptionTimestamps(
    description || '',
    durationSec
  );
  if (descriptionTimestamps.length > 0) {
    result.descriptionTimestamps = descriptionTimestamps;
  }

  const headers = makeHeaders(bvid);
  const commonParams: Record<string, string> = { cid, bvid };
  if (aid) commonParams.aid = aid;
  const playerUrl = buildBiliUrl('/x/player/v2', commonParams);

  const [playerResult, pbpResult] = await Promise.allSettled([
    fetchJsonWithTimeout<PlayerV2Response>(playerUrl, headers),
    fetchDanmakuHeatmapPeaks({ bvid, cid, aid: aid || '' }),
  ]);

  if (playerResult.status === 'rejected') {
    console.warn('[BiliFlow] preflight player/v2 failed:', playerResult.reason);
  }

  let chapters =
    playerResult.status === 'fulfilled' && playerResult.value.code === 0
      ? parseOfficialChapters(playerResult.value.data?.view_points, durationSec)
      : [];

  if (chapters.length === 0) {
    const wbiUrl = buildBiliUrl('/x/player/wbi/v2', commonParams);
    try {
      const wbiResult = await fetchJsonWithTimeout<PlayerV2Response>(wbiUrl, headers);
      if (wbiResult.code === 0) {
        chapters = parseOfficialChapters(wbiResult.data?.view_points, durationSec);
      }
    } catch (error) {
      console.warn('[BiliFlow] preflight player/wbi/v2 failed:', error);
    }
  }

  if (chapters.length > 0) result.officialChapters = chapters;

  if (pbpResult.status === 'rejected') {
    console.warn('[BiliFlow] preflight pbp/data failed:', pbpResult.reason);
  } else if (pbpResult.value.length > 0) {
    result.danmakuHeatmapPeaks = pbpResult.value;
  }

  return result;
}

/** Fetches the /pbp/data heatmap peaks shared by preflight and community digest. */
export async function fetchDanmakuHeatmapPeaks(params: {
  bvid: string;
  cid: string;
  aid: string;
}): Promise<Array<{ timestampSec: number; densityRatio: number }>> {
  const { bvid, cid, aid } = params;
  if (!bvid || !cid) return [];
  const headers = makeHeaders(bvid);
  const commonParams: Record<string, string> = { cid, bvid };
  if (aid) commonParams.aid = aid;
  const pbpUrl = buildBiliUrl('/pbp/data', commonParams);
  const data = await fetchJsonWithTimeout<PbpDataResponse>(pbpUrl, headers);
  const stepSec = finiteNumber(data.step_sec);
  const rawValues = data.events?.default;
  if (stepSec === null || stepSec <= 0 || !Array.isArray(rawValues)) return [];
  const values = rawValues.map((value) =>
    typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  );
  const peaks = extractDanmakuHeatmapPeaks(values, stepSec);
  return peaks.length > 0 ? peaks : [];
}
