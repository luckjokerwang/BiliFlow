/**
 * BiliNoteEnhancer: Enhances Bilibili's native note editor (.ql-editor & .bili-note-panel)
 * with modern GitHub/Notion-inspired Markdown typography, interactive timestamp styling,
 * and live Markdown prefix shortcuts (#, ##, >, -) via safe Quill toolbar triggering.
 */

const THEME_STYLE_ID = 'biliflow-native-note-theme';

/**
 * Injects GitHub / Notion-inspired Markdown styles directly into top document <head>.
 * This overcomes Shadow DOM encapsulation so Bilibili's native Quill editor looks stunning.
 */
export function injectBiliNoteMarkdownStyles(): () => void {
  if (typeof document === 'undefined') return () => {};

  let styleEl = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    /* ==========================================================================
       BiliFlow Enhanced Markdown Styles for Bilibili Native Notes (.ql-editor)
       ========================================================================== */

    /* 1. Global Editor Typography & Clean Spacing */
    .bili-note-panel .ql-editor,
    .bili-note .ql-editor {
      line-height: 1.68 !important;
      font-size: 13.5px !important;
      letter-spacing: 0.01em !important;
      color: inherit;
    }

    /* 2. Notion/GitHub Style Blockquotes (引用块美化) */
    .bili-note-panel .ql-editor blockquote,
    .bili-note .ql-editor blockquote {
      border-left: 3.5px solid #00aeec !important;
      background: rgba(0, 174, 236, 0.06) !important;
      border-radius: 0 8px 8px 0 !important;
      padding: 6px 12px !important;
      margin: 8px 0 !important;
      color: inherit !important;
      opacity: 0.9 !important;
      font-style: normal !important;
    }

    /* 3. Interactive Clickable Timestamp Tag (蓝旗时间戳胶囊徽标) */
    .bili-note-panel .ql-editor .biliflow-timestamp,
    .bili-note .ql-editor .biliflow-timestamp {
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      padding: 1px 6px !important;
      margin-right: 4px !important;
      border-radius: 5px !important;
      background: rgba(0, 174, 236, 0.12) !important;
      color: #00aeec !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      user-select: none !important;
      text-decoration: none !important;
      transition: all 0.18s cubic-bezier(0.2, 0, 0, 1) !important;
    }

    .bili-note-panel .ql-editor .biliflow-timestamp:hover,
    .bili-note .ql-editor .biliflow-timestamp:hover {
      background: #00aeec !important;
      color: #ffffff !important;
      transform: translateY(-1px) scale(1.03) !important;
      box-shadow: 0 2px 6px rgba(0, 174, 236, 0.35) !important;
    }

    /* 4. Refined Headings Hierarchy (标题阶梯排版) */
    .bili-note-panel .ql-editor h1,
    .bili-note .ql-editor h1 {
      font-size: 1.35em !important;
      font-weight: 700 !important;
      margin: 14px 0 6px 0 !important;
      padding-bottom: 4px !important;
      border-bottom: 1px solid rgba(125, 125, 125, 0.2) !important;
    }

    .bili-note-panel .ql-editor h2,
    .bili-note .ql-editor h2 {
      font-size: 1.2em !important;
      font-weight: 700 !important;
      margin: 12px 0 5px 0 !important;
      color: #00aeec !important;
    }

    .bili-note-panel .ql-editor h3,
    .bili-note .ql-editor h3 {
      font-size: 1.08em !important;
      font-weight: 600 !important;
      margin: 10px 0 4px 0 !important;
    }

    /* 5. Inline Code & Code blocks (等宽代码胶囊) */
    .bili-note-panel .ql-editor code,
    .bili-note .ql-editor code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      background: rgba(125, 125, 125, 0.12) !important;
      padding: 1.5px 5px !important;
      border-radius: 4px !important;
      font-size: 0.9em !important;
      color: #ea580c !important;
    }
  `;

  return () => {
    const el = document.getElementById(THEME_STYLE_ID);
    if (el) el.remove();
  };
}

/**
 * Listens for live Markdown prefix triggers (#, ##, >, -) in Bilibili's Quill editor
 * and gracefully triggers native Quill toolbar buttons to transform the current block.
 * This guarantees 100% compatibility with Bilibili's internal Quill Delta & auto-save state.
 */
export function setupBiliNoteMarkdownShortcuts(): () => void {
  if (typeof document === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    // Only handle space key presses inside the note editor
    if (e.key !== ' ' && e.key !== 'Spacebar') return;

    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.focusNode) return;

    const editor = (sel.focusNode as HTMLElement).closest?.('.ql-editor');
    if (!editor) return;

    // Get current line text before cursor
    const nodeText = sel.focusNode.textContent || '';
    const offset = sel.focusOffset;
    const textBeforeCursor = nodeText.slice(0, offset).trim();

    // Check supported markdown prefixes
    let targetAction: 'h1' | 'h2' | 'h3' | 'quote' | 'list' | null = null;
    let prefixLength = 0;

    if (textBeforeCursor === '#') {
      targetAction = 'h1';
      prefixLength = 1;
    } else if (textBeforeCursor === '##') {
      targetAction = 'h2';
      prefixLength = 2;
    } else if (textBeforeCursor === '###') {
      targetAction = 'h3';
      prefixLength = 3;
    } else if (textBeforeCursor === '>') {
      targetAction = 'quote';
      prefixLength = 1;
    } else if (textBeforeCursor === '-' || textBeforeCursor === '*') {
      targetAction = 'list';
      prefixLength = 1;
    }

    if (!targetAction) return;

    // Locate Quill toolbar buttons
    const toolbar = document.querySelector<HTMLElement>(
      '.ql-toolbar, .note-editor-toolbar, .bili-note-panel .toolbar'
    );
    if (!toolbar) return;

    let triggerBtn: HTMLElement | null = null;
    if (targetAction === 'h1') {
      triggerBtn = toolbar.querySelector<HTMLElement>('button.ql-header[value="1"]');
    } else if (targetAction === 'h2') {
      triggerBtn = toolbar.querySelector<HTMLElement>('button.ql-header[value="2"]');
    } else if (targetAction === 'h3') {
      triggerBtn = toolbar.querySelector<HTMLElement>('button.ql-header[value="3"]');
    } else if (targetAction === 'quote') {
      triggerBtn = toolbar.querySelector<HTMLElement>('button.ql-blockquote');
    } else if (targetAction === 'list') {
      triggerBtn = toolbar.querySelector<HTMLElement>('button.ql-list[value="bullet"]');
    }

    if (triggerBtn) {
      e.preventDefault();

      // Erase prefix characters from text node
      try {
        const range = document.createRange();
        range.setStart(sel.focusNode, Math.max(0, offset - prefixLength));
        range.setEnd(sel.focusNode, offset);
        range.deleteContents();
      } catch {}

      // Click toolbar button to let Quill update internal Delta representation
      triggerBtn.click();
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);

  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
  };
}

/**
 * Initializes full Bilibili note styling and interactive Markdown enhancements.
 */
export function setupBiliNoteEnhancer(): () => void {
  const cleanupStyles = injectBiliNoteMarkdownStyles();
  const cleanupShortcuts = setupBiliNoteMarkdownShortcuts();

  return () => {
    cleanupStyles();
    cleanupShortcuts();
  };
}
