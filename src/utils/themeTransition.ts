import React from 'react';
import ReactDOM from 'react-dom';
/**
 * Triggers a circular ripple reveal theme transition originating from the click coordinates.
 * Inspired by VitePress and Telegram circular dark mode transition.
 * Gracefully falls back to instantaneous toggle when unsupported or prefers-reduced-motion.
 */
export function toggleThemeWithTransition(
  e: React.MouseEvent | MouseEvent | undefined,
  toggleFn: () => void
): void {
  const doc =
    typeof document !== 'undefined'
      ? (document as Document & {
          startViewTransition?: (updateCallback: () => Promise<void> | void) => {
            ready: Promise<void>;
            finished: Promise<void>;
          };
        })
      : null;

  if (
    !doc ||
    typeof doc.startViewTransition !== 'function' ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  ) {
    toggleFn();
    return;
  }

  const x = e?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const y = e?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
  const endRadius = Math.hypot(
    Math.max(x, typeof window !== 'undefined' ? window.innerWidth - x : 1000),
    Math.max(y, typeof window !== 'undefined' ? window.innerHeight - y : 1000)
  );

  const transition = doc.startViewTransition(() => {
    if (typeof ReactDOM.flushSync === 'function') {
      ReactDOM.flushSync(() => {
        toggleFn();
      });
    } else {
      toggleFn();
    }
  });

  transition.ready
    .then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 700,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => {
      // Graceful fallback if transition animation was interrupted
    });
}
