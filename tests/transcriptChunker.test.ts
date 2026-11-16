import { describe, it, expect } from 'vitest';
import {
  chunkSubtitles,
  formatTranscriptForPrompt,
  compressChunksToFit,
  partitionSubtitlesIntoWindows,
} from '../src/utils/transcriptChunker';
import { BiliRawSubtitleItem } from '../src/types';

describe('transcriptChunker', () => {
  const mockSubtitles: BiliRawSubtitleItem[] = [
    { from: 0.5, to: 3.2, content: '大家好' },
    { from: 3.5, to: 6.8, content: '今天我们来聊聊变形自行车' },
    { from: 7.0, to: 12.5, content: '它的核心在于轮子的自适应结构' },
    { from: 30.0, to: 34.2, content: '接下来看看第二项技术' },
    { from: 34.5, to: 38.0, content: '自供电屏幕的工作原理' },
  ];

  it('aggregates small fragments into chunks based on time threshold', () => {
    const chunks = chunkSubtitles(mockSubtitles, { maxDurationSeconds: 20 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].timestampStr).toBe('00:00');
    expect(chunks[0].text).toContain('大家好 今天我们来聊聊变形自行车 它的核心在于轮子的自适应结构');
    expect(chunks[1].timestampStr).toBe('00:30');
    expect(chunks[1].text).toContain('接下来看看第二项技术 自供电屏幕的工作原理');
  });

  it('formats chunks into timestamped lines for LLM prompt', () => {
    const chunks = chunkSubtitles(mockSubtitles, { maxDurationSeconds: 20 });
    const formatted = formatTranscriptForPrompt(chunks);

    expect(formatted).toContain('[00:00] 大家好 今天我们来聊聊变形自行车 它的核心在于轮子的自适应结构');
    expect(formatted).toContain('[00:30] 接下来看看第二项技术 自供电屏幕的工作原理');
  });

  it('handles empty subtitle lists defensively', () => {
    expect(chunkSubtitles([])).toEqual([]);
    expect(formatTranscriptForPrompt([])).toBe('');
  });

  it('compressChunksToFit merges chunks progressively while preserving start and end timestamps', () => {
    const manyChunks = Array.from({ length: 20 }, (_, i) => ({
      startTime: i * 60,
      endTime: (i + 1) * 60,
      timestampStr: `${String(i).padStart(2, '0')}:00`,
      text: `这是第 ${i + 1} 个时间段的较长字幕段落，包含详细技术说明与案例讲解内容。`,
    }));

    // Pass a very small budget (e.g. 300 chars) to force compression
    const compressed = compressChunksToFit(manyChunks, 300);
    expect(compressed.length).toBeLessThan(manyChunks.length);
    // Ensure the timeline start and end are strictly preserved!
    expect(compressed[0].startTime).toBe(0);
    expect(compressed[compressed.length - 1].endTime).toBe(20 * 60);

    // Ensure total character count is strictly bounded by maxTotalChars
    const totalChars = compressed.reduce((sum, c) => sum + c.text.length, 0);
    expect(totalChars).toBeLessThanOrEqual(300);
  });
});

describe('partitionSubtitlesIntoWindows', () => {
  it('keeps boundary and straddling sentences in lossless ten-minute windows', () => {
    const windows = partitionSubtitlesIntoWindows(
      [
        { from: 0, to: 5, content: '开场' },
        { from: 599.9, to: 600.5, content: '跨边界句' },
        { from: 600, to: 604, content: '第二窗口句' },
      ],
      600
    );

    expect(windows).toHaveLength(2);
    expect(windows[0].startTime).toBe(0);
    expect(windows[0].items.map((item) => item.content)).toEqual([
      '开场',
      '跨边界句',
    ]);
    expect(windows[1].startTime).toBe(600);
    expect(windows[1].items.map((item) => item.content)).toEqual([
      '第二窗口句',
    ]);
    expect(windows[0].text).toContain('[00:00] 开场');
    expect(windows[0].text).toContain('跨边界句');
    expect(windows[1].text).toContain('第二窗口句');
  });

  it('returns no windows for empty input or invalid window size', () => {
    const items: BiliRawSubtitleItem[] = [
      { from: 0, to: 2, content: '有效字幕' },
    ];
    expect(partitionSubtitlesIntoWindows([], 600)).toEqual([]);
    expect(partitionSubtitlesIntoWindows(items, 0)).toEqual([]);
    expect(partitionSubtitlesIntoWindows(items, Number.NaN)).toEqual([]);
  });
});
