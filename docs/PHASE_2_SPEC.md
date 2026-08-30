# ⚡ BiliFlow Phase 2 Specification (Spec)

## Problem Statement

在第一阶段（MVP）中，BiliFlow 成功建立了“快捷键唤起 HUD + 数字键秒级跳转亮点 + 多厂商两级模型池与故障容灾”的基础闭环。然而在实际全流程观影中，依然存在三大体验断点：

1. **时间感知割裂**：提炼出的精彩节点仅存在于文字悬浮卡片中，用户在观看视频时，无法在 B 站原生进度条（时间轴）上直观感知各个亮点在整部视频中的分布位置与密集程度。
2. **全屏状态下 HUD 失效/被遮挡**：B 站用户在切换到“全屏模式 (Native Fullscreen)”时，由于宿主浏览器全屏渲染机制，挂载在 `body` 的 HUD 浮层会被全屏播放器图层完全遮蔽，导致在全屏观影时无法按快捷键呼出 HUD。
3. **鼠标探索入口缺失**：虽然 BiliFlow 强调 Keyboard-First，但在用户未熟悉快捷键或纯鼠标单手操作时，缺乏一个符合 B 站原生播放器设计美学的常驻交互入口。

---

## Solution

第二阶段将聚焦**“播放器深度原生融合”**与**“全场景沉浸体验”**：

1. **⏱️ 原生时间轴高亮发光打点 (Timeline Highlight Markers)**：
   - 解析提炼结果的时间戳，动态在 B 站进度条（`.bpx-player-progress`）上渲染微型发光锚点；
   - 支持鼠标悬浮浮现悬停预览卡片（时间点 + 亮点标题），点击发光锚点直接起播跳转；
   - 智能处理密集打点碰撞与视频总时长动态自适应。
2. **🖥️ 播放器原生全屏 / 网页全屏深度挂载 (Fullscreen HUD Adapter)**：
   - 监听 B 站播放器全屏状态事件（`fullscreenchange`、`webfullscreen`），将 Shadow DOM 挂载点动态锚定至播放器最外层全屏容器内部（`.bpx-player-container` / `document.fullscreenElement`）；
   - 确保全屏状态下按下快捷键（如 `Alt+S` / `Alt+F`）HUD 浮层毫秒级浮现在全屏视频最顶层。
3. **🌟 播放器左下角控制栏原生风胶囊按钮 (Control Bar Capsule Button)**：
   - 在 B 站播放器底部左侧控制栏（`.bpx-player-control-bottom-left`，时间显示右侧）无缝注入一个符合 B 站设计规范的胶囊按钮 `[ ✦ BiliFlow  Alt+F ]`；
   - 动态同步当前配置的快捷键组合，鼠标点击即可快速展开/收起 HUD，UI 风格与原生播放器 100% 协调且绝不遮挡弹幕输入框与播放控制。

---

## User Stories

1. As a Bilibili video viewer, I want to see glowing anchor pins on the video progress bar corresponding to AI-extracted highlights, so that I can visually grasp the timeline density and pacing of key points at a glance.
2. As a viewer, I want to hover my mouse over any timeline anchor marker, so that I can see a sleek preview tooltip displaying the exact timestamp and highlight title before jumping.
3. As a viewer, I want to click any timeline anchor marker directly on the progress bar, so that the video instantly seeks to that exact moment and starts playback without opening the full HUD.
4. As an immersive viewer watching videos in Native Fullscreen mode, I want to press my custom shortcut (e.g. `Alt+S` / `Alt+F`) and see the HUD overlay appear seamlessly on top of the fullscreen video, so that I never have to exit fullscreen to view summaries.
5. As a viewer in Fullscreen mode, I want to navigate highlights using numbers `1~9`, `J/K`, and `Esc` just like in windowed mode, so that the keyboard-first flow remains 100% consistent across all screen states.
6. As a casual viewer browsing without hands on the keyboard, I want a discreet, beautifully integrated capsule button in Bilibili's bottom-left control bar (next to the time display), so that I can toggle the AI summary with a single mouse click.
7. As a customizer who changed their shortcut to `Alt+F` or `Ctrl+B`, I want the player control bar capsule to dynamically show my current active shortcut badge, so that it serves as a constant and accurate visual reminder.
8. As a user watching multi-part (分 P) or playlist videos, I want the timeline highlight markers and control capsule to automatically recalculate and refresh whenever I switch to another video part, so that markers never drift or show stale video data.
9. As a viewer watching long videos with dense highlights close to each other, I want adjacent timeline markers to avoid chaotic overlapping and expand cleanly on hover, so that all points remain readable and clickable.
10. As a power user, I want timeline markers and control capsules to strictly respect light/dark and theatre mode aesthetics without breaking Bilibili's native playback controls or danmaku input box.

---

## Implementation Decisions

### 1. Data Contracts & State Shape

```typescript
// Timeline Marker Data Contract
export interface TimelineMarker {
  id: string;
  index: number;              // 1-indexed (1 ~ 9)
  timestampSec: number;       // Exact seek position in seconds
  timestampStr: string;       // Formatted "MM:SS" or "HH:MM:SS"
  title: string;              // Highlight core title
  keyPoint?: string;          // Brief summary
  percentage: number;         // 0 ~ 100% position on the timeline bar
}

// Player Integration State
export interface PlayerIntegrationState {
  isFullscreen: boolean;      // Native fullscreen active
  isWebFullscreen: boolean;   // Bilibili web-fullscreen active
  durationSec: number;        // Total duration of current video
  currentBvid: string;        // Active BV identifier
  currentCid: string;         // Active CID identifier
  markers: TimelineMarker[];  // Computed timeline markers
  hoveredMarkerId: string | null;
}
```

### 2. Architectural Components & Seams

* **`TimelineMarkerManager` (DOM / React Overlay)**:
  - 监听视频时长变动与总结数据生成事件；
  - 准确定位 B 站进度条挂载容器：优先查找 `.bpx-player-progress-schedule` 或 `.bpx-player-progress`；
  - 纯函数计算打点百分比：`calculateMarkerPositions(highlights, duration)`；
  - 采用绝对定位注入发光微胶囊，利用 CSS `transform: translateX(-50%)` 精确对齐时间刻度。
* **`PlayerControlCapsule` (Control Bar Injector)**:
  - 定位 B 站播放器底部左侧控制区：`.bpx-player-control-bottom-left`；
  - 插入原生风胶囊 DOM 容器（`biliflow-control-capsule-root`）；
  - 渲染 `[ ✦ BiliFlow  {shortcut} ]`，监听点击事件发送 `TOGGLE_HUD`。
* **`FullscreenMountAdapter` (Unified Mounting & Z-Index Layer)**:
  - 弃用固定的 `anchor: 'body'`；
  - 采用动态挂载策略：优先将 Shadow DOM 挂载至 B 站播放器根容器 `.bpx-player-container`（若未加载则回退至 `#bilibili-player` 或 `body`）；
  - 监听 `document.addEventListener('fullscreenchange', ...)` 与 `window.addEventListener('resize', ...)`，全屏切换时自动确保 HUD 置于全屏根节点最高层级（`z-index: 2147483647`）。

### 3. Edge Cases & Defensive Strategies

1. **B 站播放器懒加载 / 异步渲染**：
   - 使用 `MutationObserver` 结合指数退避重试（`waitForElement('.bpx-player-container', 8000)`），确保播放器 DOM 就绪后再注入打点与胶囊。
2. **视频时长 (`duration`) 初始为 0 或 NaN**：
   - 监听 `<video>` 元素的 `loadedmetadata` 与 `durationchange` 事件，确保时长就绪后再计算时间轴百分比，杜绝 `NaN%` 导致的样式错位。
3. **密集打点冲突 (Marker Clustering)**：
   - 若两个亮点时间相差 < 2%，打点渲染时通过轻微横向错位与悬浮 `z-index` 提升，保证每一个锚点均可被鼠标单独精准悬停。
4. **换 P / 换集 (Multi-P Video Transition)**：
   - 监听 URL 变化与播放器 `cid` 变更，换 P 时立即销毁旧时间轴上的锚点，等待新视频元数据与 AI 总结生成后重新打点。

---

## Testing Decisions

* **Testing Seams**:
  - **纯函数时间轴位置计算测试** (`tests/timelineCalculator.test.ts`)：
    - 测试正常时长（如 10 分钟视频）各时间戳百分比计算准确性；
    - 测试异常时长（0 秒、负数、超出总时长的脏数据）的安全兜底；
    - 测试时间相近亮点的碰撞检测与聚集标识算法。
  - **全屏状态适配逻辑测试**：
    - 测试 `getFullscreenMountTarget` 在全屏模式与普通模式下返回正确的 DOM 节点。
* **Good Test Criteria**:
  - 只测试核心计算逻辑与输入输出映射，不强依赖真实浏览器 DOM 的复杂私有实现。

---

## Out of Scope

1. ❌ **无字幕视频音频转写 (Whisper ASR)**：根据明确指示，第二阶段不涉及音频提取与离线/在线 Whisper 语音识别。
2. ❌ **第三方视频平台适配**：第二阶段依然专注深化 Bilibili (bilibili.com) 的深度原生体验，暂不扩展至 YouTube 或其他站点。
3. ❌ **视频画面截图分析**：暂不进行视频帧抓取与视觉多模态分析。

---

## Further Notes

- UI 样式必须严格遵循 B 站官方深色/浅色播放器控制栏的配色规范（`#00A1D6` / `#23ADE5` 哔哩蓝与纯净黑金）；
- 所有控制栏胶囊与时间轴锚点必须保证对 B 站原生事件（如进度条拖拽 Seek、悬浮时间缩略图 Preview）0 干扰。
