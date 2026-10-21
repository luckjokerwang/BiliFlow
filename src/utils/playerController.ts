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
    if (fsEl.tagName.toLowerCase() === 'video' && fsEl.parentElement) {
      return fsEl.parentElement;
    }
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
  // Target the unscaled 100%-width track container that wraps the progress schedule.
  // In Bilibili player:
  // .bpx-player-progress-schedule is the scaled progress element;
  // Its parent is the exact unscaled track container sharing the identical vertical and horizontal alignment.
  const schedule = document.querySelector<HTMLElement>('.bpx-player-progress-schedule');
  if (schedule && schedule.parentElement) {
    return schedule.parentElement;
  }

  const squirtleSchedule = document.querySelector<HTMLElement>('.squirtle-progress-schedule');
  if (squirtleSchedule && squirtleSchedule.parentElement) {
    return squirtleSchedule.parentElement;
  }

  return (
    document.querySelector<HTMLElement>('.bpx-player-progress-schedule-wrap') ||
    document.querySelector<HTMLElement>('.bpx-player-progress-wrap') ||
    document.querySelector<HTMLElement>('.bpx-player-progress') ||
    document.querySelector<HTMLElement>('.squirtle-progress-wrap') ||
    document.querySelector<HTMLElement>('.squirtle-progress') ||
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

export function isUserTyping(e?: Event | KeyboardEvent): boolean {
  // 1. Check document.activeElement
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
  if (activeEl) {
    const tagName = activeEl.tagName.toUpperCase();
    if (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      activeEl.getAttribute('contenteditable') === 'true' ||
      (activeEl as HTMLElement).isContentEditable
    ) {
      return true;
    }
  }

  // 2. Check event target or composedPath for Shadow DOM inputs
  if (e) {
    const target = (e.target || (e.composedPath && e.composedPath()[0])) as any;
    const isElement =
      typeof HTMLElement !== 'undefined'
        ? target instanceof HTMLElement
        : Boolean(target && typeof target === 'object' && target.tagName);

    if (isElement && target) {
      const tagName = (target.tagName || '').toUpperCase();
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        (typeof target.getAttribute === 'function' && target.getAttribute('contenteditable') === 'true') ||
        target.isContentEditable
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects active multi-P episode index from the page DOM when URL query ?p= has not updated yet.
 */
export function extractActivePlaylistPIndex(): { pIndex: number; title?: string } | null {
  if (typeof document === 'undefined') return null;

  // Selectors for active items in Bilibili playlist / episode containers:
  // 1. New video-pod list: .video-pod__list .video-pod__item.active
  // 2. Classic multi-P list: .cur-list ul li.on, .part-item.on, .list-box ul li.on
  // 3. UGC Season / Episode card: .video-episode-card.active, .ep-item.cursor
  const activeEl = document.querySelector<HTMLElement>(
    '.video-pod__list .video-pod__item.active, .video-episode-card.active, .cur-list ul li.on, .part-item.on, .list-box ul li.on'
  );

  if (!activeEl) return null;

  const title = activeEl.textContent ? activeEl.textContent.replace(/\d+:\d+$/, '').trim() : '';

  // 1. Try extracting ?p= from any internal link inside or on the element itself
  const anchor =
    activeEl.tagName.toLowerCase() === 'a'
      ? (activeEl as HTMLAnchorElement)
      : activeEl.querySelector<HTMLAnchorElement>('a');

  if (anchor && anchor.href) {
    try {
      const u = new URL(anchor.href, window.location.origin);
      const p = u.searchParams.get('p');
      if (p) {
        const parsed = parseInt(p, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return { pIndex: parsed, title };
        }
      }
    } catch {}
  }

  // 2. Try data attributes (e.g. data-page, data-p, data-index)
  const dataPage =
    activeEl.getAttribute('data-page') ||
    activeEl.getAttribute('data-p') ||
    activeEl.getAttribute('data-index');

  if (dataPage) {
    const parsed = parseInt(dataPage, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return { pIndex: parsed, title };
    }
  }

  // 3. Fallback: calculate 1-based index based on its position among sibling items
  if (activeEl.parentElement) {
    const siblings = Array.from(activeEl.parentElement.children).filter((child) =>
      child.matches?.('.video-pod__item, li, .video-episode-card, .part-item')
    );
    const idx = siblings.indexOf(activeEl);
    if (idx !== -1) {
      return { pIndex: idx + 1, title };
    }
  }

  return null;
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
  const rawUrlP = urlParams.get('p');
  const domPlaylist = extractActivePlaylistPIndex();

  let pIndex = 1;
  if (rawUrlP) {
    const parsedP = parseInt(rawUrlP, 10);
    if (!isNaN(parsedP) && parsedP > 0) {
      pIndex = parsedP;
    }
  } else if (domPlaylist && domPlaylist.pIndex > 0) {
    // Fallback to DOM playlist index when URL ?p= parameter has not synchronized
    pIndex = domPlaylist.pIndex;
  }

  // 3. Extract title directly from page DOM or active playlist item
  let title = domPlaylist?.title || '';

  if (!title) {
    const activePlaylistItem = document.querySelector(
      '.video-pod__list .video-pod__item.active, .video-episode-card.active, .cur-list ul li.on, .part-item.on, .list-box ul li.on'
    );
    if (activePlaylistItem && activePlaylistItem.textContent) {
      title = activePlaylistItem.textContent.replace(/\d+:\d+$/, '').trim();
    }
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
