import { describe, it, expect } from 'vitest';
import { formatSeconds, parseTimestamp } from '../src/utils/timeParser';

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
