import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractActivePlaylistPIndex,
  extractVideoMeta,
  getVideoDuration,
  isUserTyping,
} from '../src/utils/playerController';

interface MockElement {
  tagName: string;
  className?: string;
  textContent?: string;
  href?: string;
  parentElement?: MockElement | null;
  children: MockElement[];
  attributes: Record<string, string>;
  matches?: (selector: string) => boolean;
  querySelector?: (sel: string) => MockElement | null;
  getAttribute: (name: string) => string | null;
}

function createMockElement(
  tagName: string,
  attrs: Record<string, string> = {},
  textContent = ''
): MockElement {
  const el: MockElement = {
    tagName: tagName.toUpperCase(),
    className: attrs.class || '',
    textContent,
    href: attrs.href,
    parentElement: null,
    children: [],
    attributes: attrs,
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    matches(sel: string) {
      const parts = sel.split(',').map((s) => s.trim());
      return parts.some((part) => {
        if (part.startsWith('.')) {
          const cls = part.slice(1);
          return (this.className || '').split(/\s+/).includes(cls);
        }
        if (part.toLowerCase() === this.tagName.toLowerCase()) {
          return true;
        }
        return false;
      });
    },
    querySelector(sel: string) {
      if (sel === 'a') {
        return this.children.find((c) => c.tagName === 'A') ?? null;
      }
      return null;
    },
  };
  return el;
}

describe('playerController', () => {
  let mockElements: Record<string, MockElement[]> = {};
  let originalWindow: unknown;
  let originalDocument: unknown;

  const mockLocation = {
    pathname: '/video/BV1rHh16CEfm',
    search: '',
    origin: 'https://www.bilibili.com',
  };

  beforeEach(() => {
    mockElements = {};
    mockLocation.pathname = '/video/BV1rHh16CEfm';
    mockLocation.search = '';

    const globalObj = globalThis as { window?: unknown; document?: unknown };
    originalWindow = globalObj.window;
    originalDocument = globalObj.document;

    const mockDoc = {
      title: '测试视频标题_哔哩哔哩_bilibili',
      activeElement: null as unknown,
      querySelector: (sel: string) => {
        const list = mockDoc.querySelectorAll(sel);
        return list.length > 0 ? (list[0] as unknown as HTMLElement) : null;
      },
      querySelectorAll: (sel: string) => {
        const parts = sel.split(',').map((s) => s.trim());
        for (const part of parts) {
          if (mockElements[part] && mockElements[part].length > 0) {
            return mockElements[part] as unknown as NodeListOf<HTMLElement>;
          }
        }
        return [] as unknown as NodeListOf<HTMLElement>;
      },
    };

    const mockWin = {
      location: mockLocation,
    };

    globalObj.window = mockWin;
    globalObj.document = mockDoc;
  });

  afterEach(() => {
    const globalObj = globalThis as { window?: unknown; document?: unknown };
    globalObj.window = originalWindow;
    globalObj.document = originalDocument;
  });

  describe('extractActivePlaylistPIndex', () => {
    it('returns null when no active playlist element exists in DOM', () => {
      mockElements = {};
      expect(extractActivePlaylistPIndex()).toBeNull();
    });

    it('extracts pIndex from anchor href query ?p=', () => {
      const activeLi = createMockElement('li', { class: 'on' }, '第2回 进阶');
      const anchor = createMockElement(
        'a',
        { href: 'https://www.bilibili.com/video/BV1rHh16CEfm?p=2' },
        '第2回 进阶'
      );
      activeLi.children.push(anchor);
      anchor.parentElement = activeLi;

      mockElements['.cur-list ul li.on'] = [activeLi];

      const result = extractActivePlaylistPIndex();
      expect(result).not.toBeNull();
      expect(result?.pIndex).toBe(2);
      expect(result?.title).toBe('第2回 进阶');
    });

    it('extracts pIndex from data-page / data-index attributes', () => {
      const activeCard = createMockElement(
        'div',
        { class: 'video-pod__item active', 'data-page': '3' },
        '第3集 核心机制'
      );
      mockElements['.video-pod__list .video-pod__item.active'] = [activeCard];

      const result = extractActivePlaylistPIndex();
      expect(result).not.toBeNull();
      expect(result?.pIndex).toBe(3);
      expect(result?.title).toBe('第3集 核心机制');
    });

    it('falls back to 1-based sibling index when no link or attribute exists', () => {
      const parent = createMockElement('div', { class: 'video-pod__list' });
      const item1 = createMockElement('div', { class: 'video-pod__item' }, '第1集');
      const item2 = createMockElement('div', { class: 'video-pod__item' }, '第2集');
      const item3 = createMockElement('div', { class: 'video-pod__item active' }, '第3集 实战演练');

      item1.parentElement = parent;
      item2.parentElement = parent;
      item3.parentElement = parent;
      parent.children = [item1, item2, item3];

      mockElements['.video-pod__list .video-pod__item.active'] = [item3];

      const result = extractActivePlaylistPIndex();
      expect(result).not.toBeNull();
      expect(result?.pIndex).toBe(3);
      expect(result?.title).toBe('第3集 实战演练');
    });
  });

  describe('extractVideoMeta', () => {
    it('extracts bvid and p parameter directly from URL if ?p= is specified', () => {
      mockLocation.pathname = '/video/BV1rHh16CEfm';
      mockLocation.search = '?p=4';

      const titleEl = createMockElement('h1', { class: 'video-title' }, '闪存技术分析');
      mockElements['h1.video-title'] = [titleEl];

      const meta = extractVideoMeta();
      expect(meta).not.toBeNull();
      expect(meta?.bvid).toBe('BV1rHh16CEfm');
      expect(meta?.pIndex).toBe(4);
      expect(meta?.title).toBe('闪存技术分析');
    });

    it('accurately resolves pIndex from DOM playlist when URL query ?p= has not updated', () => {
      mockLocation.pathname = '/video/BV1rHh16CEfm';
      mockLocation.search = ''; // URL has no ?p= parameter

      const activeItem = createMockElement(
        'div',
        { class: 'video-pod__item active', 'data-page': '2' },
        'P2 核心算法剖析 12:30'
      );
      mockElements['.video-pod__list .video-pod__item.active'] = [activeItem];

      const meta = extractVideoMeta();
      expect(meta).not.toBeNull();
      expect(meta?.bvid).toBe('BV1rHh16CEfm');
      expect(meta?.pIndex).toBe(2);
      expect(meta?.title).toBe('P2 核心算法剖析');
    });

    it('extracts bvid from query parameter on playlist / watchlater pages', () => {
      mockLocation.pathname = '/list/watchlater';
      mockLocation.search = '?bvid=BV1rHh16CEfm&oid=12345';

      const meta = extractVideoMeta();
      expect(meta).not.toBeNull();
      expect(meta?.bvid).toBe('BV1rHh16CEfm');
      expect(meta?.pIndex).toBe(1);
    });

    it('returns null if current page is not a Bilibili video page', () => {
      mockLocation.pathname = '/';

      const meta = extractVideoMeta();
      expect(meta).toBeNull();
    });
  });

  describe('isUserTyping', () => {
    it('detects input / textarea / contenteditable elements as active typing', () => {
      const globalObj = globalThis as { document?: { activeElement: unknown } };
      if (globalObj.document) {
        globalObj.document.activeElement = {
          tagName: 'INPUT',
          getAttribute: () => null,
        };

        expect(isUserTyping()).toBe(true);

        globalObj.document.activeElement = null;
        expect(isUserTyping()).toBe(false);
      }
    });
  });

  describe('getVideoDuration', () => {
    it('falls back to control bar duration text when video.duration is missing', () => {
      const timeSpan = createMockElement('span', { class: 'bpx-player-ctrl-time-duration' }, '05:30');
      mockElements['.bpx-player-ctrl-time-duration'] = [timeSpan];

      expect(getVideoDuration()).toBe(330);
    });
  });
});
