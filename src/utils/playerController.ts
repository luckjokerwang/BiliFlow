/**
 * Video player interaction, DOM element locators, and metadata extractor for Bilibili.
 */

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('bwp-video, video');
}

export function getVideoDuration(): number {
  const video = getVideoElement();
  if (video && video.duration && !isNaN(video.duration) && video.duration > 0) {
    return video.duration;
  }

  // Fallback: parse time from Bilibili control bar (e.g. "07:42 / 08:21")
  const durationEl = document.querySelector(
    '.bpx-player-ctrl-time-duration, .squirtle-time-duration, .bilibili-player-video-time-total'
  );
  if (durationEl && durationEl.textContent) {
    const parts = durationEl.textContent.trim().split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  return 0;
}

export function getPlayerContainer(): HTMLElement | null {
  // If native fullscreen is active, return the fullscreen element
  const fsEl =
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement;

  if (fsEl && fsEl instanceof HTMLElement) {
    return fsEl;
  }

  // Main Bilibili player containers
  return (
    document.querySelector<HTMLElement>('.bpx-player-container') ||
    document.querySelector<HTMLElement>('#bilibili-player') ||
    document.querySelector<HTMLElement>('.bilibili-player') ||
    document.querySelector<HTMLElement>('#playerWrap') ||
    document.body
  );
}

export function getProgressBarContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.bpx-player-progress-schedule') ||
    document.querySelector<HTMLElement>('.bpx-player-progress') ||
    document.querySelector<HTMLElement>('.squirtle-progress-schedule') ||
    document.querySelector<HTMLElement>('.bilibili-player-video-progress-slider')
  );
}

export function seekToSeconds(seconds: number): boolean {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    console.warn('[BiliFlow] Invalid seek target seconds:', seconds);
    return false;
  }

  const video = getVideoElement();
  if (video) {
    video.currentTime = seconds;
    if (video.paused) {
      video.play().catch(() => {});
    }
  }

  // Also try Bilibili player JavaScript API if available
  try {
    const win = window as any;
    if (win.player && typeof win.player.seek === 'function') {
      win.player.seek(seconds);
    }
  } catch (e) {}

  return true;
}

export function isUserTyping(): boolean {
  const activeEl = document.activeElement;
  if (!activeEl) return false;

  const tagName = activeEl.tagName.toUpperCase();
  const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
  const isEditable = activeEl.getAttribute('contenteditable') === 'true';

  return isInput || isEditable;
}

export function extractVideoMeta(): {
  bvid: string;
  cid: string;
  aid: string;
  title: string;
  pIndex: number;
} | null {
  // 1. Extract BV from URL
  const match = window.location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  const bvid = match ? match[1] : '';

  if (!bvid) {
    return null;
  }

  // 2. Extract p parameter for multi-P / playlist videos
  const urlParams = new URLSearchParams(window.location.search);
  const pIndex = parseInt(urlParams.get('p') || '1', 10);

  // 3. Extract title directly from page DOM or active playlist item
  let title = '';
  const activePlaylistItem = document.querySelector(
    '.video-pod__list .video-pod__item.active, .video-episode-card.active, .cur-list ul li.on, .part-item.on'
  );
  if (activePlaylistItem && activePlaylistItem.textContent) {
    title = activePlaylistItem.textContent.replace(/\d+:\d+$/, '').trim();
  }

  if (!title) {
    const titleEl = document.querySelector('h1.video-title, .video-info-title-inner, .video-title .tit');
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }
  }

  if (!title) {
    title = document.title.replace(/_哔哩哔哩_bilibili$/, '').trim();
  }

  return {
    bvid,
    cid: '', // Always dynamically resolved via API to guarantee accurate CID for collections/multi-P
    aid: '',
    title,
    pIndex,
  };
}
