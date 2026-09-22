import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasVideoUrlChanged,
  onSpaNavigate,
  _resetWatcherForTesting,
} from '../src/utils/spaNavigation';
import { isUserTyping } from '../src/utils/playerController';

describe('SPA Navigation - hasVideoUrlChanged', () => {
  it('detects video URL changes with different BVIDs', () => {
    const url1 = 'https://www.bilibili.com/video/BV1xx411c7mD';
    const url2 = 'https://www.bilibili.com/video/BV1yy411c7mE';
    expect(hasVideoUrlChanged(url1, url2)).toBe(true);
  });

  it('detects video URL changes with different p parameters', () => {
    const urlP1 = 'https://www.bilibili.com/video/BV1xx411c7mD?p=1';
    const urlP2 = 'https://www.bilibili.com/video/BV1xx411c7mD?p=2';
    expect(hasVideoUrlChanged(urlP1, urlP2)).toBe(true);
  });

  it('treats identical video URLs with other tracking params as unchanged', () => {
    const urlBase = 'https://www.bilibili.com/video/BV1xx411c7mD?p=1';
    const urlWithTracking = 'https://www.bilibili.com/video/BV1xx411c7mD?p=1&spm_id_from=333.999.0.0';
    expect(hasVideoUrlChanged(urlBase, urlWithTracking)).toBe(false);
  });

  it('returns false when URLs are exactly equal', () => {
    const url = 'https://www.bilibili.com/video/BV1xx411c7mD';
    expect(hasVideoUrlChanged(url, url)).toBe(false);
  });
});

describe('SPA Navigation - onSpaNavigate Event Handling', () => {
  let listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    _resetWatcherForTesting();
    listeners = {};

    (global as any).window = {
      location: {
        href: 'https://www.bilibili.com/video/BV1xx411c7mD',
      },
      addEventListener: vi.fn((event: string, fn: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      }),
      removeEventListener: vi.fn((event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((f) => f !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const list = listeners[event.type] || [];
        list.forEach((f) => f(event));
      }),
    };

    (global as any).history = {
      pushState: vi.fn((state: any, title: string, url?: string) => {
        if (url) {
          (global as any).window.location.href = url;
        }
      }),
      replaceState: vi.fn((state: any, title: string, url?: string) => {
        if (url) {
          (global as any).window.location.href = url;
        }
      }),
    };

    (global as any).CustomEvent = class MockCustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params?: { detail: any }) {
        this.type = type;
        this.detail = params?.detail;
      }
    };
  });

  afterEach(() => {
    _resetWatcherForTesting();
    delete (global as any).window;
    delete (global as any).history;
    delete (global as any).CustomEvent;
    vi.restoreAllMocks();
  });

  it('notifies subscriber when URL changes via pushState', () => {
    const callback = vi.fn();
    const unsubscribe = onSpaNavigate(callback);

    // Call wrapped pushState with new URL
    (global as any).history.pushState({}, '', 'https://www.bilibili.com/video/BV1yy411c7mE');

    expect(callback).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1yy411c7mE');
    unsubscribe();
  });

  it('notifies subscriber when URL changes via replaceState', () => {
    const callback = vi.fn();
    const unsubscribe = onSpaNavigate(callback);

    // Call wrapped replaceState with new URL
    (global as any).history.replaceState({}, '', 'https://www.bilibili.com/video/BV1zz411c7mF?p=2');

    expect(callback).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1zz411c7mF?p=2');
    unsubscribe();
  });
});

describe('User Typing Detection (isUserTyping)', () => {
  beforeEach(() => {
    (global as any).document = {
      activeElement: null,
    };
  });

  afterEach(() => {
    delete (global as any).document;
  });

  it('returns false when activeElement is null', () => {
    (global as any).document.activeElement = null;
    expect(isUserTyping()).toBe(false);
  });

  it('returns true when an input element is focused', () => {
    (global as any).document.activeElement = {
      tagName: 'INPUT',
      getAttribute: () => null,
      isContentEditable: false,
    };
    expect(isUserTyping()).toBe(true);
  });

  it('returns true when a textarea element is focused', () => {
    (global as any).document.activeElement = {
      tagName: 'TEXTAREA',
      getAttribute: () => null,
      isContentEditable: false,
    };
    expect(isUserTyping()).toBe(true);
  });

  it('returns true when a contenteditable element is focused', () => {
    (global as any).document.activeElement = {
      tagName: 'DIV',
      getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
      isContentEditable: true,
    };
    expect(isUserTyping()).toBe(true);
  });

  it('returns true when event target is an input even if document.activeElement is null', () => {
    const mockInput = {
      tagName: 'INPUT',
      getAttribute: () => null,
      isContentEditable: false,
    };
    const mockEvent = {
      target: mockInput,
      composedPath: () => [mockInput],
    } as any;
    expect(isUserTyping(mockEvent)).toBe(true);
  });

  it('returns true when event target is contenteditable', () => {
    const mockDiv = {
      tagName: 'DIV',
      getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
      isContentEditable: true,
    };
    const mockEvent = {
      target: mockDiv,
      composedPath: () => [mockDiv],
    } as any;
    expect(isUserTyping(mockEvent)).toBe(true);
  });

  it('returns false when event target is a regular button or div', () => {
    const mockBtn = {
      tagName: 'BUTTON',
      getAttribute: () => null,
      isContentEditable: false,
    };
    const mockEvent = {
      target: mockBtn,
      composedPath: () => [mockBtn],
    } as any;
    expect(isUserTyping(mockEvent)).toBe(false);
  });
});
