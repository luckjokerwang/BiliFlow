import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, unknown> = {};
type StorageSetter = (obj: Record<string, unknown>) => Promise<void>;
let setOverride: StorageSetter | null = null;

const defaultSet: StorageSetter = (obj) => {
  Object.assign(mockStorage, obj);
  return Promise.resolve();
};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
        set: vi.fn((obj: Record<string, unknown>) =>
          setOverride ? setOverride(obj) : defaultSet(obj)
        ),
      },
    },
  },
}));

import {
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getAnnotationForHighlight,
} from '../src/services/annotationService';

describe('annotationService', () => {
  const bvid = 'BV1testBvid';
  const cid = '123456';

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    setOverride = null;
  });

  it('should return empty array when no annotations exist', async () => {
    const list = await getAnnotations(bvid, cid);
    expect(list).toEqual([]);
  });

  it('should save a new annotation and generate id/timestamps', async () => {
    const saved = await saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      type: 'insight',
      content: '这个技术点很有启发！',
      highlightId: 1,
    });

    expect(saved.id).toBeDefined();
    expect(saved.content).toBe('这个技术点很有启发！');
    expect(saved.type).toBe('insight');
    expect(saved.timestamp).toBe(90);

    const list = await getAnnotations(bvid, cid);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);
  });

  it('should update an existing annotation when id is provided', async () => {
    const initial = await saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      type: 'insight',
      content: '初始内容',
    });

    const updated = await saveAnnotation(bvid, cid, {
      id: initial.id,
      timestamp: 90,
      timestampStr: '01:30',
      type: 'action',
      content: '修改后的行动项',
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.type).toBe('action');
    expect(updated.content).toBe('修改后的行动项');

    const list = await getAnnotations(bvid, cid);
    expect(list.length).toBe(1);
    expect(list[0].content).toBe('修改后的行动项');
  });

  it('should delete an annotation by id', async () => {
    const item1 = await saveAnnotation(bvid, cid, {
      timestamp: 10,
      timestampStr: '00:10',
      content: 'Item 1',
    });
    const item2 = await saveAnnotation(bvid, cid, {
      timestamp: 20,
      timestampStr: '00:20',
      content: 'Item 2',
    });

    let list = await getAnnotations(bvid, cid);
    expect(list.length).toBe(2);

    const deleted = await deleteAnnotation(bvid, cid, item1.id);
    expect(deleted).toBe(true);

    list = await getAnnotations(bvid, cid);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(item2.id);
  });

  it('should sort annotations by timestamp ascending', async () => {
    await saveAnnotation(bvid, cid, {
      timestamp: 300,
      timestampStr: '05:00',
      content: 'Later',
    });
    await saveAnnotation(bvid, cid, {
      timestamp: 60,
      timestampStr: '01:00',
      content: 'Earlier',
    });

    const list = await getAnnotations(bvid, cid);
    expect(list.length).toBe(2);
    expect(list[0].timestamp).toBe(60);
    expect(list[1].timestamp).toBe(300);
  });

  function deferFirstSet(): () => void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setOverride = (obj) => {
      Object.assign(mockStorage, obj);
      setOverride = null;
      return gate;
    };
    return release;
  }

  it('keeps one annotation and the last text for concurrent saves on the same highlight', async () => {
    const release = deferFirstSet();
    const first = saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      content: '第一版',
      highlightId: 42,
    });
    const second = saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      content: '最后文本',
      highlightId: 42,
    });
    release();

    const [savedFirst, savedSecond] = await Promise.all([first, second]);
    expect(savedSecond.id).toBe(savedFirst.id);
    expect(savedSecond.createdAt).toBe(savedFirst.createdAt);
    const list = await getAnnotations(bvid, cid);
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe('最后文本');
  });

  it('does not resurrect an annotation when delete is queued behind a pending save', async () => {
    const initial = await saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      content: '初始内容',
      highlightId: 42,
    });

    const release = deferFirstSet();
    const update = saveAnnotation(bvid, cid, {
      id: initial.id,
      timestamp: 90,
      timestampStr: '01:30',
      content: '将被删除',
      highlightId: 42,
    });
    const removal = deleteAnnotation(bvid, cid, initial.id);
    release();

    await Promise.all([update, removal]);
    expect(await getAnnotations(bvid, cid)).toEqual([]);
  });

  it('getAnnotationForHighlight waits for queued saves and reads the final value', async () => {
    const release = deferFirstSet();
    const first = saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      content: '第一句',
      highlightId: 77,
    });
    const second = saveAnnotation(bvid, cid, {
      timestamp: 90,
      timestampStr: '01:30',
      content: '最后一句',
      highlightId: 77,
    });
    const latest = getAnnotationForHighlight(bvid, cid, 77);
    release();

    const [, , annotation] = await Promise.all([first, second, latest]);
    expect(annotation?.content).toBe('最后一句');
  });
});
