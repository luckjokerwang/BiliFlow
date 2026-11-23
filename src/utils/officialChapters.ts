import {
  CreatorChapter,
  CreatorChapterSource,
  HighlightItem,
  VideoPreflightMetadata,
} from '../types';
import { formatSeconds } from './timeParser';

export interface ResolvedCreatorChapters {
  chapters: CreatorChapter[];
  source: CreatorChapterSource;
}

/**
 * Deterministic chapter structure: official chapters win; otherwise at least
 * two description timestamps are required to form a description-based structure.
 */
export function resolveCreatorChapters(
  preflight: VideoPreflightMetadata | undefined,
  durationSec: number
): ResolvedCreatorChapters | null {
  const official = preflight?.officialChapters || [];
  if (official.length > 0) {
    const chapters = official
      .filter((chapter) =>
        chapter &&
        Number.isFinite(chapter.from) &&
        Number.isFinite(chapter.to) &&
        chapter.from >= 0 &&
        chapter.to > chapter.from &&
        typeof chapter.title === 'string' &&
        chapter.title.length > 0
      )
      .map((chapter) => ({
        from: chapter.from,
        to: chapter.to,
        title: chapter.title,
      }))
      .sort((a, b) => a.from - b.from);
    if (chapters.length > 0) return { chapters, source: 'official' };
  }

  const points = preflight?.descriptionTimestamps || [];
  if (points.length < 2) return null;

  const duration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  if (duration <= 0) return null;

  const sorted = points
    .filter(
      (point) =>
        point &&
        Number.isFinite(point.seconds) &&
        point.seconds >= 0 &&
        typeof point.title === 'string' &&
        point.title.length > 0
    )
    .map((point) => ({ ...point }))
    .sort((a, b) => a.seconds - b.seconds);

  const chapters: CreatorChapter[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].seconds;
    const to = i + 1 < sorted.length ? sorted[i + 1].seconds : duration;
    if (from < 0 || to <= from || from >= duration) continue;
    chapters.push({
      from,
      to: Math.min(to, duration),
      title: sorted[i].title,
    });
  }

  return chapters.length >= 2 ? { chapters, source: 'description' } : null;
}

/**
 * Rebuilds highlights to follow the creator chapter structure exactly: one
 * node per chapter with the original title and start time. AI nodes supply
 * keyPoints only when their timestamp falls inside the chapter range.
 */
export function applyCreatorChapterStructure(
  highlights: HighlightItem[],
  chapters: CreatorChapter[]
): HighlightItem[] {
  if (!Array.isArray(highlights) || !Array.isArray(chapters) || chapters.length === 0) {
    return highlights;
  }

  const used = new Set<number>();
  return chapters.map((chapter, index) => {
    const matchIndex = highlights.findIndex((item, itemIndex) => {
      if (used.has(itemIndex)) return false;
      const timestamp = item.timestamp ?? item.timestampSec;
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
      const isLast = index === chapters.length - 1;
      return timestamp >= chapter.from && (isLast ? timestamp <= chapter.to : timestamp < chapter.to);
    });

    if (matchIndex !== -1) used.add(matchIndex);

    const result: HighlightItem = {
      id: `chapter-${index + 1}`,
      timestamp: chapter.from,
      timestampSec: chapter.from,
      timestampStr: formatSeconds(chapter.from),
      title: chapter.title,
    };
    const keyPoint = matchIndex === -1 ? '' : (highlights[matchIndex].keyPoint || '').trim();
    if (keyPoint) result.keyPoint = keyPoint;
    return result;
  });
}
