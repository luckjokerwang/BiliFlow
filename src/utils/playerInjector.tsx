import React from 'react';
import ReactDOM from 'react-dom/client';
import { TimelineMarkers } from '../entrypoints/content/TimelineMarkers';
import { TimelineMarker } from './timelineCalculator';
import {
  getProgressBarContainer,
  seekToSeconds,
} from './playerController';

let markersRoot: ReactDOM.Root | null = null;
let markersHostEl: HTMLElement | null = null;

function getCssLinkHtml(): string {
  const cssUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('content-scripts/content.css')
      : '';
  return cssUrl ? `<link rel="stylesheet" href="${cssUrl}">` : '';
}

/**
 * Injects or updates Timeline Highlight Markers directly onto Bilibili's progress bar.
 */
export function renderTimelineMarkers(
  markers: TimelineMarker[],
  onCustomSeek?: (sec: number) => void
): void {
  const target = getProgressBarContainer();
  if (!target) {
    return;
  }

  // Ensure target has position: relative so percentage markers align correctly
  const computedStyle = window.getComputedStyle(target);
  if (computedStyle.position === 'static') {
    target.style.position = 'relative';
  }

  if (!markersHostEl || !markersHostEl.isConnected) {
    if (markersRoot) {
      try {
        markersRoot.unmount();
      } catch (e) {}
      markersRoot = null;
    }

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
    shadow.innerHTML = getCssLinkHtml();
    shadow.appendChild(wrapper);

    target.appendChild(markersHostEl);
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
}
