import { describe, it, expect } from 'vitest';
import { matchesShortcut } from '../src/entrypoints/content/hooks/useFullscreenDetector';
import {
  resolveShortcut,
  validateShortcutBinding,
} from '../src/utils/shortcutDefinitions';
import { DEFAULT_SETTINGS } from '../src/constants';

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

describe('arrow highlight shortcuts', () => {
  it('resolves built-in arrow bindings and keeps them editable', () => {
    expect(resolveShortcut('prevHighlightArrow', DEFAULT_SETTINGS)).toBe('ArrowUp');
    expect(resolveShortcut('nextHighlightArrow', DEFAULT_SETTINGS)).toBe('ArrowDown');
    expect(resolveShortcut('prevHighlightArrow', {
      ...DEFAULT_SETTINGS,
      shortcutPrevHighlightArrow: 'Ctrl+ArrowUp',
    })).toBe('Ctrl+ArrowUp');
  });

  it('matches arrow keys only when modifiers agree', () => {
    const up = makeKeyEvent({ key: 'ArrowUp', code: 'ArrowUp' });
    const down = makeKeyEvent({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(matchesShortcut(up, 'ArrowUp')).toBe(true);
    expect(matchesShortcut(down, 'ArrowDown')).toBe(true);
    expect(matchesShortcut(makeKeyEvent({ key: 'ArrowUp', code: 'ArrowUp', altKey: true }), 'ArrowUp')).toBe(false);
  });
});

describe('resolveShortcut', () => {
  it('treats an explicitly empty binding as disabled', () => {
    expect(resolveShortcut('copyMarkdown', {
      ...DEFAULT_SETTINGS,
      shortcutCopyMarkdown: '',
    })).toBe('');
    expect(matchesShortcut(makeKeyEvent({ key: 'c', code: 'KeyC', altKey: true }), '')).toBe(false);
  });

  it('uses defaults only when the setting is absent', () => {
    expect(resolveShortcut('toggle', { ...DEFAULT_SETTINGS, shortcutToggle: undefined })).toBe('Alt+S');
    expect(resolveShortcut('quickNote', { ...DEFAULT_SETTINGS, shortcutQuickNote: undefined })).toBe('Alt+N');
    expect(resolveShortcut('prevView', DEFAULT_SETTINGS)).toBe('[');
    expect(resolveShortcut('nextView', DEFAULT_SETTINGS)).toBe(']');
  });

  it('returns the custom binding when configured', () => {
    expect(resolveShortcut('toggle', { ...DEFAULT_SETTINGS, shortcutToggle: 'Ctrl+T' })).toBe('Ctrl+T');
  });
});

describe('validateShortcutBinding', () => {
  it('accepts a free combination', () => {
    expect(validateShortcutBinding({
      action: 'toggle',
      binding: 'Ctrl+Shift+Y',
      settings: DEFAULT_SETTINGS,
    })).toEqual({ ok: true });
  });

  it('rejects reserved navigation and number keys', () => {
    for (const binding of ['Tab', 'Enter', ' ', 'Escape', '5']) {
      const result = validateShortcutBinding({
        action: 'toggle',
        binding,
        settings: DEFAULT_SETTINGS,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('reserved');
    }
    expect(validateShortcutBinding({
      action: 'toggle',
      binding: 'Ctrl+5',
      settings: DEFAULT_SETTINGS,
    })).toEqual({ ok: true });
  });

  it('rejects conflicts against other actions regardless of case or modifier order', () => {
    const result = validateShortcutBinding({
      action: 'quickNote',
      binding: 's+alt',
      settings: DEFAULT_SETTINGS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('conflict');
      expect(result.message).toContain('HUD');
    }
    expect(validateShortcutBinding({
      action: 'toggle',
      binding: 'Alt+S',
      settings: DEFAULT_SETTINGS,
    })).toEqual({ ok: true });
  });

  it('rejects a conflicting restore-default binding', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      shortcutQuickNote: 'Alt+S',
      shortcutToggle: 'Ctrl+T',
    };
    const result = validateShortcutBinding({
      action: 'toggle',
      binding: 'Alt+S',
      settings,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('conflict');
  });
});
