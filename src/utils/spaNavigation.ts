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
/**
 * Injects a minimal bridge script into the page's Main World to intercept
 * history.pushState and history.replaceState, bridging the event to Content Script via CustomEvent.
 */
export function injectMainWorldBridge(): void {
  if (typeof document === 'undefined') return;
  try {
    const container = document.head || document.documentElement;
    if (!container) return;
    const script = document.createElement('script');
    script.id = 'biliflow-spa-bridge';
    script.textContent = `(${function () {
      const win = window as unknown as Record<string, unknown>;
      if (win.__biliflow_spa_injected) return;
      win.__biliflow_spa_injected = true;

      const notify = () => {
        try {
          window.dispatchEvent(
            new CustomEvent('biliflow:spa-navigate', {
              detail: { url: window.location.href },
            })
          );
        } catch {}
      };

      const origPush = history.pushState;
      if (typeof origPush === 'function') {
        history.pushState = function (...args) {
          const prev = window.location.href;
          const res = origPush.apply(this, args);
          if (window.location.href !== prev) notify();
          return res;
        };
      }

      const origReplace = history.replaceState;
      if (typeof origReplace === 'function') {
        history.replaceState = function (...args) {
          const prev = window.location.href;
          const res = origReplace.apply(this, args);
          if (window.location.href !== prev) notify();
          return res;
        };
      }

      window.addEventListener('popstate', notify);
    }.toString()})();`;
    container.appendChild(script);
    script.remove();
  } catch {
    // Graceful fallback to isolated-world hooks and polling
  }
}

export function initSpaNavigationWatcher(): void {
  if (typeof window === 'undefined' || isWatcherInitialized) {
    return;
  }

  isWatcherInitialized = true;

  // 1. Inject Main World bridge to capture page-level pushState / replaceState (0ms response)
  injectMainWorldBridge();
  const dispatchNavEvent = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('biliflow:spa-navigate', {
          detail: { url: window.location.href },
        })
      );
    } catch {
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
