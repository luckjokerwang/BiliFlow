import './style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { HudOverlay } from './HudOverlay';

export default defineContentScript({
  matches: ['*://*.bilibili.com/video/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    console.log('[BiliFlow] Content Script loaded on Bilibili video page.');

    const ui = await createShadowRootUi(ctx, {
      name: 'biliflow-hud-root',
      position: 'inline',
      anchor: '.bpx-player-container, #bilibili-player, .bilibili-player, body',
      append: 'last',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(
          <React.StrictMode>
            <HudOverlay />
          </React.StrictMode>
        );
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();

    // Re-parent HUD host element into fullscreen container dynamically so it is always on top
    const handleFullscreenChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      const hostEl = document.querySelector('biliflow-hud-root');
      if (fsEl && hostEl && !fsEl.contains(hostEl)) {
        fsEl.appendChild(hostEl);
      } else if (!fsEl && hostEl) {
        const playerContainer =
          document.querySelector('.bpx-player-container') ||
          document.querySelector('#bilibili-player') ||
          document.body;
        if (playerContainer && !playerContainer.contains(hostEl)) {
          playerContainer.appendChild(hostEl);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  },
});
