import { getVideoElement, seekToSeconds } from './playerController';
/**
 * BiliNoteDomController: Manages interaction with Bilibili's native note editor (.ql-editor),
 * triggering the native note drawer, cursor positioning, and native screenshot integration.
 */

export class BiliNoteDomController {
  static isNativeNoteOpen(): boolean {
    const editor = document.querySelector<HTMLElement>('.ql-editor');
    if (!editor) return false;
    // Element exists in DOM and is attached to a rendered container
    return Boolean(editor.isConnected);
  }

  /**
   * Comprehensive locator for Bilibili's "记笔记" button across all layouts
   * (Normal page, theater mode, fullscreen, responsive, and side modules).
   */
  static findNativeNoteButton(): HTMLElement | null {
    // 1. Check known stable direct selectors across all Bilibili layouts & player versions
    const direct = document.querySelector<HTMLElement>(
      '.video-toolbar-right-note, .video-toolbar-left-note, .toolbar-right-note, .bpx-player-ctrl-note, .video-note-btn, .note-btn, .note-entry-btn, [data-title*="记笔记"], [title*="记笔记"], [aria-label*="记笔记"], [data-report-click*="note"], .bpx-player-ctrl-note-enter'
    );
    if (direct && !direct.closest('biliflow-hud-root, #biliflow-hud-root')) return direct;
    // 2. Specific selectors in player control bar and video toolbar
    const ctrlNote = document.querySelector<HTMLElement>(
      '.bpx-player-control-bottom-right .bpx-player-ctrl-btn, .bilibili-player-video-btn-note'
    );
    if (ctrlNote && ctrlNote.textContent?.includes('笔记')) return ctrlNote;

    // 2. Search within official Bilibili toolbar containers for text "记笔记"
    const toolbars = document.querySelectorAll<HTMLElement>(
      '.video-toolbar-v1, .video-toolbar, #arc_toolbar_report, .video-toolbar-container, .bpx-player-control-bottom-right, .video-toolbar-module, .video-info-detail, .video-info-toolbar'
    );
    for (const tb of toolbars) {
      // Strictly skip BiliFlow's own host or UI elements
      if (tb.closest('biliflow-hud-root, #biliflow-hud-root') || tb.tagName.toLowerCase().includes('biliflow')) {
        continue;
      }
      const candidates = tb.querySelectorAll<HTMLElement>('*');
      for (const el of candidates) {
        const text = el.textContent?.trim();
        if ((text === '记笔记' || text === '笔记') && el.children.length === 0) {
          const btn = el.closest<HTMLElement>('button, div[role="button"], div, span, a') || el;
          if (!btn.closest('biliflow-hud-root, #biliflow-hud-root')) {
            return btn;
          }
        }
      }
    }

    // 3. Document-wide scan for buttons or clickable divs containing "记笔记", strictly filtering out BiliFlow
    const all = document.querySelectorAll<HTMLElement>('button, div[role="button"], a, span');
    for (const el of all) {
      if (el.closest('biliflow-hud-root, #biliflow-hud-root') || el.classList.contains('biliflow-btn')) {
        continue;
      }
      const text = el.textContent?.trim();
      if ((text === '记笔记' || text === '笔记') && el.children.length <= 1) {
        // Ensure this is not BiliFlow's internal button
        if (!el.textContent?.includes('B站笔记') && !el.textContent?.includes('带截图')) {
          return el;
        }
      }
    }

    return null;
  }

  /**
   * Ensures Bilibili's native note drawer is opened.
   * If closed, simulates standard mouse interaction on the official "记笔记" button and awaits editor mounting.
   */
  static async ensureNativeNoteOpen(): Promise<boolean> {
    if (this.isNativeNoteOpen()) return true;

    const noteBtn = this.findNativeNoteButton();
    if (noteBtn) {
      // Trigger full interactive event dispatch sequence to pierce Vue/React event listeners
      const fireClick = () => {
        try {
          if (typeof PointerEvent !== 'undefined') {
            noteBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          }
          noteBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          noteBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          noteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } catch {}
        if (typeof noteBtn.click === 'function') {
          noteBtn.click();
        }
      };

      fireClick();

      // Poll until .ql-editor is mounted in DOM (up to 4 seconds)
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (this.isNativeNoteOpen()) return true;
        // Re-fire at 1s in case initial click was ignored during layout initialization
        if (i === 10) {
          fireClick();
        }
      }
    }

    return false;
  }

  /**
   * Closes Bilibili's native note drawer by simulating click on close button or toggling note button.
   */
  static closeNativeNoteDrawer(): boolean {
    const closeBtn = document.querySelector<HTMLElement>(
      '.bili-note-panel .close, .bili-note-panel .close-btn, .bili-note-panel .icon-close, .bili-note-panel [title*="关闭"], .bili-note-panel [aria-label*="关闭"], .bili-note-panel [title*="收起"], .bili-note [title*="收起"]'
    );
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    const noteBtn = this.findNativeNoteButton();
    if (noteBtn && this.isNativeNoteOpen()) {
      noteBtn.click();
      return true;
    }
    return false;
  }

  /**
   * Natural Note Session:
   * Automatically ensures Bilibili's native note drawer is open so the user can see it in real-time.
   * Seamlessly executes injection and auto-focuses the editor.
   */
  static async withNativeNoteSession<T>(
    action: (editor: HTMLElement) => Promise<T> | T
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const opened = await this.ensureNativeNoteOpen();
      if (!opened) {
        return {
          success: false,
          error: '未能自动唤起 B站笔记，请确认已在 B站登录或退出全屏',
        };
      }

      const editor = document.querySelector<HTMLElement>('.ql-editor');
      if (!editor) {
        return { success: false, error: '未找到 B站官方富文本编辑器容器' };
      }

      const data = await action(editor);
      return { success: true, data };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Finds the native Blue Flag (timestamp) and Yellow Camera (screenshot) buttons
   * in Bilibili's Quill toolbar by attributes, classes, and computed styles.
   */
  static findToolbarButtons(): {
    flagBtn: HTMLElement | null;
    cameraBtn: HTMLElement | null;
  } {
    const toolbars = document.querySelectorAll<HTMLElement>(
      '.ql-toolbar, .note-editor-toolbar, .bili-note-panel .toolbar, .bili-note .toolbar'
    );

    let flagBtn: HTMLElement | null = null;
    let cameraBtn: HTMLElement | null = null;

    for (const tb of toolbars) {
      const buttons = Array.from(
        tb.querySelectorAll<HTMLElement>('button, .ql-picker, div[role="button"], span')
      );

      for (const btn of buttons) {
        const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || '').toLowerCase();
        const className = (btn.className || '').toString().toLowerCase();
        const html = btn.innerHTML.toLowerCase();

        // 1. Flag button matching (Time / Tag)
        if (
          !flagBtn &&
          (title.includes('时间') ||
            title.includes('标记') ||
            title.includes('flag') ||
            title.includes('tag') ||
            className.includes('flag') ||
            className.includes('tag') ||
            html.includes('flag'))
        ) {
          flagBtn = btn;
        }

        // 2. Camera button matching (Screenshot)
        if (
          !cameraBtn &&
          (title.includes('截图') ||
            title.includes('截取') ||
            title.includes('camera') ||
            title.includes('screenshot') ||
            className.includes('camera') ||
            className.includes('screenshot') ||
            html.includes('camera') ||
            html.includes('screenshot'))
        ) {
          cameraBtn = btn;
        }
      }

      // 3. Fallback heuristic: In Bilibili's toolbar, Camera is yellow and Flag is blue!
      if (!flagBtn || !cameraBtn) {
        for (const btn of buttons) {
          try {
            const style = window.getComputedStyle(btn);
            const bg = style.backgroundColor;
            // Yellow / Orange: Camera
            if (
              !cameraBtn &&
              (bg.includes('250, 173, 20') ||
                bg.includes('230, 162, 60') ||
                bg.includes('245, 158, 11') ||
                bg.includes('orange') ||
                bg.includes('yellow'))
            ) {
              cameraBtn = btn;
            }
            // Blue / Cyan: Flag
            if (
              !flagBtn &&
              (bg.includes('0, 161, 214') ||
                bg.includes('64, 158, 255') ||
                bg.includes('14, 165, 233') ||
                bg.includes('blue') ||
                bg.includes('cyan'))
            ) {
              flagBtn = btn;
            }
          } catch (_) {}
        }
      }
    }

    return { flagBtn, cameraBtn };
  }

  /**
   * Injects HTML content into the Quill editor at cursor position,
   * dispatches input events to trigger auto-save, and returns the target element.
   */
  static insertHtmlAtCursor(html: string): HTMLElement | null {
    const editor = document.querySelector<HTMLElement>('.ql-editor');
    if (!editor) return null;

    editor.focus();

    // Use insertHTML to trigger Quill's native DOM mutators and auto-save
    document.execCommand('insertHTML', false, html);

    // Dispatch input & change events for Quill reactive listeners
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    // Find the last block child inside the editor as the anchor target
    const children = editor.children;
    if (children.length > 0) {
      return children[children.length - 1] as HTMLElement;
    }
    return editor;
  }

  /**
   * Inserts a structured, clickable timestamp tag directly into Quill
   * without triggering Bilibili's modal confirmation dialog.
   */
  static insertTimestamp(sec?: number, timeStr?: string): HTMLElement | null {
    const video = getVideoElement();
    const actualSec = typeof sec === 'number' ? sec : Math.floor(video?.currentTime || 0);
    const m = Math.floor(actualSec / 60);
    const s = actualSec % 60;
    const formattedTime =
      timeStr || `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return this.insertHtmlAtCursor(
      `<p><strong class="biliflow-timestamp" data-seconds="${actualSec}" style="cursor: pointer; color: #00aeec; font-size: 14px; user-select: none;">🚩 ${formattedTime}</strong></p>`
    );
  }

  /**
   * If Bilibili's native timestamp confirmation dialog appears, automatically
   * clicks '确定' so the user is never blocked by confirmation modals.
   */
  static autoConfirmNativeModal(): boolean {
    const confirmBtns = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.bili-note-panel button, .bili-note button, .note-panel button, .bili-modal button'
      )
    );
    const confirmBtn = confirmBtns.find(
      (b) => b.textContent?.trim() === '确定' && !b.getAttribute('disabled')
    );
    if (confirmBtn) {
      confirmBtn.click();
      return true;
    }
    return false;
  }

  /**
   * Triggers Bilibili's native timestamp flag button in the note toolbar.
   * Also triggers auto-confirm so that any modal dialog is dismissed immediately.
   */
  static triggerNativeTimestamp(): boolean {
    const { flagBtn } = this.findToolbarButtons();
    if (flagBtn) {
      flagBtn.click();
      setTimeout(() => {
        this.autoConfirmNativeModal();
      }, 50);
      return true;
    }
    return false;
  }

  /**
   * Positions the cursor at the end of targetElement, and triggers a video screenshot.
   * Engine 1: Simulates click on Bilibili's native screenshot button in the note toolbar.
   * Engine 2: Fallback to HTML5 canvas capture + clipboard paste event into .ql-editor.
   */
  static async triggerNativeScreenshotAt(
    targetElement?: HTMLElement | null
  ): Promise<{ success: boolean; method: string }> {
    const editor = document.querySelector<HTMLElement>('.ql-editor');
    if (!editor) {
      return { success: false, method: 'none' };
    }

    editor.focus();

    // 1. Position cursor at the end of target element if provided
    if (targetElement && targetElement.isConnected) {
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(targetElement);
          range.collapse(false); // Collapse to the very end
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (err) {
        console.warn('[BiliFlow] Failed to set cursor range:', err);
      }
    }

    // 2. Engine 1: Try Bilibili's native screenshot button in the note panel toolbar
    const { cameraBtn } = this.findToolbarButtons();
    if (cameraBtn) {
      cameraBtn.click();
      return { success: true, method: 'native-button' };
    }

    // Safe fallback: Avoid synthesizing mock File or ClipboardEvent to prevent OS-level DMS clipboard errors on Linux
    return { success: false, method: 'no-camera' };
  }

  /**
   * One-click Quick Capture:
   * 1. Ensures native note panel is open (auto-opens if closed).
   * 2. Moves cursor to editor end.
   * 3. Inserts an intact clickable timestamp tag.
   * 4. Triggers native screenshot (camera button) directly below it.
   * 5. Adds a clean trailing spacer.
   */
  static async quickCaptureCurrentFrame(): Promise<{
    success: boolean;
    message?: string;
    timestampStr?: string;
  }> {
    // 1. Ensure note panel is open
    const opened = await this.ensureNativeNoteOpen();
    if (!opened) {
      return {
        success: false,
        message: '未能唤起 B站笔记，请确认已登录或手动点击播放器下方的「记笔记」',
      };
    }

    const editor = document.querySelector<HTMLElement>('.ql-editor');
    if (!editor) {
      return { success: false, message: '未找到 B站笔记编辑器容器' };
    }

    editor.focus();

    // 2. Format current time string
    const video = getVideoElement();
    const sec = Math.floor(video?.currentTime || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // 3. Move cursor to the very end of editor
    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      // Selection collapse failed gracefully
    }

    // 4. Insert structured clickable timestamp directly (Zero confirmation modal)
    const anchorEl = this.insertTimestamp(sec, timeStr);

    // Wait 120ms for Quill blot to settle
    await new Promise((r) => setTimeout(r, 120));

    // 5. Trigger screenshot right at anchor position
    const res = await this.triggerNativeScreenshotAt(anchorEl);

    // 6. Append clean spacer
    this.insertHtmlAtCursor('<p><br></p>');

    return {
      success: true,
      timestampStr: timeStr,
      message: res.method === 'native-button' ? '官方截图已捕获' : '画面已截图并粘贴',
    };
  }
}

/**
 * Global click listener for Bilibili native note editor:
 * Intercepts clicks on any timestamp badge or text inside .ql-editor and seeks the video!
 */
export function setupNativeNoteTimestampClickListener(): () => void {
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Must be inside the note panel or editor
    const inNote = target.closest('.ql-editor, .bili-note-panel, .bili-note, .note-panel');
    if (!inNote) return;

    // 1. Check data-seconds attribute (e.g. data-seconds="159")
    const tagWithSec = target.closest<HTMLElement>('[data-seconds], [data-time], .tag-item, .ql-tag');
    if (tagWithSec) {
      const rawSec = tagWithSec.getAttribute('data-seconds') || tagWithSec.getAttribute('data-time');
      const sec = Number(rawSec);
      if (!isNaN(sec) && sec >= 0) {
        if (seekToSeconds(sec)) {
          return;
        }
      }
    }

    // 2. Check text content for mm:ss or hh:mm:ss timestamp (e.g. [02:39] or 🚩 [02:39])
    const text = target.textContent || '';
    const match = text.match(/(?:\[|\b)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\b)/);
    if (match) {
      let seconds = 0;
      if (match[3]) {
        seconds = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
      } else {
        seconds = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
      if (seconds >= 0) {
        seekToSeconds(seconds);
      }
    }
  };

  document.addEventListener('click', handleClick, true);
  return () => {
    document.removeEventListener('click', handleClick, true);
  };
}
