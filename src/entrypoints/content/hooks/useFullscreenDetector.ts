import { useState, useEffect } from 'react';
import { UserSettings } from '../../../types/settings';
import { isUserTyping } from '../../../utils/playerController';

export interface UseFullscreenDetectorProps {
  settings: UserSettings;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onPrevHighlight?: () => void;
  onNextHighlight?: () => void;
  onToggleQuotes?: () => void;
  onNumberKeySeek?: (digit: number) => void;
}

export interface UseFullscreenDetectorReturn {
  isFullscreen: boolean;
}

function matchesShortcut(e: KeyboardEvent, shortcutStr?: string): boolean {
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

export function useFullscreenDetector({
  settings,
  isOpen,
  onToggleOpen,
  onClose,
  onPrevHighlight,
  onNextHighlight,
  onToggleQuotes,
  onNumberKeySeek,
}: UseFullscreenDetectorProps): UseFullscreenDetectorReturn {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fullscreen change tracking
  useEffect(() => {
    const checkFullscreen = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUserTyping(e)) {
        return;
      }

      // 1. Toggle HUD
      if (matchesShortcut(e, settings.shortcutToggle)) {
        e.preventDefault();
        e.stopPropagation();
        onToggleOpen();
        return;
      }

      // 2. Close HUD on Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // 3. Highlight navigation (J / K)
      if (matchesShortcut(e, settings.shortcutPrevNode)) {
        e.preventDefault();
        e.stopPropagation();
        onPrevHighlight?.();
        return;
      }

      if (matchesShortcut(e, settings.shortcutNextNode)) {
        e.preventDefault();
        e.stopPropagation();
        onNextHighlight?.();
        return;
      }

      // 4. Toggle quotes expansion (O)
      if (matchesShortcut(e, settings.shortcutToggleQuotes)) {
        e.preventDefault();
        e.stopPropagation();
        onToggleQuotes?.();
        return;
      }

      // 5. 1~9 Number Key Seek (Feature Flag: enableNumberKeySeek)
      if (
        settings.enableNumberKeySeek &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          e.preventDefault();
          e.stopPropagation();
          onNumberKeySeek?.(digit);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    settings,
    isOpen,
    onToggleOpen,
    onClose,
    onPrevHighlight,
    onNextHighlight,
    onToggleQuotes,
    onNumberKeySeek,
  ]);

  return { isFullscreen };
}
