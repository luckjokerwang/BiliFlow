# ⚡ BiliFlow 第一阶段 (MVP) 研发总结与架构回顾

> **项目名称**：BiliFlow (极速心流)  
> **核心定位**：无需鼠标、不占屏幕，快捷键一键唤起 HUD 并毫秒级跳转核心亮点的 B 站 AI 观影伴侣  
> **归档时间**：2026-08-30  
> **版本里程碑**：v0.3.0 ~ v0.3.4 (MVP 阶段达成)  

---

## 🎯 一、 MVP 阶段完成的核心功能全景

### 1. ⌨️ 全键盘流精准导航 (Keyboard-First Navigation)
- **快捷键唤起与自适应录制**：默认 `Alt + S`（支持任意自定义组合键录制），毫秒级控制 HUD 悬浮层显隐；
- **数字键秒切高亮**：提取出的核心观点对应数字键 `1` ~ `9`，单键直达起播时间戳；
- **节点快速轮转**：支持 `J` / `K` 或 `↑` / `↓` 顺畅浏览，按 `Enter` / `Space` 确认跳转；
- **闪电退场**：按 `Esc` 立即退场，观影心流零打扰；
- **防误触机制**：智能监听 `input`, `textarea`, `contenteditable` 与 B 站弹幕/评论输入框，打字时自动抑制快捷键触发。

### 2. 🔮 沉浸式 HUD 悬浮层与极简视觉重塑
- **Web Components Shadow DOM 强隔离**：UI 与 CSS 样式与 B 站宿主网页 100% 隔离，杜绝全局样式污染；
- **全场景播放器适配**：完美兼容 B 站普通播放、宽屏模式、网页全屏与全屏沉浸播放；
- **多 P 视频自动感知**：监听 URL 与 B 站播放器 `bvid` / `cid` 切换，换 P 自动重置并拉取新总结；
- **极简无滚动条设计 (Invisible Scrollbar)**：剔除操作系统级粗暴滚动条，保持 100% 毛玻璃质感与平滑滚轮/触控板滑动；
- **柔和护眼双主题**：提供 Soft Paper 暖白模式与深邃暗夜模式，支持一键热切换。

### 3. 🤖 两级模型池与多厂商工作台 (BYOK)
- **9 大主流大模型厂商官方品牌**：配备 100% 官方正版矢量 SVG Logo（DeepSeek 小蓝鲸、Gemini 四色星芒、OpenAI、商汤、硅基流动、Moonshot Kimi、智谱 GLM、Ollama、OpenRouter）；
- **Cherry Studio 级两级模型池**：清空硬编码模型，支持一键调用 `/v1/models` 拉取全量模型并在弹窗中多选勾选，仅将用户选中的精选模型暴露在前端，彻底告别界面污染；
- **就地添加自定义厂商**：点击“+ 添加厂商”直接在主面板就地配置，无打扰无弹窗；
- **独立连通性测试 (Ping)**：支持测速与延迟诊断，状态按厂商 ID 严格隔离。

### 4. 🛡️ 智能容灾故障转移策略 (Fallback Failover)
- 支持为厂商配置 **主用提炼模型 (Primary)** 与 **兜底备用模型 (Fallback)**；
- 当主用模型遭遇限流 (429)、余额不足 (402) 或服务器超时时，后台自动切换至备用模型无感重试，并在 HUD 标注 `🛡️ 容灾兜底` 徽标。

### 5. 📦 跨浏览器支持与自动化发布体系
- 基于 **WXT Framework**，支持 Chrome (MV3) 与 Firefox (MV2/MV3) 统一构建；
- 建立 Vitest TDD 自动化单测体系（17 项核心纯函数与服务测试 100% 通过）；
- 支持 `wxt zip` 跨平台打包与 GitHub CLI (`gh release`) 一键发布。

---

## 🛠️ 二、 研发过程遇到的关键问题与解决方案

| 序号 | 遇到的问题 / 痛点 | 根本原因分析 | 最终解决方案 |
| :--- | :--- | :--- | :--- |
| **1** | **B 站页面样式冲突与播放器全屏遮挡** | 传统 Content Script 直接向 `document.body` 插入元素会被 B 站全局 CSS 污染，且全屏播放时元素会被覆盖。 | 采用 **Shadow DOM** 技术进行 CSS 沙箱强隔离，并将 HUD 容器动态挂载至 B 站播放器主容器（`#bilibili-player` / `.bpx-player-container`），全屏状态下仍能完美展示。 |
| **2** | **跨域 CORS 与 CSP 限制导致直接 fetch LLM 失败** | Bilibili 官方页面的 CSP 安全策略阻止网页前端向第三方大模型 API 发起跨域请求。 | 采用 **Background Service Worker 统一代理消息转发** 架构（`chrome.runtime.sendMessage`），利用扩展后台权限绕过浏览器 CSP 限制。 |
| **3** | **厂商模型池污染与历史缓存过时模型残留** | 1. 预设了写死的模型名称，模型迭代后过时；<br>2. 修改预设后用户浏览器 `chrome.storage.local` 仍残留旧缓存。 | 1. 初始 `models: []` 纯净模式，通过 `/v1/models` 动态拉取；<br>2. 增加 `migrateCleanSlate` 自动净化机制，启动时自动清洗无远程凭证的历史脏数据。 |
| **4** | **切换厂商时“测试中 / Ping”状态串扰** | 状态定义为单一的全局布尔值 `testing`，切换不同厂商时共享了该状态。 | 重构为基于厂商唯一 ID 的 `testingProviderId` 字典级状态管理，切换厂商时各按钮状态 100% 独立隔离。 |
| **5** | **原生滚动条破坏毛玻璃质感** | Shadow DOM 内部子元素未声明滚动条样式，导致浏览器采用操作系统默认的灰白滑槽与箭头。 | 在 Shadow DOM CSS 中注入全局 `scrollbar-width: none !important` 与 `::-webkit-scrollbar { display: none !important; }`，实现极简隐形滑动。 |
| **6** | **Chrome 地址栏 (Omnibox) 截断插件名称** | `manifest.json` 中的 `name` 字符串过长，Chrome 原生在地址栏左侧用省略号裁切为 `BiliFlow - 极速...`。 | 将扩展名直接精简为 `BiliFlow`，地址栏徽标完整清爽显示。 |
| **7** | **长视频字幕超出 Token 限制与单字幕条碎片化** | B 站字幕以 2~3 秒为一个数组片段，直接拼接容易超出上下文窗口或缺乏语义段落。 | 编写纯函数 `transcriptChunker`，按语义标点与固定字符窗口合并字幕切片，并在前端通过 Vitest 进行覆盖率单测。 |

---

## 🏛️ 三、 系统架构与模块分层

```
BiliFlow/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts         # 后台守护进程：网络中转、WBI 鉴权、LLM 容灾执行、存储迁移
│   │   ├── content/              # Content Script: Shadow DOM 挂载、HUD 浮层渲染、键盘事件流
│   │   ├── options/              # 设置中心：全宽一体化工作台、模型拉取管理器、快捷键录制
│   │   └── popup/                # 浏览器工具栏浮窗：快速切换厂商/模型、快捷键速查
│   ├── services/
│   │   ├── bilibiliApi.ts        # B 站视频元数据、WBI 签名、AI 字幕与多 P 解析
│   │   └── llmService.ts         # OpenAI 兼容协议适配、模型拉取、Failover 容灾兜底
│   ├── utils/
│   │   ├── playerController.ts   # 播放器控制：毫秒级跳转、打字状态检测
│   │   ├── transcriptChunker.ts  # 字幕切片与时间重合检测 (纯函数)
│   │   └── timeParser.ts         # 时间戳解析与格式化工具 (纯函数)
│   ├── components/
│   │   └── ProviderIcons.tsx     # 100% 正版官方大模型品牌矢量 SVG 渲染器
│   ├── constants/                # 预设厂商端点与默认配置
│   └── types/                    # 严格 TypeScript 类型定义 (SDD 规范)
├── tests/                        # Vitest 单元测试用例集
└── docs/                         # 阶段性研发与架构文档
```

---

## 🚀 四、 第二阶段 (Phase 2) 规划与演进展望

在完成 MVP 基础闭环后，第二阶段可重点围绕 **“更深度的视频交互”** 与 **“更智能的提炼体验”** 展开迭代：

1. ⏱️ **B 站播放器原生时间轴打点 (Timeline Highlight Markers)**：
   - 将 AI 提炼出的核心亮点直接在 B 站播放器底部进度条上渲染微型发光锚点，鼠标悬浮预览，点击直达。
2. 💬 **局部片段 AI 对话追问 (Video Clip Q&A / RAG)**：
   - 支持在某个亮点节点下按快捷键（如 `Ctrl + Enter`）针对该片段内容向 LLM 发起即时追问。
3. 📝 **脑图 / 大纲导出与笔记联动 (Markdown / Notion / Obsidian)**：
   - 一键将视频提炼结果复制为结构化 Markdown、思维导图或一键同步至笔记软件。
4. 🎙️ **无字幕视频支持 (Audio Stream + 本地/远程 Whisper)**：
   - 针对无原生字幕/AI字幕的视频，探索音频流截取与轻量 ASR 转写链路。
5. 🔄 **多端配置同步 (WebDAV / GitHub Gist)**：
   - 支持跨设备同步用户的自定义厂商、API Key 与精选模型池。

---

*文档归档完成，供后续开发人员与 AI 协同回顾查阅。*
