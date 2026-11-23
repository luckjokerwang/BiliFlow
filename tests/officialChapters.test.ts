import { describe, it, expect } from 'vitest';
import { CreatorChapter, HighlightItem } from '../src/types';
import {
  applyCreatorChapterStructure,
  resolveCreatorChapters,
} from '../src/utils/officialChapters';
import { attachQuotesToHighlights } from '../src/services/llmService';

function highlight(
  id: number,
  timestamp: number,
  title: string,
  keyPoint: string
): HighlightItem {
  return {
    id,
    timestamp,
    timestampSec: timestamp,
    timestampStr: `${Math.floor(timestamp / 60)}`.padStart(2, '0') + ':' + `${timestamp % 60}`.padStart(2, '0'),
    title,
    keyPoint,
  };
}

const chapters: CreatorChapter[] = [
  { from: 0, to: 60, title: '开场' },
  { from: 60, to: 180, title: '方法' },
];

describe('resolveCreatorChapters', () => {
  it('prefers official chapters over description timestamps', () => {
    const result = resolveCreatorChapters(
      {
        officialChapters: chapters,
        descriptionTimestamps: [
          { seconds: 10, title: '简介一' },
          { seconds: 90, title: '简介二' },
        ],
      },
      180
    );
    expect(result).toEqual({ chapters, source: 'official' });
  });

  it('builds description chapters only from at least two timestamps', () => {
    expect(
      resolveCreatorChapters(
        {
          descriptionTimestamps: [
            { seconds: 10, title: '简介一' },
            { seconds: 90, title: '简介二' },
          ],
        },
        180
      )
    ).toEqual({
      chapters: [
        { from: 10, to: 90, title: '简介一' },
        { from: 90, to: 180, title: '简介二' },
      ],
      source: 'description',
    });
    expect(
      resolveCreatorChapters(
        { descriptionTimestamps: [{ seconds: 10, title: '简介一' }] },
        180
      )
    ).toBeNull();
  });
});

describe('applyCreatorChapterStructure', () => {
  it('uses original chapter titles/starts and keeps in-range keyPoints', () => {
    const ai = [
      highlight(1, 5, '模型乱改标题', '开场讲了三个要点'),
      highlight(2, 70, '另一个乱改标题', '方法分两步执行'),
      highlight(3, 160, '多余节点', '多余内容'),
    ];
    const result = applyCreatorChapterStructure(ai, chapters);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'chapter-1',
      timestamp: 0,
      timestampStr: '00:00',
      title: '开场',
      keyPoint: '开场讲了三个要点',
    });
    expect(result[1]).toMatchObject({
      id: 'chapter-2',
      timestamp: 60,
      timestampStr: '01:00',
      title: '方法',
      keyPoint: '方法分两步执行',
    });
  });

  it('does not invent keyPoints for empty chapters and never borrows across chapters', () => {
    const ai = [highlight(1, 70, '模型标题', '方法具体内容')];
    const result = applyCreatorChapterStructure(ai, chapters);
    expect(result[0].keyPoint).toBeUndefined();
    expect(result[1].keyPoint).toBe('方法具体内容');
  });

  it('allows the last chapter to include its end boundary', () => {
    const ai = [highlight(1, 180, '末尾内容', '结尾要点')];
    const result = applyCreatorChapterStructure(ai, [
      { from: 0, to: 60, title: '开场' },
      { from: 60, to: 180, title: '方法' },
    ]);
    expect(result[1].keyPoint).toBe('结尾要点');
  });
});

describe('attachQuotesToHighlights in chapter mode', () => {
  const subs = [
    { from: 0, to: 30, content: '开场字幕' },
    { from: 60, to: 100, content: '方法字幕' },
    { from: 150, to: 170, content: '结尾字幕' },
    { from: 180, to: 200, content: '下一章字幕' },
  ];

  it('preserves chapter starts and bounds quotes by chapter.to including last chapter', () => {
    const structured = applyCreatorChapterStructure(
      [
        highlight(1, 5, 'x', '开场要点'),
        highlight(2, 70, 'y', '方法要点'),
      ],
      chapters
    );
    const result = attachQuotesToHighlights(structured, subs, {
      preserveTimestamps: true,
      creatorChapters: chapters,
    });
    expect(result[0].timestamp).toBe(0);
    expect(result[1].timestamp).toBe(60);
    expect(result[0].originalQuotes?.map((q) => q.content)).toEqual(['开场字幕']);
    expect(result[1].originalQuotes?.map((q) => q.content)).toEqual([
      '方法字幕',
      '结尾字幕',
    ]);
  });

  it('returns no quotes for an empty chapter without nearest fallback', () => {
    const result = attachQuotesToHighlights(
      [highlight(1, 0, 'x', ''), highlight(2, 60, 'y', '方法要点')],
      [{ from: 65, to: 100, content: '只有后一章字幕' }],
      { preserveTimestamps: true, creatorChapters: chapters }
    );
    expect(result[0].originalQuotes).toEqual([]);
  });
});
