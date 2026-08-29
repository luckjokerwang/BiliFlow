# BiliFlow (MVP) Technical & Design Specification

- **Version**: 0.1.0-mvp
- **Author**: Antigravity & User Pair-Programming
- **Status**: Ready for Implementation
- **Target Platform**: Chromium Browsers (Manifest V3)

---

## 1. Problem Statement & Value Proposition

### 1.1 The Core Problem
Existing AI video summarizers (e.g. Doubao, BibiGPT, Kimi) rely heavily on mouse-driven interactions and intrusive sidebars that occupy 30%–40% of screen estate, breaking the viewer's immersion and watching flow (心流).

### 1.2 The BiliFlow Solution
A **keyboard-first, HUD-based, non-intrusive AI companion** for Bilibili that delivers:
1. **Background Instant Readiness**: Automatically fetches subtitles and generates key highlights quietly.
2. **Minimalist HUD Overlay**: Press `Alt + S` to summon a sleek, semi-transparent highlight panel floating over the player without breaking fullscreen/theater layout.
3. **Pure Keyboard Navigation**: Press number keys (`1`–`5`) or `J`/`K` to seek video timestamp instantly with zero mouse movement.

---

## 2. Interaction & Visual Design System (Anthropic `frontend-design` Standard)

### 2.1 Visual Language
- **Style**: Subtle Glassmorphism (dark mode default: `rgba(15, 23, 42, 0.82)`, `backdrop-blur-md`, subtle 1px border `rgba(255,255,255,0.1)`).
- **Typography**: Clean monospace timestamp tags (`02:34`) with modern sans-serif highlight text.
- **Micro-interactions**: Smooth scale & opacity transitions (150ms ease-out) when HUD appears/disappears.

### 2.2 Keyboard Interaction Matrix

| Shortcut | Action | Scope / Context |
| :--- | :--- | :--- |
| `Alt + S` | Toggle HUD Overlay (Show / Hide) | Global on Bilibili Video Page |
| `1` ~ `5` | Instant Jump to Highlight 1 ~ 5 | Active when HUD is visible |
| `J` / `K` | Jump to Next / Previous Highlight | Active when HUD is visible |
| `Esc` | Instantly dismiss HUD | Active when HUD is visible |
| `Enter` | Seek to currently focused highlight | Active when HUD is visible |

---

## 3. Data Contracts (TypeScript Interfaces)

### 3.1 Subtitle & Transcript Models
```typescript
export interface BiliRawSubtitleItem {
  from: number; // Start time in seconds (e.g. 12.35)
  to: number;   // End time in seconds (e.g. 15.80)
  content: string;
}

export interface TranscriptChunk {
  startTime: number;     // seconds
  endTime: number;       // seconds
  timestampStr: string;  // e.g. "02:15"
  text: string;
}
```

### 3.2 Summary & Highlight Result Model
```typescript
export interface HighlightItem {
  id: number;
  timestamp: number;     // In seconds
  timestampStr: string;  // Formatted "mm:ss"
  title: string;         // Short concise topic (< 15 chars)
  keyPoint: string;      // 1-sentence takeaway
}

export interface VideoSummaryResult {
  bvid: string;
  cid: string;
  title: string;
  oneSentenceSummary: string;
  highlights: HighlightItem[];
  followUpQuestions?: string[];
  createdAt: number;
}
```

### 3.3 Message Passing Contract (Manifest V3)
```typescript
export type ExtensionMessage =
  | { type: 'GET_VIDEO_DATA'; payload: { bvid: string; cid: string; aid: string } }
  | { type: 'REQUEST_SUMMARY'; payload: { bvid: string; cid: string; aid: string; modelConfig?: ModelConfig } }
  | { type: 'GET_STORAGE_KEY'; payload: { key: string } }
  | { type: 'SET_STORAGE_KEY'; payload: { key: string; value: any } };

export type ExtensionResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

---

## 4. Architecture & Security Boundaries

```
[Bilibili DOM Context]
  ├── Native Video Player (`video`, `bwp-video`)
  └── Content Script
        ├── Injected Shadow Root UI (`#biliflow-shadow-root`)
        ├── Keyboard Event Listener (`keydown`)
        └── Seek Controller (`video.currentTime = ts`)
              ▲
              │ chrome.runtime.sendMessage (Typed Protocol)
              ▼
[Background Service Worker]
  ├── Bilibili API Client (Fetch Subtitle JSON - Bypassing Page CSP)
  ├── LLM Client (OpenAI / DeepSeek / Gemini - Streaming / JSON)
  └── Local Storage Cache (`chrome.storage.local`)
```

---

## 5. Testing Seams (TDD Specifications)

Under the `tdd` skill, the following pure units must have 100% test coverage before UI wiring:

1. **`timeParser.ts`**:
   - Conversion between seconds (`154`) and timestamp string (`"02:34"`), and vice versa.
2. **`transcriptChunker.ts`**:
   - Merging rapid subtitle segments into clean 20–30 second blocks with accurate timestamp offsets.
3. **`llmOutputParser.ts`**:
   - Robust JSON extraction from LLM response (handling markdown code fence wraps ` ```json ... ``` ` and partial streaming tokens).

---

## 6. Edge Cases & Fallback States

1. **Video Has No Subtitles**:
   - HUD displays polite badge: *"该视频暂无字幕数据，敬请期待 ASR 语音识别支持"* with a shortcut to close.
2. **Fullscreen & Theater Mode**:
   - Shadow DOM container attached to `document.fullscreenElement || document.body` to prevent disappearing during native fullscreen.
3. **Key Collision**:
   - When user is typing inside Bilibili comment box, search input, or danmaku input (`INPUT`, `TEXTAREA`), all BiliFlow shortcut listeners are suppressed.
