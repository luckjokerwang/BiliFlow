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
    version: '0.1.0',
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      '*://*.bilibili.com/*',
      'https://api.bilibili.com/*'
    ],
    action: {
      default_title: 'BiliFlow 设置',
    },
  },
});
