<div align="center">

<img src="public/icons/icon-128.png" alt="BiliFlow Logo" width="112" height="112" />

# ⚡ BiliFlow (极速心流)

### **无需鼠标、不占屏幕 · 键盘流一键呼出 HUD 毫秒级直达亮点的 B 站 AI 助手**

[![Version](https://img.shields.io/badge/version-1.1.5-00AEEC.svg?style=flat-square)](https://github.com/luckjokerwang/BiliFlow/releases)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![Firefox MV2/MV3](https://img.shields.io/badge/Firefox%20Addon-Supported-orange.svg?style=flat-square)](https://addons.mozilla.org/)
[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Vitest](https://img.shields.io/badge/Tests-100%25%20Passed-brightgreen.svg?style=flat-square)](https://vitest.dev/)

[核心特性](#-核心功能特性) · [快捷键速查](#-键盘流全景速查) · [安装指南](#-安装与使用指南) · [本地开发](#-本地开发与构建) · [隐私安全](#-隐私与安全承诺-privacy--security)

</div>

---

## 🎯 设计理念：什么是“极速心流”？

传统视频总结扩展往往采用 **侧边栏占用大量屏幕空间**、**强迫鼠标反复点击** 或 **死板的长篇大论**，严重打断看视频的沉浸状态。

**BiliFlow** 遵循 **Keyboard-First** 交互哲学与深度原生融合：
* **心流零打扰**：按下快捷键（`Alt + S` / 自定义）呼出半透明悬浮 HUD，看完按 `Esc` 瞬间退场；
* **数字键秒切**：提炼出的核心亮点对应 `1~9` 数字键，一键跳转到对应精彩画面；
* **进度条发光打点**：AI 提炼的亮点同步投影至 B 站原生进度条上，悬停预览，点击直达；
* **全屏模式全贯通**：在普通窗口、网页全屏以及原生全屏下，快捷键均可直接唤起 HUD 并无缝跳播；
* **真正的 BYOK (自带 Key)**：数据 100% 留存在本地 Chrome Storage，零第三方服务端中转。

---

## ✨ 核心功能特性

### 1. ⌨️ 全键盘流精准导航 (Keyboard-First Navigation)
* **全局唤起**：默认 `Alt + S`（支持自定义录制，如 `Alt + F`、`Ctrl + Shift + S` 等）；
* **亮点直达**：按键盘数字键 `1` ~ `9`，毫秒级跳跃至该亮点开始的画面；
* **上下翻阅**：按 `J` / `K` 或 `↑` / `↓` 顺畅切换上一个 / 下一个节点；
* **闪电退场**：按 `Esc` 立即隐藏浮层，观影完全不中断。

### 2. ⏱️ B 站播放器原生时间轴发光打点 (Timeline Highlight Markers)
* **智能锚点投影**：自动将 AI 提炼的各亮点时间戳按视频总时长映射为进度条发光锚点（`0.8% ~ 99.2%` 精准分布）；
* **悬停预览气泡**：鼠标移动到打点上即可浮现预览卡片（显示序号、起播时间与亮点标题）；
* **点击精准跳播**：点击发光打点直接调用底层播放器 Seek，无需打开完整 HUD。

### 3. 🖥️ 全屏模式 (Native Fullscreen) 深度集成
* **动态挂载宿主**：基于 Web Components **Shadow DOM** 技术，全屏切换时自动挂载至全屏根节点（`.bpx-player-container` / `document.fullscreenElement`）；
* **全屏极速唤起**：即使在全屏沉浸观影模式下，按下快捷键 HUD 依然毫秒级浮现，`1~9` 数字键与 `J/K` 键盘流完全畅通无阻。

### 4. 🎬 视频合集 / 播放列表 / 多 P 视频权威精准解析
* **后台专属消息通道**：每次唤起总结时，通过 Background Service Worker 权威直连 B 站官方接口，根据真实 URL 与 `?p=...` 参数抓取当前视频专属的 `cid` 与对应分 P 标题；
* **彻底杜绝串台**：单视频、多 P 连播、UP 主合集列表无缝兼容，100% 匹配当前正在播放的画面内容。

### 5. 🤖 多模型支持与 Cherry Studio 级模型池架构
* **内置 9 大主流官方品牌支持**（配备 100% 官方正版矢量 SVG Logo）：
  * **DeepSeek (官方)** / **SenseNova (商汤日日新)** / **Google Gemini** / **SiliconFlow (硅基流动)** / **OpenAI** / **Moonshot AI (Kimi)** / **智谱 GLM** / **Ollama (本地私有)** / **OpenRouter**；
* **两级纯净模型池**：从服务商 `/v1/models` 一键远程拉取后，提供**模型选择器**，仅保留勾选的精选模型，初始状态 0 废弃模型残留；
* **支持任意自定义厂商**：自由配置私有 ID、名称、自定义端点 (Base URL) 与 API Key。

### 6. 🛡️ 智能容灾故障转移策略 (Fallback Failover)
* 支持为每个服务商配置 **主用提炼模型 (Primary)** 与 **兜底备用模型 (Fallback)**；
* 当主用模型遭遇限流 (429)、余额不足 (402) 或服务器超时时，后台**自动无感切换至备用模型重试**，并在 HUD 浮层右上角醒目标记，保证总结永不卡壳。

### 7. 🌓 柔和护眼双模式与极简隐形滚动条
* 提供 **Soft Paper 护眼暖白** 与 **深邃暗夜** 双主题；
* HUD 浮层与设置中心注入极简隐形滚动条（Invisible Scrollbar），消除突兀滑槽，保留 100% 流畅滚动。

---

## ⌨️ 键盘流全景速查

| 按键 | 动作 | 说明 |
| :--- | :--- | :--- |
| `Alt + S` (默认) | **唤起 / 隐藏 HUD** | 在任意 B 站视频页一键切换浮层（可在设置中录制任意快捷键） |
| `1` ~ `9` | **秒级直达亮点** | 瞬时跳转到对应提炼节点的精确起播时间戳 |
| `J` / `K` 或 `↓` / `↑` | **切换亮点节点** | 在提取出的各个核心观点之间快速轮转 |
| `Enter` / `Space` | **确认跳转** | 播放选中的高亮片段 |
| `Esc` | **瞬间退场** | 退出浮层，恢复沉浸观影 |

---

## 📦 安装与使用指南

### 方法一：从 Releases 下载安装包（推荐）

1. 前往 [Releases](https://github.com/luckjokerwang/BiliFlow/releases) 下载最新 `v1.0.0` 压缩包：
   * **Chrome / Edge / Chromium 内核浏览器**：下载 `biliflow-1.0.0-chrome.zip`；
   * **Firefox 浏览器**：下载 `biliflow-1.0.0-firefox.zip`。
2. 解压下载的 `.zip` 文件；
3. 打开浏览器扩展管理页面：
   * **Chrome**: 访问 `chrome://extensions/`，右上角开启 **“开发者模式”**，点击 **“加载已解压的扩展程序”**，选择解压出的目录；
   * **Edge**: 访问 `edge://extensions/`，开启开发人员模式，加载解压目录；
   * **Firefox**: 访问 `about:debugging#/runtime/this-firefox`，点击 **“临时载入附加组件”** 选择 `manifest.json`。
4. 打开扩展图标或设置中心，填入你的大模型 API Key 即可开启使用！

---

## 🛠️ 本地开发与构建

本项目使用现代化扩展开发框架 [WXT](https://wxt.dev/) 构建，遵循 **Spec-Driven Development (SDD)** 规范与严苛的自动化测试。

```bash
# 1. 克隆代码仓库
git clone https://github.com/luckjokerwang/BiliFlow.git
cd BiliFlow

# 2. 安装依赖
npm install

# 3. 运行单元测试
npm test

# 4. 启动本地开发热重载
npm run dev

# 5. 打包生产构建
npm run build

# 6. 打包 Chrome 与 Firefox 发布压缩包
npm run zip
npx wxt zip -b firefox
```

---

## 🔒 隐私与安全承诺 (Privacy & Security)

* **BYOK 纯本地运行**：你的所有 API Key 与个人配置均仅存储在浏览器的 `chrome.storage.local` 本地沙盒中；
* **0 服务端中转**：网络请求直接由浏览器后台发往你配置的模型服务商官方端点（如 DeepSeek、OpenAI、商汤等），不经过任何第三方代理服务器。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
欢迎提交 Issue 与 Pull Request！
