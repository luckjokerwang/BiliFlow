import { VideoSummaryResult } from '../types';

/**
 * Formats a VideoSummaryResult into rich GitHub-flavored Markdown
 * suitable for Notion, Obsidian, GitHub, or note-taking apps.
 */
export function formatSummaryAsMarkdown(summary: VideoSummaryResult): string {
  if (!summary) return '';

  const title = summary.title ? `### ⚡ 《${summary.title}》AI 核心要点提炼` : '### ⚡ AI 核心要点提炼';
  const oneSentence = summary.oneSentenceSummary
    ? `> **全片核心**：${summary.oneSentenceSummary}\n`
    : '';

  const highlightsText = Array.isArray(summary.highlights)
    ? summary.highlights
        .map((h, i) => {
          const num = i + 1;
          const time = h.timestampStr || '00:00';
          const heading = `${num}. **[${time}] ${h.title}**`;
          const body = h.keyPoint ? `\n   ${h.keyPoint}` : '';
          return `${heading}${body}`;
        })
        .join('\n\n')
    : '';

  return [title, oneSentence, highlightsText, '---', '*由 BiliFlow (极速心流) 智能提炼*']
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/**
 * Formats a VideoSummaryResult into clean plain text optimized for Bilibili comments.
 * Timestamps in format "MM:SS" or "HH:MM:SS" are natively rendered as clickable seek links by Bilibili.
 */
export function formatSummaryForComment(summary: VideoSummaryResult): string {
  if (!summary) return '';

  const lines: string[] = ['【⚡ BiliFlow AI 视频亮点直达】'];

  if (summary.oneSentenceSummary) {
    lines.push(`全片核心：${summary.oneSentenceSummary}`);
    lines.push('');
  }

  if (Array.isArray(summary.highlights)) {
    summary.highlights.forEach((h, i) => {
      const num = i + 1;
      const time = h.timestampStr || '00:00';
      const point = h.keyPoint ? ` - ${h.keyPoint}` : '';
      lines.push(`${num}. ${time} ${h.title}${point}`);
    });
  }

  lines.push('');
  lines.push('(由 BiliFlow 极速心流生成)');

  return lines.join('\n').trim();
}

/**
 * Copies text to system clipboard with fallback support for all browser environments.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  // 2. Fallback using temporary textarea & document.execCommand
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (_) {}

  return false;
}
