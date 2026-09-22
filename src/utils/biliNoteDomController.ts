/**
 * BiliNoteDomController: Manages interaction with Bilibili's native note editor (.ql-editor),
 * triggering the native note drawer, cursor positioning, and native screenshot integration.
 */

export class BiliNoteDomController {
  /**
   * Checks if Bilibili's native note editor is open and ready.
   */
  static isNativeNoteOpen(): boolean {
    const editor = document.querySelector<HTMLElement>('.ql-editor');
    if (!editor) return false;
    const rect = editor.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Ensures Bilibili's native note drawer is opened.
   * If closed, simulates a click on the official "记笔记" button and awaits editor mounting.
   */
  static async ensureNativeNoteOpen(): Promise<boolean> {
    if (this.isNativeNoteOpen()) return true;

    // Search for Bilibili's official note trigger button
    const noteBtn = document.querySelector<HTMLElement>(
      '.video-toolbar-right-note, .toolbar-right-note, [title*="记笔记"], .bpx-player-ctrl-note, .video-toolbar-v1 .toolbar-right-note'
    );

    if (noteBtn) {
      noteBtn.click();

      // Poll until .ql-editor is mounted (up to 2.5s)
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (this.isNativeNoteOpen()) return true;
      }
    }

    return false;
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
   * Triggers Bilibili's native timestamp flag button in the note toolbar.
   */
  static triggerNativeTimestamp(): boolean {
    const flagBtn = document.querySelector<HTMLElement>(
      '.bili-note-panel [title*="时间"], .bili-note [title*="时间"], .note-editor-toolbar [title*="时间"], [title*="插入时间点"], [title*="时间标记"], .toolbar-flag, .bili-note-panel button:has(.icon-flag)'
    );

    if (flagBtn) {
      flagBtn.click();
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
    const nativeScreenshotBtn = document.querySelector<HTMLElement>(
      '.bili-note-panel [title*="截图"], .bili-note [title*="截图"], .note-editor-toolbar [title*="截图"], [title*="截取视频画面"], [title*="视频截图"], .toolbar-screenshot, .bili-note-panel button:has(.icon-screenshot)'
    );

    if (nativeScreenshotBtn) {
      nativeScreenshotBtn.click();
      return { success: true, method: 'native-button' };
    }

    // 3. Engine 2: Canvas snapshot + clipboard paste fallback
    try {
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, 'image/jpeg', 0.85)
          );

          if (blob) {
            const file = new File([blob], `bili-snap-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true,
            });

            editor.dispatchEvent(pasteEvent);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, method: 'canvas-paste' };
          }
        }
      }
    } catch (err) {
      console.warn('[BiliFlow] Canvas screenshot fallback failed:', err);
    }

    return { success: false, method: 'failed' };
  }

  /**
   * One-click Quick Capture:
   * 1. Ensures native note panel is open.
   * 2. Moves cursor to editor end.
   * 3. Triggers native timestamp (flag button) to insert native clickable `🚩 MM:SS` tag.
   * 4. Triggers native screenshot (camera button).
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

    // 2. Position cursor to the end of editor
    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (e) {
      console.warn('[BiliFlow] Failed to collapse selection to editor end:', e);
    }

    // 3. Format current time string for toast
    const video = document.querySelector<HTMLVideoElement>('video');
    const sec = Math.floor(video?.currentTime || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // 4. Trigger native timestamp (flag icon)
    const hasFlag = this.triggerNativeTimestamp();
    if (!hasFlag) {
      // Fallback: insert timestamp text
      this.insertHtmlAtCursor(`<p><strong>🚩 [${timeStr}]</strong></p>`);
    }

    // Wait for Quill to insert timestamp blot
    await new Promise((r) => setTimeout(r, 120));

    // 5. Trigger screenshot (camera icon)
    const res = await this.triggerNativeScreenshotAt();

    // 6. Append clean spacer
    this.insertHtmlAtCursor('<p><br></p>');

    return {
      success: true,
      timestampStr: timeStr,
      message: res.method === 'native-button' ? '官方截图已捕获' : '画面已截图并粘贴',
    };
  }
}
