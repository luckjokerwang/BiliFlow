import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, any> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
        set: vi.fn((obj: Record<string, any>) => {
          Object.assign(mockStorage, obj);
          return Promise.resolve();
        }),
      },
    },
  },
}));

import {
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
} from '../src/services/annotationService';

describe('annotationService', () => {
  const bvid = 'BV1testBvid';
  const cid = '123456';

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
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
});
