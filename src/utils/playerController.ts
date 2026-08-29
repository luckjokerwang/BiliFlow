/**
 * Video player interaction and page metadata extractor for Bilibili.
 */

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('bwp-video, video');
}

export function seekToSeconds(seconds: number): boolean {
  const video = getVideoElement();
  if (!video) {
    console.warn('[BiliFlow] Video element not found on page.');
    return false;
  }

  video.currentTime = seconds;
  if (video.paused) {
    video.play().catch(() => {});
  }
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
} | null {
  // 1. Extract BV from URL
  const match = window.location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  const bvid = match ? match[1] : '';

  if (!bvid) {
    return null;
  }

  // 2. Extract title
  let title = document.title.replace(/_哔哩哔哩_bilibili$/, '').trim();
  const titleEl = document.querySelector('h1.video-title, .video-info-title-inner');
  if (titleEl && titleEl.textContent) {
    title = titleEl.textContent.trim();
  }

  // 3. Extract CID / AID from window variables or DOM attributes
  let cid = '';
  let aid = '';

  try {
    const win = window as any;
    if (win.__INITIAL_STATE__?.videoData) {
      aid = String(win.__INITIAL_STATE__.videoData.aid || '');
      cid = String(win.__INITIAL_STATE__.videoData.cid || '');
    }
  } catch (e) {
    // Ignore DOM inspection failures
  }

  return {
    bvid,
    cid,
    aid,
    title,
  };
}
