import { useState, useEffect, useCallback, useRef } from 'react';
import { HighlightItem } from '../../../types';
import {
  getVideoElement,
  getVideoDuration,
  seekToSeconds,
} from '../../../utils/playerController';
import {
  findActiveHighlightIndex,
  findActiveQuoteIndex,
} from '../../../utils/timelineCalculator';

export interface UseVideoControllerProps {
  highlights: HighlightItem[];
}

export interface UseVideoControllerReturn {
  currentPlaybackSec: number;
  duration: number;
  activeHighlightIndex: number;
  activeQuoteIndex: number;
  seekTo: (seconds: number) => boolean;
  markUserManualAction: () => void;
  isUserManualActionActive: () => boolean;
}

export function useVideoController({
  highlights,
}: UseVideoControllerProps): UseVideoControllerReturn {
  const [currentPlaybackSec, setCurrentPlaybackSec] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Manual interaction cooldown: pauses auto-scroll when user clicks, navigates, or scrubs
  const userManualActionUntilRef = useRef<number>(0);

  const markUserManualAction = useCallback(() => {
    userManualActionUntilRef.current = Date.now() + 3000;
  }, []);

  const isUserManualActionActive = useCallback(() => {
    return Date.now() < userManualActionUntilRef.current;
  }, []);

  const currentVideoElRef = useRef<HTMLVideoElement | null>(null);

  // Poll or listen for video playback position & duration with dynamic video re-attachment
  useEffect(() => {
    const syncPlayback = () => {
      const video = getVideoElement();

      // Dynamic re-attachment if video element was destroyed or recreated by Bilibili
      if (video !== currentVideoElRef.current) {
        if (currentVideoElRef.current) {
          currentVideoElRef.current.removeEventListener('timeupdate', syncPlayback);
          currentVideoElRef.current.removeEventListener('durationchange', syncPlayback);
          currentVideoElRef.current.removeEventListener('loadedmetadata', syncPlayback);
          currentVideoElRef.current.removeEventListener('play', syncPlayback);
          currentVideoElRef.current.removeEventListener('pause', syncPlayback);
          currentVideoElRef.current.removeEventListener('seeked', syncPlayback);
        }

        if (video) {
          video.addEventListener('timeupdate', syncPlayback, { passive: true });
          video.addEventListener('durationchange', syncPlayback, { passive: true });
          video.addEventListener('loadedmetadata', syncPlayback, { passive: true });
          video.addEventListener('play', syncPlayback, { passive: true });
          video.addEventListener('pause', syncPlayback, { passive: true });
          video.addEventListener('seeked', syncPlayback, { passive: true });
        }

        currentVideoElRef.current = video;
      }

      if (video) {
        setCurrentPlaybackSec(video.currentTime || 0);
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setDuration(video.duration);
        } else {
          setDuration(getVideoDuration());
        }
      } else {
        setDuration(getVideoDuration());
      }
    };

    syncPlayback();
    // Periodic sync in case Bilibili replaces video element or during SPA transitions
    const timer = setInterval(syncPlayback, 500);

    return () => {
      clearInterval(timer);
      if (currentVideoElRef.current) {
        currentVideoElRef.current.removeEventListener('timeupdate', syncPlayback);
        currentVideoElRef.current.removeEventListener('durationchange', syncPlayback);
        currentVideoElRef.current.removeEventListener('loadedmetadata', syncPlayback);
        currentVideoElRef.current.removeEventListener('play', syncPlayback);
        currentVideoElRef.current.removeEventListener('pause', syncPlayback);
        currentVideoElRef.current.removeEventListener('seeked', syncPlayback);
        currentVideoElRef.current = null;
      }
    };
  }, []);

  // Compute active highlight
  const activeHighlightIndex = findActiveHighlightIndex(
    highlights,
    currentPlaybackSec,
    duration
  );

  // Compute active quote within active highlight
  const activeHighlight = highlights[activeHighlightIndex];
  const activeQuoteIndex = activeHighlight?.originalQuotes
    ? findActiveQuoteIndex(activeHighlight.originalQuotes, currentPlaybackSec)
    : -1;

  const seekTo = useCallback(
    (seconds: number): boolean => {
      markUserManualAction();
      return seekToSeconds(seconds);
    },
    [markUserManualAction]
  );

  return {
    currentPlaybackSec,
    duration,
    activeHighlightIndex,
    activeQuoteIndex,
    seekTo,
    markUserManualAction,
    isUserManualActionActive,
  };
}
