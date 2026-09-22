import { HighlightItem, VideoSummaryResult } from '../types';
import { QuillDeltaOp, UserAnnotation, UserAnnotationType, VideoStudyNote } from '../types/biliNote';

export function getTypeLabel(type: UserAnnotationType): string {
  switch (type) {
    case 'insight':
      return '💡 启发';
    case 'question':
      return '❓ 存疑';
    case 'action':
      return '🎯 行动';
    case 'keypoint':
      return '⭐ 重点';
    default:
      return '💭 感悟';
  }
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a single highlight card and optional user annotation into clean semantic HTML
 * for direct insertion into Bilibili's Quill editor (.ql-editor).
 */
export function formatCardToNoteHtml(
  highlight: HighlightItem,
  annotation?: UserAnnotation
): string {
  const time = highlight.timestampStr || '00:00';
  const title = escapeHtml(highlight.title);
  const keyPoint = escapeHtml(highlight.keyPoint || '');

  const parts: string[] = [];

  // 1. Chapter / Timestamp heading
  parts.push(`<p><strong>[${time}] ${title}</strong></p>`);

  // 2. AI Fact Quote block
  if (keyPoint) {
    parts.push(`<blockquote>🤖 视频观点：${keyPoint}</blockquote>`);
  }

  // 3. User Subjective Annotation
  if (annotation && annotation.content.trim()) {
    const label = getTypeLabel(annotation.type);
    const content = escapeHtml(annotation.content.trim());
    parts.push(`<p>💬 <strong>${label}</strong>：${content}</p>`);
  }

  // 4. Trailing line break for clean cursor positioning and subsequent screenshot
  parts.push('<p><br></p>');

  return parts.join('');
}

/**
 * Formats a full VideoStudyNote (AI Summary + User Annotations) into standard Quill Delta operations
 * for Bilibili native note cloud draft API.
 */
export function formatStudyNoteToDelta(note: VideoStudyNote): QuillDeltaOp[] {
  const ops: QuillDeltaOp[] = [];

  const title = note.title || note.summary?.title || '视频精读';
  ops.push(
    { insert: `⚡ 《${title}》AI 精读与学习笔记\n`, attributes: { header: 2, bold: true } },
    { insert: '\n' }
  );

  // 1. One sentence summary
  if (note.summary?.oneSentenceSummary) {
    ops.push(
      { insert: '💡 全片核心：', attributes: { bold: true } },
      { insert: `${note.summary.oneSentenceSummary}\n\n` }
    );
  }

  // 2. Highlights with bound annotations
  const highlights = note.summary?.highlights || [];
  const annotations = note.annotations || [];
  const handledAnnotationIds = new Set<string>();

  if (highlights.length > 0) {
    ops.push(
      { insert: '📌 核心亮点与时间轴\n', attributes: { header: 3, bold: true } },
      { insert: '\n' }
    );

    highlights.forEach((h, idx) => {
      const time = h.timestampStr || '00:00';
      ops.push({
        insert: `${idx + 1}. [${time}] ${h.title}\n`,
        attributes: { bold: true },
      });

      if (h.keyPoint) {
        ops.push(
          { insert: `🤖 视频观点：${h.keyPoint}\n`, attributes: { blockquote: true } }
        );
      }

      // Find bound annotations
      const bound = annotations.filter(
        (a) => a.highlightId !== undefined && String(a.highlightId) === String(h.id)
      );

      bound.forEach((ann) => {
        handledAnnotationIds.add(ann.id);
        const label = getTypeLabel(ann.type);
        ops.push(
          { insert: `💬 我的感悟（${label}）：\n`, attributes: { bold: true } },
          { insert: `   ${ann.content}\n` }
        );
      });

      ops.push({ insert: '\n' });
    });
  }

  // 3. Unbound / Standalone annotations
  const unbound = annotations.filter((a) => !handledAnnotationIds.has(a.id));
  if (unbound.length > 0) {
    ops.push(
      { insert: '💭 随看随记感悟\n', attributes: { header: 3, bold: true } },
      { insert: '\n' }
    );

    unbound.forEach((ann) => {
      const label = getTypeLabel(ann.type);
      const time = ann.timestampStr ? `[${ann.timestampStr}] ` : '';
      ops.push(
        { insert: `• ${time}${label}：${ann.content}\n` }
      );
    });

    ops.push({ insert: '\n' });
  }

  // 4. Footer
  ops.push(
    { insert: '──────────────\n' },
    { insert: '由 BiliFlow (极速心流) 协同记录\n', attributes: { italic: true } }
  );

  return ops;
}

/**
 * Formats a VideoStudyNote into rich GitHub-flavored Markdown for Notion, Obsidian, etc.
 */
export function formatStudyNoteToMarkdown(note: VideoStudyNote): string {
  const title = note.title || note.summary?.title || '视频精读';
  const lines: string[] = [`# ⚡ 《${title}》AI 精读与学习笔记`];

  if (note.summary?.oneSentenceSummary) {
    lines.push(`> **全片核心**：${note.summary.oneSentenceSummary}\n`);
  }

  const highlights = note.summary?.highlights || [];
  const annotations = note.annotations || [];
  const handledAnnotationIds = new Set<string>();

  if (highlights.length > 0) {
    lines.push('## 📌 核心亮点与时间轴\n');

    highlights.forEach((h, idx) => {
      const time = h.timestampStr || '00:00';
      lines.push(`### ${idx + 1}. [${time}] ${h.title}`);

      if (h.keyPoint) {
        lines.push(`> 🤖 **视频观点**：${h.keyPoint}\n`);
      }

      const bound = annotations.filter(
        (a) => a.highlightId !== undefined && String(a.highlightId) === String(h.id)
      );

      if (bound.length > 0) {
        lines.push('💬 **我的感悟**：');
        bound.forEach((ann) => {
          handledAnnotationIds.add(ann.id);
          const label = getTypeLabel(ann.type);
          lines.push(`- **${label}**：${ann.content}`);
        });
        lines.push('');
      }
    });
  }

  const unbound = annotations.filter((a) => !handledAnnotationIds.has(a.id));
  if (unbound.length > 0) {
    lines.push('## 💭 随看随记感悟\n');
    unbound.forEach((ann) => {
      const label = getTypeLabel(ann.type);
      const time = ann.timestampStr ? `[${ann.timestampStr}] ` : '';
      lines.push(`- ${time}**${label}**：${ann.content}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*由 BiliFlow (极速心流) 协同记录*');

  return lines.join('\n').trim();
}
