/**
 * SPA Navigation Watcher for Bilibili Video Pages.
 * 
 * Intercepts history.pushState and history.replaceState to achieve 0ms reactive
 * detection of client-side route changes without waiting for polling intervals.
 */

let isWatcherInitialized = false;

export function _resetWatcherForTesting(): void {
  isWatcherInitialized = false;
}

export function initSpaNavigationWatcher(): void {
  if (typeof window === 'undefined' || isWatcherInitialized) {
    return;
  }

  isWatcherInitialized = true;

  const dispatchNavEvent = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('biliflow:spa-navigate', {
          detail: { url: window.location.href },
        })
      );
    } catch (e) {
      // Ignore in environments where CustomEvent might fail
    }
  };

  // 1. Wrap history.pushState
  const origPushState = history.pushState;
  if (typeof origPushState === 'function' && !(origPushState as any).__biliflow_wrapped) {
    const wrappedPushState = function (this: History, ...args: Parameters<typeof origPushState>) {
      const prevUrl = window.location.href;
      const res = origPushState.apply(this, args);
      if (window.location.href !== prevUrl) {
        dispatchNavEvent();
      }
      return res;
    };
    (wrappedPushState as any).__biliflow_wrapped = true;
    history.pushState = wrappedPushState;
  }

  // 2. Wrap history.replaceState
  const origReplaceState = history.replaceState;
  if (typeof origReplaceState === 'function' && !(origReplaceState as any).__biliflow_wrapped) {
    const wrappedReplaceState = function (this: History, ...args: Parameters<typeof origReplaceState>) {
      const prevUrl = window.location.href;
      const res = origReplaceState.apply(this, args);
      if (window.location.href !== prevUrl) {
        dispatchNavEvent();
      }
      return res;
    };
    (wrappedReplaceState as any).__biliflow_wrapped = true;
    history.replaceState = wrappedReplaceState;
  }

  // 3. Forward popstate to custom event
  window.addEventListener('popstate', dispatchNavEvent);
}

/**
 * Subscribes to SPA navigation changes.
 * Returns an unsubscribe cleanup function.
 */
export function onSpaNavigate(callback: (url: string) => void): () => void {
  initSpaNavigationWatcher();

  let lastUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleNav = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  };

  window.addEventListener('biliflow:spa-navigate', handleNav);
  window.addEventListener('popstate', handleNav);

  // Safety fallback polling in case page changes without history API (e.g. hash changes)
  const pollTimer = setInterval(handleNav, 1000);

  return () => {
    window.removeEventListener('biliflow:spa-navigate', handleNav);
    window.removeEventListener('popstate', handleNav);
    clearInterval(pollTimer);
  };
}

/**
 * Determines whether a URL change constitutes a substantial video switch
 * (either BV ID changed or pIndex ?p= changed).
 */
export function hasVideoUrlChanged(urlA: string, urlB: string): boolean {
  if (urlA === urlB) return false;

  const extractKey = (urlStr: string) => {
    try {
      const u = new URL(urlStr, 'https://www.bilibili.com');
      const match = u.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      const bvid = match ? match[1] : '';
      const p = u.searchParams.get('p') || '1';
      return `${bvid}_p${p}`;
    } catch {
      return urlStr;
    }
  };

  return extractKey(urlA) !== extractKey(urlB);
}
