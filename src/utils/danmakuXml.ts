export interface ParsedDanmaku {
  id: string;
  timestampSec: number;
  content: string;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .trim();
}

/**
 * Parses Bilibili's legacy /x/v1/dm/list.so XML without DOMParser, which is not
 * available in all MV3 service workers. Invalid rows are skipped silently.
 */
export function parseDanmakuXml(xml: string, duration: number): ParsedDanmaku[] {
  if (typeof xml !== 'string' || !xml) return [];
  const rows = xml.match(/<d\s+p="[^"]*"\s*>[^<]*<\/d>/g) || [];
  const hasDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  const result: ParsedDanmaku[] = [];

  for (const row of rows) {
    const attrMatch = row.match(/<d\s+p="([^"]*)"/);
    const contentMatch = row.match(/<d\s+p="[^"]*"\s*>([^<]*)<\/d>/);
    if (!attrMatch || !contentMatch) continue;

    const fields = attrMatch[1].split(',');
    const timestampSec = Number(fields[0]);
    const mode = Number(fields[1]);
    const pool = Number(fields[5]);
    const id = String(fields[7] ?? '');
    const content = decodeXmlText(contentMatch[1]);

    if (!Number.isFinite(timestampSec) || timestampSec < 0) continue;
    if (hasDuration && timestampSec > duration) continue;
    if (pool !== 0 || ![1, 2, 3].includes(mode)) continue;
    if (content.length < 2 || content.length > 80) continue;
    if (!id) continue;

    result.push({ id, timestampSec, content });
  }

  return result;
}
