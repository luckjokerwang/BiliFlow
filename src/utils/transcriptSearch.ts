import { BiliRawSubtitleItem } from '../types';

export interface TranscriptSearchMatch {
  item: BiliRawSubtitleItem;
  index: number;
}

/** Filters transcript sentences while preserving their original playback indices. */
export function filterTranscriptItems(
  items: BiliRawSubtitleItem[],
  query: string
): TranscriptSearchMatch[] {
  if (!Array.isArray(items)) return [];

  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!normalizedQuery) return true;
      return String(item.content || '')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
}
