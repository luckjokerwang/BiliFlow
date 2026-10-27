import { describe, it, expect } from 'vitest';
import { matchesShortcut } from '../src/entrypoints/content/hooks/useFullscreenDetector';

function makeKeyEvent(opts: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    code: opts.code ?? (opts.key.length === 1 ? `Key${opts.key.toUpperCase()}` : opts.key),
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    metaKey: opts.metaKey ?? false,
  } as unknown as KeyboardEvent;
}

describe('matchesShortcut', () => {
  it('matches single letter keys accurately without modifiers', () => {
    const eventK = makeKeyEvent({ key: 'k', code: 'KeyK' });
    expect(matchesShortcut(eventK, 'K')).toBe(true);
    expect(matchesShortcut(eventK, 'k')).toBe(true);

    const eventJ = makeKeyEvent({ key: 'j', code: 'KeyJ' });
    expect(matchesShortcut(eventJ, 'J')).toBe(true);
    expect(matchesShortcut(eventJ, 'K')).toBe(false);
  });

  it('rejects single keys when unwanted modifier keys are pressed', () => {
    const eventWithAlt = makeKeyEvent({ key: 'k', code: 'KeyK', altKey: true });
    expect(matchesShortcut(eventWithAlt, 'K')).toBe(false);

    const eventWithCtrl = makeKeyEvent({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(matchesShortcut(eventWithCtrl, 'K')).toBe(false);

    const eventWithShift = makeKeyEvent({ key: 'k', code: 'KeyK', shiftKey: true });
    expect(matchesShortcut(eventWithShift, 'K')).toBe(false);
  });

  it('matches composite shortcuts like Alt+S and Alt+N', () => {
    const eventAltS = makeKeyEvent({ key: 's', code: 'KeyS', altKey: true });
    expect(matchesShortcut(eventAltS, 'Alt+S')).toBe(true);

    const eventAltN = makeKeyEvent({ key: 'n', code: 'KeyN', altKey: true });
    expect(matchesShortcut(eventAltN, 'Alt+N')).toBe(true);
    expect(matchesShortcut(eventAltN, 'Alt+S')).toBe(false);
  });

  it('handles empty or undefined shortcut safely', () => {
    const event = makeKeyEvent({ key: 'k' });
    expect(matchesShortcut(event, '')).toBe(false);
    expect(matchesShortcut(event, undefined)).toBe(false);
  });
});
