import { browser } from 'wxt/browser';
import { ExtensionMessage, ExtensionResponse } from '../types';

/** Sends a message to the background, converting extension-invalidation errors to Chinese UI messages. */
export async function safeSendMessage<T = unknown>(
  msg: ExtensionMessage
): Promise<ExtensionResponse<T>> {
  if (!browser.runtime?.id) {
    return {
      success: false,
      error: 'BiliFlow 扩展已更新或重载。请按 F5 刷新此网页即可恢复使用。',
    };
  }
  try {
    const res = await browser.runtime.sendMessage(msg);
    return res as ExtensionResponse<T>;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes('Extension context invalidated') ||
      errMsg.includes('Cannot read properties of undefined')
    ) {
      return {
        success: false,
        error: 'BiliFlow 扩展已更新。请按 F5 刷新当前网页以恢复连接。',
      };
    }
    return { success: false, error: errMsg };
  }
}
