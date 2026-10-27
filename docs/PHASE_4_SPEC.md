# ⚡ BiliFlow Phase 4 Specification (Spec)
## 沉浸式全文字幕流、官方笔记 Markdown 样式注入与 Tool 增强总结架构规范

---

## Problem Statement

As a video learner and power user on Bilibili, I experience several critical pain points that hinder deep video comprehension and note-taking:

1. **Native Bilibili Note Usability and Lack of Markdown Styling**:
   - When Bilibili's official note drawer is closed (such as during fullscreen, wide-player mode, or before manual expansion), attempting to capture timestamped thoughts fails because the editor DOM does not exist on the page.
   - Bilibili's native Quill rich-text editor does not support Markdown syntax, rendering user notes visually rudimentary, hard to structure, and visually inconsistent with modern knowledge bases (like Notion or Typora).
   - If notes are saved purely to extension local storage without syncing to Bilibili, I cannot review my insights on the Bilibili mobile app or across other workstations.

2. **Subtitles Treated as Secondary Clutter**:
   - The current HUD restricts transcript quotes to a condensed "evidence" block with just 3–5 fragmented sentences.
   - I cannot view the full, continuous transcript of the entire video like a song lyric or lecture transcript, nor can I easily scan ahead, search keywords, or jump playback from any sentence in the video.

3. **Hallucination and Blind Spots in Pure-Prompt Summaries**:
   - Relying purely on a single large prompt causes severe context decay ("Lost in the Middle") on videos longer than 20–30 minutes.
   - The LLM frequently hallucinates timestamps and arbitrarily estimates chapters, missing the author's real structure.
   - The AI cannot perceive where the audience is actually engaged (such as viral jokes, intense climaxes, or collective question marks in the Danmaku stream) because Danmaku density and UP-authored chapters are invisible to a plain text prompt.

---

## Solution

1. **Markdown Style Injection & Resilient Dual-Engine Note Pipeline**:
   - Provide content script style injection into Bilibili's native `.ql-editor`, transforming Bilibili's native notes into a clean, modern GitHub/Notion-inspired Markdown theme (styled blockquotes, mono code tags, refined headings, and interactive blue timestamp flags).
   - Maintain a local-first buffer so user thoughts are permanently saved instantaneously, while orchestrating safe, debounced DOM expansion and graceful fallback when sending to Bilibili's cloud notes.

2. **Full Transcript Stream View (全文字幕心流流览)**:
   - Introduce a dedicated, first-class full transcript stream view inside the HUD alongside the AI summary tab.
   - Provide smooth, auto-centering scrolling that synchronizes with the video playhead, allowing users to read the entire transcript continuously, search for keywords, and click any utterance for instant millisecond seeking.

3. **Tool-Augmented Summary Pipeline (4 大 Tool 增强体系)**:
   - **Tool 1: Official Chapters & Description Timestamp Sniffer**: Extracts author-defined timeline milestones directly from Bilibili video metadata and description to eliminate AI timestamp drift.
   - **Tool 2: Danmaku Heatmap Analyzer**: Queries Bilibili's native Danmaku density gateway to identify Top 3-5 audience climax timestamps as mandatory anchor constraints for the LLM.
   - **Tool 3: Hierarchical Map-Reduce Chunker**: Splits long transcripts (>20 min) into 10-minute micro-chunks, extracts localized keypoints, and synthesizes them into an overarching narrative arc.
   - **Tool 4: Structured Artifacts Extractor**: Extracts specific actionable takeaways, technical terminology glossaries, and punchline quotes beyond generic bullet points.

---

## User Stories

1. As a video researcher, I want my thoughts and annotations saved to local storage immediately upon typing, so that unexpected page reloads or closed note panels never cause me to lose my notes.
2. As a learner who watches Bilibili across multiple devices, I want an explicit one-click sync of my thoughts and AI highlights into Bilibili's official note drawer, so that I can access my notes from the Bilibili mobile app and cloud notebook.
3. As an aesthetic-minded note-taker, I want Bilibili's native note editor to render beautiful, GitHub-style Markdown typography (accented left borders on quotes, distinct callouts, and clean headings), so that my notes look organized and readable.
4. As a student reading complex video material, I want to switch to a dedicated "Full Transcript Stream" view in the HUD, so that I can read the speaker's exact words continuously without being restricted to 3–5 snippet sentences.
5. As a fast reader, I want to search keywords inside the full transcript stream, so that I can instantly locate specific topics mentioned in a 2-hour lecture.
6. As a viewer listening to audio-heavy lectures, I want the active spoken sentence in the full transcript to stay smoothly centered in my view, so that I always know where the speaker is without manual scrolling.
7. As a user watching segmented tutorials, I want the AI summary to automatically incorporate the UP author's official chapter titles, so that the summary's timeline perfectly matches the video's official structure.
8. As an entertainment or debate viewer, I want the AI summary to identify Danmaku climax peaks (e.g., massive audience reactions), so that viral highlights and key reveals are never omitted from the summary.
9. As a subscriber watching 60-minute in-depth documentaries, I want long videos processed via a hierarchical Map-Reduce pipeline, so that the summary covers the middle and ending arguments just as thoroughly as the opening minutes.
10. As a technical viewer, I want the summary cards to highlight specialized terminology definitions, so that I can quickly learn new domain jargon without opening external search tabs.
11. As a user switching between dark and light themes in settings, I want a smooth, circular reveal animation originating from my cursor position, so that the visual transition feels natural and free of layout jumps.

---

## Implementation Decisions

### 1. Dual-Engine Note Architecture & Styling
- **Local Persistence Layer**: All user annotations remain tied to `bvid` + `highlightId` inside extension local storage. User input is saved debounce-free.
- **Native Editor Style Injection**: A dedicated stylesheet will be injected into the top document scope targeting `.bili-note-panel` and `.ql-editor`. It establishes modern CSS custom properties for quote borders, heading hierarchy, code spans, and clickable blue timestamp badges (`.biliflow-timestamp`).
- **Drawer Mounting Detection**: When user triggers sync, the controller polls with exponential backoff for the mounting of the editor container. If the video player is in fullscreen or the note drawer cannot be summoned, the UI transitions to an informative manual-retry state rather than throwing an unhandled exception or reporting a false positive.

### 2. Full Transcript Stream (First-Class View)
- **View Toggle State**: The HUD header will feature an active mode segmented switch between `[ ⚡ AI 精读要点 ]` and `[ 📜 全文字幕心流 ]`.
- **Transcript Data Stream**: Consumes fused sentence tracks (`BiliRawSubtitleItem[]`) provided by the existing background subtitle fetcher.
- **Search & Auto-Scroll Controller**: An in-memory text filter matches user queries against the sentence contents, while an IntersectionObserver / `scrollIntoView({ block: 'nearest' })` hook updates the active viewport based on the video element's `timeupdate` ticks.

### 3. Tool-Augmented Summary Pipeline
- **Tool Pipeline Protocol**: The summary generator will transition from a single raw prompt to an augmented pipeline:
  ```typescript
  export interface VideoPreflightMetadata {
    officialChapters?: Array<{ from: number; to: number; title: string }>;
    danmakuHeatmapPeaks?: Array<{ timestampSec: number; densityRatio: number }>;
    descriptionTimestamps?: Array<{ seconds: number; title: string }>;
  }
  ```
- **Official Chapters Sniffer**: Queries Bilibili's player metadata and web view endpoints (`/x/v2/dm/web/view` and player init data) to extract native chapters before calling the LLM.
- **Heatmap Peak Extraction**: Normalizes Danmaku count arrays to discover the Top 3-5 variance spikes, passed into the prompt as `【弹幕高能时间点】` mandatory constraints.
- **Map-Reduce Fallback for Extended Durations**: If subtitle duration exceeds 20 minutes (1200 seconds), transcript items are partitioned into temporal chunks, independently summarized for factual arguments, and aggregated in a final reduction step.

---

## Testing Decisions

### 1. Test Quality Standards
- Tests must exclusively evaluate observable external behaviors (state transitions, exported data contracts, DOM class applications, and API error recoveries), never internal ephemeral variables.
- All mock network responses must use realistic Bilibili API fixtures and valid subtitle structures.

### 2. Test Seams
- **Primary Seam 1 (DOM & Style Integration)**: Test `biliNoteFormatter` and DOM controllers by verifying generated HTML structure, data attribute preservation, and CSS class attachment.
- **Primary Seam 2 (Subtitle Navigation & Streaming)**: Test transcript search filters, time snapping, and quote index calculation via `timelineCalculator.test.ts` and `subtitleResolution.test.ts`.
- **Primary Seam 3 (Augmented Pipeline Orchestration)**: Test `llmService.test.ts` with mock chapter metadata and Danmaku heatmap inputs to ensure LLM prompt assembly includes anchor constraints.

### 3. Prior Art in Codebase
- `tests/subtitleResolution.test.ts`: Existing suite for subtitle fusing and priority weighting.
- `tests/llmService.test.ts`: Existing mock suite for OpenAI-compatible streaming and cross-provider failover.
- `tests/biliNoteFormatter.test.ts`: Existing test suite validating Quill Delta and semantic HTML conversions.

---

## Out of Scope

1. **OCR / Vision-Based Frame Extraction**: Directly decoding video frames via on-device computer vision models (such as YOLO or local multimodal models) is excluded due to browser performance and package size constraints.
2. **Arbitrary Cloud Notebook Providers**: Integrations with third-party tools like Notion API, Obsidian Sync, or Readwise are excluded from this phase; focus is strictly on Bilibili Native Notes and local export.
3. **Audio Speech-to-Text (ASR) Engine**: Transcribing videos that possess zero Bilibili official, AI, or community subtitle tracks is out of scope.

---

## Further Notes

- The View Transitions API enhancements implemented in the options page (700ms duration, `ReactDOM.flushSync`, and fixed viewport pinning) serve as the visual baseline for all subsequent theme and modal interactions in the HUD.
- The pipeline tools (Chapter Sniffer and Danmaku Analyzer) should gracefully degrade: if a video has no Danmaku or chapters, the pipeline immediately falls back to pure transcript extraction without blocking execution.
