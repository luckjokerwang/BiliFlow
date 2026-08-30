import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: 'BiliFlow - 极速心流 B站视频总结与键盘导航',
    description: '无需鼠标、不占屏幕，快捷键一键呼出 HUD 并毫秒级跳转核心亮点的 B 站 AI 助手',
    version: '0.3.1',
    browser_specific_settings: {
      gecko: {
        id: 'biliflow@luckjokerwang',
        strict_min_version: '109.0',
      },
    },
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    permissions: ['storage'],
    host_permissions: [
      '*://*.bilibili.com/*',
      'https://*/*',
      'http://*/*'
    ],
    action: {
      default_title: 'BiliFlow 设置',
      default_icon: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  transformManifest(manifest) {
    if (manifest.options_ui) {
      manifest.options_ui.open_in_tab = true;
    }
  },
});
