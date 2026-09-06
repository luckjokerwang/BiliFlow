import React from 'react';
import ReactDOM from 'react-dom/client';
import { TimelineMarkers, TimelineCardOverlay } from '../entrypoints/content/TimelineMarkers';
import { TimelineMarker, TimelineSegment } from './timelineCalculator';
import {
  getProgressBarContainer,
  seekToSeconds,
  getPlayerContainer,
} from './playerController';

import { browser } from 'wxt/browser';

let markersRoot: ReactDOM.Root | null = null;
let markersHostEl: HTMLElement | null = null;

let cardRoot: ReactDOM.Root | null = null;
let cardHostEl: HTMLElement | null = null;

function injectCssLink(shadow: ShadowRoot): void {
  const cssUrl =
    typeof browser !== 'undefined' && browser.runtime?.getURL
      ? browser.runtime.getURL('content-scripts/content.css')
      : typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('content-scripts/content.css')
      : '';
  if (cssUrl) {
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = cssUrl;
    shadow.appendChild(linkEl);
  }
}

export function getProgressCardContainer(): HTMLElement | null {
  // Mount card overlay onto the unscaled progress bar area where .bpx-player-progress-popup lives
  // This guarantees the card is 100% immune to track scaleY transforms on hover
  return (
    document.querySelector<HTMLElement>('.bpx-player-progress-area') ||
    document.querySelector<HTMLElement>('.bpx-player-control-wrap') ||
    document.querySelector<HTMLElement>('.bpx-player-control-bottom') ||
    getPlayerContainer()
  );
}

export interface PlayerInjectionFlags {
  showTimelineMarkers?: boolean;
  showHoverCard?: boolean;
}

/**
 * Injects or updates Timeline Highlight Markers directly onto Bilibili's progress bar.
 * Respects showTimelineMarkers and showHoverCard feature flags.
 */
export function renderTimelineMarkers(
  markers: TimelineMarker[],
  segments: TimelineSegment[] = [],
  duration: number = 0,
  flags: PlayerInjectionFlags = { showTimelineMarkers: true, showHoverCard: true },
  onCustomSeek?: (sec: number) => void
): void {
  const showMarkers = flags.showTimelineMarkers !== false;
  const showCard = flags.showHoverCard !== false;

  // Handle timeline markers on/off
  if (!showMarkers) {
    if (markersRoot) {
      try { markersRoot.unmount(); } catch (e) {}
      markersRoot = null;
    }
    if (markersHostEl && markersHostEl.isConnected) {
      markersHostEl.remove();
    }
    markersHostEl = null;
    document.querySelectorAll('#biliflow-timeline-markers-host').forEach((el) => el.remove());
  } else {
    // 1. Mount markers onto track
    const trackTarget = getProgressBarContainer();
    if (trackTarget) {
      const computedStyle = window.getComputedStyle(trackTarget);
      if (computedStyle.position === 'static') {
        trackTarget.style.position = 'relative';
      }

      if (!markersHostEl || !markersHostEl.isConnected || markersHostEl.parentElement !== trackTarget) {
        if (markersRoot) {
          try {
            markersRoot.unmount();
          } catch (e) {}
          markersRoot = null;
        }
        if (markersHostEl && markersHostEl.isConnected) {
          markersHostEl.remove();
        }
        document.querySelectorAll('#biliflow-timeline-markers-host').forEach((el) => el.remove());

        markersHostEl = document.createElement('div');
        markersHostEl.id = 'biliflow-timeline-markers-host';
        markersHostEl.style.position = 'absolute';
        markersHostEl.style.inset = '0';
        markersHostEl.style.pointerEvents = 'none';
        markersHostEl.style.zIndex = '35';

        const shadow = markersHostEl.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.inset = '0';
        injectCssLink(shadow);
        shadow.appendChild(wrapper);

        trackTarget.appendChild(markersHostEl);
        markersRoot = ReactDOM.createRoot(wrapper);
      }

      if (markersRoot) {
        markersRoot.render(
          <React.StrictMode>
            <TimelineMarkers
              markers={markers}
              onSeek={onCustomSeek || seekToSeconds}
            />
          </React.StrictMode>
        );
      }
    }
  }

  // Handle hover card on/off
  if (!showCard) {
    if (cardRoot) {
      try { cardRoot.unmount(); } catch (e) {}
      cardRoot = null;
    }
    if (cardHostEl && cardHostEl.isConnected) {
      cardHostEl.remove();
    }
    cardHostEl = null;
    document.querySelectorAll('#biliflow-timeline-card-host').forEach((el) => el.remove());
  } else {
    // 2. Mount floating card overlay onto unscaled progress area (immune to track scaleY)
    const cardTarget = getProgressCardContainer();
    if (cardTarget && segments.length > 0 && duration > 0) {
      const computedStyle = window.getComputedStyle(cardTarget);
      if (computedStyle.position === 'static') {
        cardTarget.style.position = 'relative';
      }

      if (!cardHostEl || !cardHostEl.isConnected || cardHostEl.parentElement !== cardTarget) {
        if (cardRoot) {
          try {
            cardRoot.unmount();
          } catch (e) {}
          cardRoot = null;
        }
        if (cardHostEl && cardHostEl.isConnected) {
          cardHostEl.remove();
        }
        document.querySelectorAll('#biliflow-timeline-card-host').forEach((el) => el.remove());

        cardHostEl = document.createElement('div');
        cardHostEl.id = 'biliflow-timeline-card-host';
        cardHostEl.style.position = 'absolute';
        cardHostEl.style.inset = '0';
        cardHostEl.style.pointerEvents = 'none';
        cardHostEl.style.zIndex = '45';
        cardHostEl.style.overflow = 'visible';

        const shadow = cardHostEl.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.inset = '0';
        wrapper.style.overflow = 'visible';
        injectCssLink(shadow);
        shadow.appendChild(wrapper);

        cardTarget.appendChild(cardHostEl);
        cardRoot = ReactDOM.createRoot(wrapper);
      }

      if (cardRoot) {
        cardRoot.render(
          <React.StrictMode>
            <TimelineCardOverlay
              segments={segments}
              duration={duration}
            />
          </React.StrictMode>
        );
      }
    }
  }
}

/**
 * Cleans up injected elements on video change.
 */
export function cleanupPlayerInjections(): void {
  if (markersRoot) {
    try {
      markersRoot.unmount();
    } catch (e) {}
    markersRoot = null;
  }
  if (markersHostEl && markersHostEl.isConnected) {
    markersHostEl.remove();
  }
  markersHostEl = null;

  if (cardRoot) {
    try {
      cardRoot.unmount();
    } catch (e) {}
    cardRoot = null;
  }
  if (cardHostEl && cardHostEl.isConnected) {
    cardHostEl.remove();
  }
  cardHostEl = null;

  document.querySelectorAll('#biliflow-timeline-markers-host, #biliflow-timeline-card-host').forEach((el) => el.remove());
}
