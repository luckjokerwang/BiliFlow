import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { HighlightList } from '../src/entrypoints/content/components/HighlightList';
import { HighlightItem } from '../src/types';
import { NativeNoteInsertResult } from '../src/types/biliNote';

type CardInsert = (
  withScreenshot: boolean
) => Promise<NativeNoteInsertResult | void> | void;

type ListInsert = (
  highlight: HighlightItem,
  withScreenshot: boolean
) => Promise<NativeNoteInsertResult | void> | void;

type TestTree = {
  props: {
    children: [
      unknown,
      {
        props: {
          children: Array<{ props: { onInsertToNativeNote?: CardInsert } }>;
        };
      }
    ];
  };
};

function getWrappedCallback(
  element: React.ReactNode
): CardInsert | undefined {
  if (!element || !React.isValidElement(element)) {
    throw new Error('Expected HighlightList to render');
  }
  const tree = element as unknown as TestTree;
  return tree.props.children[1].props.children[0].props.onInsertToNativeNote;
}

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

  const renderList = (onInsertToNativeNote?: ListInsert) =>
    HighlightList({
      isDark: false,
      highlights: mockHighlights,
      selectedIndex: 0,
      expandedQuoteIds: new Set(),
      enableNumberKeySeek: true,
      currentPlaybackSec: 0,
      onJump: vi.fn(),
      onToggleQuoteExpand: vi.fn(),
      onSeekQuote: vi.fn(),
      onInsertToNativeNote,
      itemRefs: { current: [] },
    });

  it('propagates injected result from onInsertToNativeNote', async () => {
    const mockOnInsert = vi.fn().mockResolvedValue('injected');
    const wrappedCallback = getWrappedCallback(renderList(mockOnInsert));

    expect(typeof wrappedCallback).toBe('function');
    const result = await wrappedCallback?.(true);

    expect(mockOnInsert).toHaveBeenCalledWith(mockHighlights[0], true);
    expect(result).toBe('injected');
  });

  it('propagates failed result so UI micro-feedback handles error state', async () => {
    const mockOnInsert = vi.fn().mockResolvedValue('failed');
    const wrappedCallback = getWrappedCallback(renderList(mockOnInsert));

    const result = await wrappedCallback?.(false);

    expect(mockOnInsert).toHaveBeenCalledWith(mockHighlights[0], false);
    expect(result).toBe('failed');
  });

  it('propagates queued result without collapsing it to undefined', async () => {
    const mockOnInsert = vi.fn().mockResolvedValue('queued');
    const wrappedCallback = getWrappedCallback(renderList(mockOnInsert));

    const result = await wrappedCallback?.(false);

    expect(result).toBe('queued');
  });

  it('returns undefined if onInsertToNativeNote is not provided', () => {
    const wrappedCallback = getWrappedCallback(renderList(undefined));
    expect(wrappedCallback).toBeUndefined();
  });
});
