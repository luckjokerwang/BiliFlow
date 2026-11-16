import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, unknown> = {};
type StorageListener = (
  changes: Record<string, unknown>,
  areaName: string
) => void;
const storageListeners = new Set<StorageListener>();

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(mockStorage, obj);
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn((listener: StorageListener) => {
          storageListeners.add(listener);
        }),
        removeListener: vi.fn((listener: StorageListener) => {
          storageListeners.delete(listener);
        }),
      },
    },
  },
}));

import {
  enqueueNoteSync,
  getPendingNoteSyncs,
  hasInjectedNote,
  markInjected,
  markSynced,
  subscribeNoteSyncQueueChange,
  type NoteSyncQueueItem,
} from '../src/services/noteSyncQueueService';

const BVID = 'BV1testBvid';
const CID = '123456';
const KEY = 'biliflow_note_sync_queue';

function rawQueue(): Record<string, NoteSyncQueueItem> {
  return (mockStorage[KEY] ?? {}) as Record<string, NoteSyncQueueItem>;
}

describe('noteSyncQueueService', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    storageListeners.clear();
  });

  it('rejects empty input and any HTML containing an inline image', async () => {
    const empty = await enqueueNoteSync({ bvid: BVID, cid: CID, itemKey: 'a', html: '' });
    expect(empty).toEqual({ enqueued: false, reason: 'invalid' });

    const withImage = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'a',
      html: '<img src="data:image/png;base64,AAAA">',
    });
    expect(withImage).toEqual({ enqueued: false, reason: 'invalid' });
    expect(await getPendingNoteSyncs(BVID, CID)).toEqual([]);
  });

  it('stores text as pending and refreshes the same pending item without duplicating', async () => {
    const first = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h1',
      html: '<p>first</p>',
      annotationText: '想法 A',
    });
    expect(first.enqueued).toBe(true);

    const second = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h1',
      html: '<p>edited</p>',
      annotationText: '想法 B',
    });
    expect(second.enqueued).toBe(true);

    const pending = await getPendingNoteSyncs(BVID, CID);
    expect(pending).toHaveLength(1);
    expect(pending[0].html).toBe('<p>edited</p>');
    expect(pending[0].annotationText).toBe('想法 B');
  });

  it('drops the HTML body after injection and keeps only a small tombstone', async () => {
    const queued = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h1',
      html: '<p>AI 观点很长很长</p>',
      annotationText: '我的感悟也很长',
    });
    if (!queued.enqueued) throw new Error('enqueue failed');

    await markInjected([queued.id]);
    const item = rawQueue()[queued.id];
    expect(item.status).toBe('injected');
    expect(item.html).toBe('');
    expect(item.annotationText).toBeUndefined();
    expect(item.injectedAt).toBeTypeOf('number');
    expect(JSON.stringify(item).length).toBeLessThan(200);

    expect(await getPendingNoteSyncs(BVID, CID)).toEqual([]);
    expect(await hasInjectedNote(BVID, CID, 'h1')).toBe(true);
  });

  it('blocks duplicate enqueue after injection and advances to synced', async () => {
    const queued = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h1',
      html: '<p>one</p>',
    });
    if (!queued.enqueued) throw new Error('enqueue failed');
    await markInjected([queued.id]);

    const again = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h1',
      html: '<p>one again</p>',
    });
    expect(again).toEqual({ enqueued: false, reason: 'duplicate' });
    expect(Object.keys(rawQueue())).toHaveLength(1);

    await markSynced([queued.id]);
    expect(rawQueue()[queued.id].status).toBe('synced');
    expect(await hasInjectedNote(BVID, CID, 'h1')).toBe(true);
  });

  it('caps pending items at 100 for one video part', async () => {
    for (let i = 0; i < 100; i++) {
      const res = await enqueueNoteSync({
        bvid: BVID,
        cid: CID,
        itemKey: `h${i}`,
        html: `<p>${i}</p>`,
      });
      expect(res.enqueued).toBe(true);
    }
    const overflow = await enqueueNoteSync({
      bvid: BVID,
      cid: CID,
      itemKey: 'h100',
      html: '<p>overflow</p>',
    });
    expect(overflow).toEqual({ enqueued: false, reason: 'full' });
    expect(await getPendingNoteSyncs(BVID, CID)).toHaveLength(100);
  });

  it('scopes pending items by bvid + cid', async () => {
    await enqueueNoteSync({ bvid: BVID, cid: CID, itemKey: 'h1', html: '<p>a</p>' });
    await enqueueNoteSync({ bvid: BVID, cid: '999', itemKey: 'h1', html: '<p>b</p>' });
    expect(await getPendingNoteSyncs(BVID, CID)).toHaveLength(1);
    expect(await getPendingNoteSyncs(BVID, '999')).toHaveLength(1);
  });

  it('responds only to local note queue changes and unsubscribes cleanly', () => {
    const listener = vi.fn();
    const emit = (changes: Record<string, unknown>, areaName: string) => {
      storageListeners.forEach((registered) => registered(changes, areaName));
    };

    const unsubscribe = subscribeNoteSyncQueueChange(listener);
    emit({ unrelated: {} }, 'local');
    emit({ [KEY]: {} }, 'sync');
    expect(listener).not.toHaveBeenCalled();

    emit({ [KEY]: {} }, 'local');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    emit({ [KEY]: {} }, 'local');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
