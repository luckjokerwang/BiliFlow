export interface DanmakuHeatmapPeak {
  timestampSec: number;
  densityRatio: number;
}

/**
 * Extracts local maxima from Bilibili's high-energy progress-bar samples.
 * Original array indices are preserved: invalid samples must not shift the
 * `index * stepSec` timestamp of later peaks.
 */
export function extractDanmakuHeatmapPeaks(
  values: number[],
  stepSec: number
): DanmakuHeatmapPeak[] {
  if (!Number.isFinite(stepSec) || stepSec <= 0 || !Array.isArray(values)) {
    return [];
  }

  const samples = values.map((value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : Number.NEGATIVE_INFINITY
  );
  const max = samples.reduce(
    (currentMax, value) => (value > currentMax ? value : currentMax),
    0
  );
  if (max <= 0) return [];

  const peaks: DanmakuHeatmapPeak[] = [];
  for (let index = 0; index < samples.length; index++) {
    const value = samples[index];
    if (value <= 0) continue;

    const left = index > 0 ? samples[index - 1] : Number.NEGATIVE_INFINITY;
    const right =
      index < samples.length - 1 ? samples[index + 1] : Number.NEGATIVE_INFINITY;
    if (value > left && value >= right) {
      peaks.push({
        timestampSec: index * stepSec,
        densityRatio: Number((value / max).toFixed(3)),
      });
    }
  }

  return peaks
    .sort((a, b) => b.densityRatio - a.densityRatio || a.timestampSec - b.timestampSec)
    .slice(0, 5)
    .sort((a, b) => a.timestampSec - b.timestampSec);
}
