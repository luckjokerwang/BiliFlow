import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { HighlightList } from '../src/entrypoints/content/components/HighlightList';
import { HighlightItem } from '../src/types';

describe('HighlightList onInsertToNativeNote callback wrapper', () => {
  const mockHighlights: HighlightItem[] = [
    {
      id: 'h1',
      title: 'Test Headline',
      timestamp: 45,
      timestampSec: 45,
      timestampStr: '00:45',
      keyPoint: 'Test key insight',
    },
  ];

  it('correctly propagates boolean true from onInsertToNativeNote callback', async () => {
    const mockOnInsert = vi.fn().mockResolvedValue(true);
    const itemRefs = { current: [] };

    const element = HighlightList({
      isDark: false,
      highlights: mockHighlights,
      selectedIndex: 0,
      expandedQuoteIds: new Set(),
      enableNumberKeySeek: true,
      currentPlaybackSec: 0,
      onJump: vi.fn(),
      onToggleQuoteExpand: vi.fn(),
      onSeekQuote: vi.fn(),
      onInsertToNativeNote: mockOnInsert,
      itemRefs,
    });

    expect(element).not.toBeNull();
    // In the rendered component tree, the child HighlightItemCard receives onInsertToNativeNote
    const cardElement = (element as any).props.children[1].props.children[0];
    const wrappedCallback = cardElement.props.onInsertToNativeNote;

    expect(typeof wrappedCallback).toBe('function');
    const result = await wrappedCallback(true);

    expect(mockOnInsert).toHaveBeenCalledWith(mockHighlights[0], true);
    expect(result).toBe(true);
  });

  it('correctly propagates boolean false so UI micro-feedback handles error state properly', async () => {
    const mockOnInsert = vi.fn().mockResolvedValue(false);
    const itemRefs = { current: [] };

    const element = HighlightList({
      isDark: false,
      highlights: mockHighlights,
      selectedIndex: 0,
      expandedQuoteIds: new Set(),
      enableNumberKeySeek: true,
      currentPlaybackSec: 0,
      onJump: vi.fn(),
      onToggleQuoteExpand: vi.fn(),
      onSeekQuote: vi.fn(),
      onInsertToNativeNote: mockOnInsert,
      itemRefs,
    });

    const cardElement = (element as any).props.children[1].props.children[0];
    const wrappedCallback = cardElement.props.onInsertToNativeNote;

    const result = await wrappedCallback(false);

    expect(mockOnInsert).toHaveBeenCalledWith(mockHighlights[0], false);
    // Crucial regression check: must be false, NOT undefined (which would fool `res !== false`)
    expect(result).toBe(false);
  });

  it('returns undefined if onInsertToNativeNote is not provided', () => {
    const itemRefs = { current: [] };

    const element = HighlightList({
      isDark: false,
      highlights: mockHighlights,
      selectedIndex: 0,
      expandedQuoteIds: new Set(),
      enableNumberKeySeek: true,
      currentPlaybackSec: 0,
      onJump: vi.fn(),
      onToggleQuoteExpand: vi.fn(),
      onSeekQuote: vi.fn(),
      onInsertToNativeNote: undefined,
      itemRefs,
    });

    const cardElement = (element as any).props.children[1].props.children[0];
    expect(cardElement.props.onInsertToNativeNote).toBeUndefined();
  });
});
