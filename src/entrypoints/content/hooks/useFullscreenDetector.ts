import { useState, useEffect } from 'react';
import { UserSettings } from '../../../types/settings';
import { isUserTyping } from '../../../utils/playerController';
import { HudViewMode, getNextHudViewMode } from '../../../utils/hudNavigation';
import { resolveShortcut } from '../../../utils/shortcutDefinitions';

export interface UseFullscreenDetectorProps {
  settings: UserSettings;
  isOpen: boolean;
  onToggleOpen: () => void;
  viewMode: HudViewMode;
  onViewModeChange: (mode: HudViewMode) => void;
  onClose: () => void;
  onPrevHighlight?: () => void;
  onNextHighlight?: () => void;
  onToggleQuotes?: () => void;
  onNumberKeySeek?: (digit: number) => void;
  onQuickNote?: () => void;
  onToggleHelp?: () => void;
  isShortcutHelpOpen?: boolean;
  onRefresh?: () => void;
  onCopyMarkdown?: () => void;
  onPrevHighlightArrow?: () => void;
  onNextHighlightArrow?: () => void;
  onSearchTranscript?: () => void;
  onScrollCurrentView?: (direction: -1 | 1) => void;
  hasSummary?: boolean;
}

export interface UseFullscreenDetectorReturn {
  isFullscreen: boolean;
}

export function matchesShortcut(e: KeyboardEvent, shortcutStr?: string): boolean {
  if (!shortcutStr) return false;

  const parts = shortcutStr.split('+').map((p) => p.trim().toLowerCase());
  const needCtrl = parts.includes('ctrl') || parts.includes('control');
  const needAlt = parts.includes('alt') || parts.includes('option');
  const needShift = parts.includes('shift');
  const needMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');

  if (e.ctrlKey !== needCtrl) return false;
  if (e.altKey !== needAlt) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.metaKey !== needMeta) return false;

  const keyPart = parts.find(
    (p) => !['ctrl', 'control', 'alt', 'option', 'shift', 'meta', 'cmd', 'command'].includes(p)
  );
  if (!keyPart) return false;

  const keyLower = e.key.toLowerCase();
  const codeLower = e.code.toLowerCase();
  return (
    keyLower === keyPart ||
    codeLower === `key${keyPart}` ||
    codeLower === `digit${keyPart}` ||
    codeLower === keyPart
  );
}

function consumeKey(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

export function useFullscreenDetector({
  settings,
  isOpen,
  viewMode,
  onViewModeChange,
  onToggleOpen,
  onClose,
  onPrevHighlight,
  onNextHighlight,
  onToggleQuotes,
  onNumberKeySeek,
  onQuickNote,
  onToggleHelp,
  isShortcutHelpOpen = false,
  onRefresh,
  onCopyMarkdown,
  onPrevHighlightArrow,
  onNextHighlightArrow,
  onSearchTranscript,
  onScrollCurrentView,
  hasSummary = false,
}: UseFullscreenDetectorProps): UseFullscreenDetectorReturn {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const checkFullscreen = () => {
      const fullscreenDocument = document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
      };
      const isFs = Boolean(
        fullscreenDocument.fullscreenElement ||
          fullscreenDocument.webkitFullscreenElement ||
          fullscreenDocument.mozFullScreenElement ||
          document.querySelector('.bpx-player-container[data-screen="web"]') ||
          document.querySelector('.bpx-player-container[data-screen="full"]')
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    window.addEventListener('resize', checkFullscreen);
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
      window.removeEventListener('resize', checkFullscreen);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        consumeKey(e);
        if (isShortcutHelpOpen) onToggleHelp?.();
        else onClose();
        return;
      }

      if (isUserTyping(e)) return;

      if (matchesShortcut(e, resolveShortcut('toggle', settings))) {
        consumeKey(e);
        onToggleOpen();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('quickNote', settings))) {
        consumeKey(e);
        onQuickNote?.();
        return;
      }

      if (!isOpen) return;

      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        consumeKey(e);
        onViewModeChange(getNextHudViewMode(viewMode, e.shiftKey));
        return;
      }

      if (matchesShortcut(e, resolveShortcut('help', settings))) {
        consumeKey(e);
        onToggleHelp?.();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('refresh', settings))) {
        consumeKey(e);
        onRefresh?.();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('copyMarkdown', settings))) {
        if (!hasSummary) return;
        consumeKey(e);
        onCopyMarkdown?.();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('prevView', settings))) {
        consumeKey(e);
        onViewModeChange(getNextHudViewMode(viewMode, true));
        return;
      }
      if (matchesShortcut(e, resolveShortcut('nextView', settings))) {
        consumeKey(e);
        onViewModeChange(getNextHudViewMode(viewMode, false));
        return;
      }

      // HUD 展开时 ↑/↓ 始终由 HUD 接管；同时拦截 keyup，避免 B 站播放器调音量。
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        consumeKey(e);
        const direction: -1 | 1 = e.key === 'ArrowUp' ? -1 : 1;
        if (!isShortcutHelpOpen && viewMode === 'summary') {
          const callback = direction < 0 ? onPrevHighlightArrow : onNextHighlightArrow;
          callback?.();
        } else {
          onScrollCurrentView?.(direction);
        }
        return;
      }

      if (viewMode === 'transcript') {
        if (matchesShortcut(e, resolveShortcut('searchTranscript', settings))) {
          consumeKey(e);
          onSearchTranscript?.();
          return;
        }
        return;
      }
      if (viewMode !== 'summary') return;

      if (matchesShortcut(e, resolveShortcut('prev', settings))) {
        consumeKey(e);
        onPrevHighlight?.();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('next', settings))) {
        consumeKey(e);
        onNextHighlight?.();
        return;
      }
      if (matchesShortcut(e, resolveShortcut('quotes', settings))) {
        consumeKey(e);
        onToggleQuotes?.();
        return;
      }

      if (
        settings.enableNumberKeySeek &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          consumeKey(e);
          onNumberKeySeek?.(digit);
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isOpen || isUserTyping(e)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') consumeKey(e);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [
    settings,
    isOpen,
    viewMode,
    onViewModeChange,
    onToggleOpen,
    onClose,
    onPrevHighlight,
    onNextHighlight,
    onToggleQuotes,
    onNumberKeySeek,
    onQuickNote,
    onToggleHelp,
    isShortcutHelpOpen,
    onRefresh,
    onCopyMarkdown,
    onSearchTranscript,
    onScrollCurrentView,
    onPrevHighlightArrow,
    onNextHighlightArrow,
    hasSummary,
  ]);

  return { isFullscreen };
}
