import './style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { HudOverlay } from './HudOverlay';
import { getPlayerContainer } from '../../utils/playerController';

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

    const hostEl = ui.shadowHost;
    if (hostEl) {
      hostEl.style.display = 'block';
      hostEl.style.position = 'absolute';
      hostEl.style.inset = '0';
      hostEl.style.width = '100%';
      hostEl.style.height = '100%';
      hostEl.style.pointerEvents = 'none';
      hostEl.style.zIndex = '2147483647';
    }

    // Safely and dynamically keep HUD host mounted inside the active target container (fullscreen or player)
    const ensureHostMounted = () => {
      const target = getPlayerContainer();
      if (target && hostEl && hostEl.parentElement !== target) {
        try {
          target.appendChild(hostEl);
        } catch (err) {
          console.warn('[BiliFlow] Failed to reparent HUD host:', err);
        }
      }
    };

    // 1. Listen to fullscreen change events across standard, WebKit, and Gecko/Zen
    const handleFullscreenTransition = () => {
      ensureHostMounted();
      // Handle B站 delayed player layout transitions and animations
      setTimeout(ensureHostMounted, 50);
      setTimeout(ensureHostMounted, 300);
      setTimeout(ensureHostMounted, 800);
    };

    document.addEventListener('fullscreenchange', handleFullscreenTransition);
    document.addEventListener('webkitfullscreenchange', handleFullscreenTransition);
    document.addEventListener('mozfullscreenchange', handleFullscreenTransition);

    // 2. Listen to Zen Browser window geometry, split screen, or visibility changes
    window.addEventListener('resize', ensureHostMounted);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        ensureHostMounted();
      }
    });

    // 3. Custom event dispatched right before opening HUD
    window.addEventListener('biliflow:ensure-mount', ensureHostMounted);

    // 4. Periodic heartbeat check to automatically recover if B站 destroys the container during SPA navigation
    const mountHeartbeat = setInterval(() => {
      if (!hostEl || !document.contains(hostEl)) {
        ensureHostMounted();
      }
    }, 1000);

    ctx.onInvalidated(() => {
      clearInterval(mountHeartbeat);
      document.removeEventListener('fullscreenchange', handleFullscreenTransition);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenTransition);
      document.removeEventListener('mozfullscreenchange', handleFullscreenTransition);
      window.removeEventListener('resize', ensureHostMounted);
      window.removeEventListener('biliflow:ensure-mount', ensureHostMounted);
    });
  },
});
