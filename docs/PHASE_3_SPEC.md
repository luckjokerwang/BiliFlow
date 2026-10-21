# ⚡ BiliFlow Phase 3 Specification (Spec)
## 视频总结精准对齐、字幕防幻觉与长视频体验强化规范

---

## 1. Problem Statement (核心问题陈述)

虽然 BiliFlow 在 Phase 2 完成了播放器进度条高能打点、全屏 HUD 深度挂载与人机双轨原生笔记系统，但在日常真实复杂的观影场景中，用户依然反馈存在**“总结内容和视频对不上”**的痛点。经过系统级代码排查，根本诱因如下：

1. **分 P (Multi-P) 连播与切换时，强依赖 URL 参数导致与播放器真实状态脱节**：
   - 现行逻辑仅通过 `new URLSearchParams(window.location.search).get('p')` 提取分 P 序号；
   - 当用户在播放列表切集、或者视频播放结束**自动连播到下一集 (Auto-advance)** 时，B 站底层播放器已完成切流播放，但 URL 往往延迟更新或根本未刷新 `?p=` 参数，导致抓取的依然是上一集或第 1 期的 CID 与字幕，造成“画面播的是第 2 集，总结展示的是第 1 集”。
2. **字幕瀑布流优先级缺陷导致单向外语机翻轨穿透大模型，引发严重幻觉**：
   - 当原视频为中文原声但无人工字幕时，B 站若仅返回了英文自动翻译轨（`ai-en`），现行算法将其视为有效字幕下载；
   - 大模型在接收到“中文技术视频标题 + 英文机翻碎片字幕”时，上下文严重撕裂，引发严重幻觉（凭空捏造要点或把开头引用的广告/电影当成核心）。
3. **长视频（> 15~30 分钟）超长上下文引发大模型“首因效应与注意力衰减” (Lost in the Middle)**：
   - 字幕未做密度自适应控制与时间均匀性要求，大模型仅关注前 2~3 分钟，提炼的 highlights 全部拥挤在开头，中后段核心要点全部丢失。
4. **大模型提炼时间戳的浮动漂移与非真实锚点 (Timestamp Drift)**：
   - 大模型生成的时间戳经常估算凑整，跳转后偏离核心观点，且“展开原文依据”截取的前后字幕也随之错位。
5. **厂商配置开箱即用体验欠缺**：
   - 默认 Providers 中 `models: []` 全为空，新用户填入 API Key 若未手动点击“自动拉取”，系统直接回退 `deepseek-chat`，在 OpenAI 等厂商下直接报 404 错误。

---

## 2. Technical Milestones & Task Breakdown (里程碑与任务拆解)

依据工程优先级，按原子化闭环模式拆解为以下 4 个独立任务：

```mermaid
graph LR
    T1[Task 1: 多 P 选集与自动连播换源精准对齐] -->|审查确认与原子提交| T2[Task 2: 字幕语言防御与时间戳锚点吸附]
    T2 -->|审查确认与原子提交| T3[Task 3: 长视频全景覆盖与注意力衰减根治]
    T3 -->|审查确认与原子提交| T4[Task 4: 开箱即用推荐模型与路由体验优化]
```

### 任务 1 (Task 1): 播放器多 P 选集与自动连播换源精准对齐 (当前优先执行)
- **目标**：彻底解决分 P 视频自动连播或点击切集时，总结内容滞后在上一集的问题。
- **改动范围**：
  - `src/utils/playerController.ts`: 升级 `extractVideoMeta()`，增加对 DOM 中激活选集节点（`.cur-list ul li.on`, `.video-pod__item.active`, `.part-item.on`）的探测，优先从 DOM 提取实际播放的 `pIndex` 和子标题；
  - `src/entrypoints/content/hooks/useAutoSummary.ts`: 建立“URL 变化 + 播放器 `<video>` 换源事件 (`loadeddata` / `durationchange`) + 选集 DOM 突变 (`MutationObserver`)”三维监听体系；
  - `src/entrypoints/background.ts`: 清理历史遗留的硬编码 `deleteCachedSummary('BV1rHh16CEfm', ...)` 补丁，由统一的动态防错位逻辑接管。
- **验收标准**：
  - 单元测试与端到端模拟验证：无论 URL 是否带有 `?p=`，只要选集 DOM 或底层播放器换源，`useAutoSummary` 均能精确解析当前分 P 并刷新总结。

### 任务 2 (Task 2): 字幕语言置信度拦截与时间戳真实锚点吸附
- **目标**：杜绝非母语机翻轨引发大模型幻觉，并将时间戳吸附至真实有效字幕起始点。
- **改动范围**：
  - `src/utils/subtitleUtils.ts`: 优化 `getSubtitlePriorityScore`，若视频无中文原声字幕且只有非中文翻译轨时，增加置信度降级或标记；实现 `snapTimestampToUtterance` 时间戳吸附函数；
  - `src/services/llmService.ts`: 解析完大模型 highlights 后调用吸附算法，精准校正至字幕真实秒数；
  - `src/entrypoints/content/components/HUDHeader.tsx` / `HUDToast.tsx`: 当仅能获取翻译字幕时予以明确提示。

### 任务 3 (Task 3): 长视频时间线全景覆盖与注意力衰减根治
- **目标**：解决 15 分钟以上长视频要点全扎堆在开篇 2 分钟的问题。
- **改动范围**：
  - `src/services/llmService.ts`: 优化 `SYSTEM_PROMPT`，强制注入时间跨度均匀分布约束（覆盖前中后各阶段）；
  - `src/utils/transcriptChunker.ts`: 引入长文本自适应抽稀算法，防止 Token 超限与注意力涣散；
  - 超时时间从 25s 自适应放宽至 45s。

### 任务 4 (Task 4): 开箱即用推荐模型预设与播放列表路由兼容
- **目标**：消除新用户配置摩擦，扩展播放列表场景支持。
- **改动范围**：
  - `src/constants/index.ts`: 为 DeepSeek、OpenAI、Gemini、SiliconFlow、SenseNova 等各大厂商在 `DEFAULT_PROVIDERS` 中预设推荐标准 Model；
  - `src/entrypoints/options/App.tsx`: 优化 `migrateCleanSlate`，保留官方推荐模型，填 Key 即用；
  - `src/utils/playerController.ts`: 兼容 `/list/watchlater` 等播放列表 URL 提取 BV。

---

## 3. Data Contracts & Interfaces (数据契约设计)

```typescript
// 1. 播放器选集嗅探结果
export interface ActivePlaylistItemMeta {
  pIndex: number;
  partTitle?: string;
  source: 'url' | 'dom_playlist' | 'dom_pod';
}

// 2. 真实字幕条目吸附结果
export interface SnappedTimestamp {
  originalSeconds: number;
  snappedSeconds: number;
  snappedTimestampStr: string;
  matchedQuoteText?: string;
}

// 3. 字幕轨道质量与置信度元数据
export interface SubtitleTrackMeta {
  isOriginalAudioLang: boolean;  // 是否原声转录（非机翻）
  isMachineTranslated: boolean;  // 是否自动翻译
  languageCode: string;
  languageDoc: string;
}
```

---

## 4. Execution Protocol (执行规程)

遵循 `rule://git-workflow` 与 `rule://spec-workflow`：
1. 每次只编写当前一个子任务的代码；
2. 完成编写与自测后，严格输出标准结构化审查汇报；
3. 停下来等待用户确认，用户回复“通过 / 提交”后执行版本自增、原子提交、Git 打标推送并打包；
4. 随后再启动下一任务。
