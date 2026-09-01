# BiliFlow — Chrome Web Store Listing & Compliance

## 1. Extension Metadata

- **Name**: BiliFlow - 极速心流 B站视频总结与键盘导航
- **Short Name**: BiliFlow
- **Version**: 1.1.3
- **Primary Language**: 中文 (简体) / Chinese (Simplified)
- **Category**: Productivity / Accessibility
- **Single Purpose**: 提供无需鼠标打扰的极速键盘流 B 站视频核心内容提取与时间戳秒级跳转。

---

## 2. Store Listing Copy

### 2.1 Short Description (132 chars max)
无需鼠标、不占屏幕，快捷键一键呼出 HUD 并毫秒级跳转核心亮点的 B 站 AI 观影助手。

### 2.2 Detailed Description
⚡ **BiliFlow —— 真正为“心流”而生的 B 站 AI 视频总结与极速键盘导航助手**

厌倦了每次看视频都要鼠标点开笨重侧边栏、等待漫长生成、挤占 40% 屏幕画面的体验了吗？
BiliFlow 采用全新的 **HUD (Heads-Up Display) 半透明悬浮设计** 与 **全键盘交互流 (Keyboard-First)**，让你在看视频时双手无需离开键盘，核心干货一触即达！

### ✨ 核心功能与亮点
1. **全键盘极速流 (Keyboard-First)**：
   - 按 `Alt + S`：一键呼出/收起极简半透明 HUD 浮层；
   - 按 `1` ~ `9`：毫秒级秒切对应亮点时间戳，视频流畅播放不中断；
   - 按 `J` / `K` 或 `↑` / `↓`：在不同亮点节点之间快速巡航；
   - 按 `Esc`：秒级退场，回归沉浸观影。
2. **纯净无感与非侵入式设计**：
   - 不挤占原有页面宽度，完美适配网页全屏、剧场模式与普通模式；
   - 智能识别输入框焦点，评论区或弹幕打字时自动屏蔽快捷键，防误触。
3. **自带 Key 零门槛与隐私安全 (BYOK)**：
   - 内置 DeepSeek、硅基流动 (SiliconFlow)、Google Gemini、OpenAI 等主流大模型预设；
   - 所有数据仅保存在用户本地浏览器 `chrome.storage.local`，无任何第三方中间服务器。

---

## 3. Permissions Justification (权限申报合规说明)

| Permission / Host | Justification for Reviewers (审核声明) |
| :--- | :--- |
| **`storage`** | 用于在用户本地持久化保存用户的 API Key 配置、快捷键设置以及视频总结结果缓存，避免重复请求。 |
| **`*://*.bilibili.com/*`** | 用于在 B 站视频播放页面注入 Shadow DOM HUD 交互组件，并控制播放器的 `currentTime` 跳转。 |
| **`https://api.bilibili.com/*`** | 用于后台 Service Worker 获取当前视频对应的官方 CC/AI 字幕 JSON 数据。 |
| **`https://*.deepseek.com/*`** | 用于调用 DeepSeek 官方 API 接口生成结构化摘要。 |
| **`https://*.siliconflow.cn/*`** | 用于调用硅基流动大模型网关 API 生成结构化摘要。 |
| **`https://generativelanguage.googleapis.com/*`** | 用于调用 Google Gemini API 接口生成结构化摘要。 |

---

## 4. Privacy & Data Handling

- **Data Collection**: No personal data, tracking data, or browsing history is collected or transmitted to developer servers.
- **External Transmission**: Only video subtitle text is transmitted directly from the client to the user-configured LLM provider (e.g. DeepSeek/OpenAI/Gemini) using the user's own API Key.
- **Data Storage**: User settings and summary caches are stored strictly locally in `chrome.storage.local`.

---

## 5. Version History

- **v0.1.0** (2026-08-29): Initial MVP release with HUD overlay, keyboard navigation, subtitle fetching, and DeepSeek/Gemini/OpenAI support.
