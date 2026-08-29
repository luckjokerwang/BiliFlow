# ⚡ BiliFlow (极速心流)

> **极速心流 · B站视频 AI 总结与全键盘导航 Chrome 扩展 (Manifest V3)**  
> 无需鼠标、不占屏幕，按一个快捷键呼出极简 HUD 浮层，毫秒级跳转视频核心亮点，观影心流零打扰。

---

## ✨ 核心特性

- ⚡ **键盘流极速跳转 (Keyboard-First)**：
  - `Alt + S`：一键呼出 / 隐藏半透明 HUD 浮层；
  - `1` ~ `9`：按数字键瞬间直达对应亮点时间戳；
  - `J` / `K` 或 `↑` / `↓`：上下节点快速切换；
  - `Esc`：秒级退场，不中断观影。
- 🔮 **沉浸式 HUD 浮层 (Glassmorphism)**：
  - 基于 Shadow DOM 样式强隔离，不破坏 B 站宽屏、剧场或全屏模式。
- 🧠 **多大模型支持 (BYOK - 自填 API Key)**：
  - 内置 DeepSeek、硅基流动 (SiliconFlow)、Google Gemini、OpenAI 预设，零门槛配置。
- 🛡️ **安全与防御式架构**：
  - 后台 Service Worker 统一代理网络请求，规避 CSP 与 CORS 限制；
  - 智能屏蔽输入框焦点，评论/弹幕打字防误触。

---

## 🛠️ 技术栈

- **框架**：[WXT Framework](https://wxt.dev/) (Next-Gen Web Extension Framework)
- **前端**：React 18 + TypeScript + Tailwind CSS + Lucide Icons
- **单测**：Vitest (遵循 TDD 规范)
- **规范标准**：Chrome Extension Manifest V3 + Shadow DOM

---

## 🚀 快速上手与本地开发

### 1. 安装依赖
```bash
npm install
```

### 2. 运行单测
```bash
npm test
```

### 3. 开发模式
```bash
npm run dev
```

### 4. 生产打包
```bash
npm run build
```
打包生成的文件位于 `.output/chrome-mv3`，在 Chrome 中打开 `chrome://extensions/` 并点击 **“加载已解压的扩展程序”** 即可安装。

---

## 📄 License

MIT License © 2026 BiliFlow
