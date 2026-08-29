import { describe, it, expect } from 'vitest';
import { chunkSubtitles, formatTranscriptForPrompt } from '../src/utils/transcriptChunker';
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
});
