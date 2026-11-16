import { describe, it, expect } from 'vitest';
import {
  extractDescriptionTimestamps,
  formatSeconds,
  parseTimestamp,
} from '../src/utils/timeParser';

describe('timeParser', () => {
  describe('formatSeconds', () => {
    it('formats seconds less than 1 minute', () => {
      expect(formatSeconds(0)).toBe('00:00');
      expect(formatSeconds(5)).toBe('00:05');
      expect(formatSeconds(59)).toBe('00:59');
    });

    it('formats minutes and seconds accurately', () => {
      expect(formatSeconds(60)).toBe('01:00');
      expect(formatSeconds(154.6)).toBe('02:34');
      expect(formatSeconds(599)).toBe('09:59');
    });

    it('formats hours for longer videos', () => {
      expect(formatSeconds(3600)).toBe('01:00:00');
      expect(formatSeconds(3665)).toBe('01:01:05');
    });

    it('handles negative or invalid inputs defensively', () => {
      expect(formatSeconds(-10)).toBe('00:00');
      expect(formatSeconds(NaN)).toBe('00:00');
    });
  });

  describe('parseTimestamp', () => {
    it('parses mm:ss formatted strings', () => {
      expect(parseTimestamp('00:00')).toBe(0);
      expect(parseTimestamp('02:34')).toBe(154);
      expect(parseTimestamp('10:05')).toBe(605);
    });

    it('parses hh:mm:ss formatted strings', () => {
      expect(parseTimestamp('01:01:05')).toBe(3665);
    });

    it('handles malformed inputs defensively', () => {
      expect(parseTimestamp('')).toBe(0);
      expect(parseTimestamp('abc')).toBe(0);
      expect(parseTimestamp('02:invalid')).toBe(0);
    });
  });
});

describe('extractDescriptionTimestamps', () => {
  it('extracts mm:ss lines with brackets, separators, sorting and dedupe', () => {
    const description = [
      '02:00 - 重点',
      '00:00 开场',
      '[01:30] 背景',
      '01:30 背景',
      '没有时间戳的说明',
    ].join('\n');

    expect(extractDescriptionTimestamps(description)).toEqual([
      { seconds: 0, title: '开场' },
      { seconds: 90, title: '背景' },
      { seconds: 120, title: '重点' },
    ]);
  });

  it('supports hh:mm:ss and drops points beyond the video duration', () => {
    const description = '01:02:03 长视频结尾\n01:10:00 超出视频';
    expect(extractDescriptionTimestamps(description, 3725)).toEqual([
      { seconds: 3723, title: '长视频结尾' },
    ]);
  });
});
