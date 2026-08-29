---
name: web-extension-dev
description: >-
  Expert guidelines and best practices for developing modern Chrome/Web Extensions (Manifest V3),
  with specialized patterns for WXT framework, Shadow DOM UI injection, background service worker
  message passing, bypassing cross-origin restrictions, and Bilibili video player interactions.
---

# Web Extension Development Guide (Manifest V3 & WXT)

This skill equips the agent with standard architectural patterns, best practices, and troubleshooting runbooks for building modern browser extensions targeting Manifest V3 and rich video platform integrations (such as Bilibili).

---

## 1. Core Architecture Pattern (Manifest V3)

```
┌────────────────────────────────────────────────────────┐
│ Bilibili Webpage Context                               │
│  - Bilibili Player DOM (`<video>`, `bwp-video`)        │
│  - Window Variables (`window.__INITIAL_STATE__`)       │
└───────────────────────┬────────────────────────────────┘
                        │ Injected by Content Script
┌───────────────────────▼────────────────────────────────┐
│ Content Script (Shadow DOM UI)                         │
│  - Floating Sidebar / Drawer UI (Tailwind CSS)         │
│  - Listens to video time updates / controls seek       │
│  - Communicates via `chrome.runtime.sendMessage`       │
└───────────────────────┬────────────────────────────────┘
                        │ Message Passing (Request/Response)
┌───────────────────────▼────────────────────────────────┐
│ Background Service Worker (Offscreen / Fetch Engine)   │
│  - Fetches external APIs (Bilibili Subtitle, LLM APIs) │
│  - Avoids CORS & CSP limitations in Content Scripts    │
│  - Manages `chrome.storage.local` (API Keys, Cache)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Key Engineering Guidelines

### 2.1 Content Script & Shadow DOM Style Isolation
* **Always use Shadow DOM** (`createShadowRootUi` in WXT) when injecting UI into host pages like Bilibili.
* **Why**: Prevents host page styles (global CSS resets, font sizes, z-indexes) from breaking extension UI, and prevents extension Tailwind styles from breaking Bilibili.
* **Z-Index Handling**: Set high z-index (e.g. `z-[99999]`) and ensure it behaves well in both normal, wide-screen, and theater/fullscreen modes.

### 2.2 Background Network Proxy (Bypassing CORS & CSP)
* In Manifest V3, Content Scripts are restricted by host page Content Security Policy (CSP).
* **Rule**: All external fetch calls (such as calling DeepSeek/OpenAI LLM APIs or Bilibili APIs requiring headers) MUST be routed through Background Service Worker using typed messages.

### 2.3 Bilibili Player API & Video Control
* Target video element selector: `const video = document.querySelector<HTMLVideoElement>('bwp-video, video');`
* Seek to timestamp:
  ```typescript
  export function seekVideo(seconds: number) {
    const video = document.querySelector<HTMLVideoElement>('bwp-video, video');
    if (video) {
      video.currentTime = seconds;
      video.play().catch(() => {});
    }
  }
  ```
* Getting Bilibili Video Metadata (`aid`, `cid`, `bvid`):
  * Parse URL (`/video/BV...`)
  * Extract from page DOM / scripts or call `https://api.bilibili.com/x/web-interface/view?bvid=...`

---

## 3. Communication Protocol Standards

Define typed messages between Content Script and Background:

```typescript
export type ExtensionMessage =
  | { type: 'FETCH_SUBTITLE'; payload: { aid: string; cid: string; bvid: string } }
  | { type: 'SUMMARIZE_STREAM'; payload: { transcript: string; modelConfig: ModelConfig } }
  | { type: 'GET_STORAGE'; payload: { keys: string[] } }
  | { type: 'SET_STORAGE'; payload: Record<string, any> };
```

---

## 4. Recommended Stack
* **Framework**: WXT (`wxt`) with React or Vue 3
* **Styling**: Tailwind CSS (scoped within Shadow Root)
* **Icons**: `lucide-react` / `lucide-vue-next`
* **Markdown & KaTeX**: `react-markdown` / `markdown-it` for rendering AI summaries
