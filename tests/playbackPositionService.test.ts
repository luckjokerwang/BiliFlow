import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { browser } from 'wxt/browser';
vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));
const storageGet = browser.storage.local.get as unknown as Mock;
const storageSet = browser.storage.local.set as unknown as Mock;
import {
  loadPlaybackPositions,
  savePlaybackPosition,
} from '../src/services/playbackPositionService';



function freshStore(): Record<string, unknown> {
  return {};
}

describe('playbackPositionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = freshStore();
    storageGet.mockImplementation(async (key: string) => ({ [key]: store[key] }));
    storageSet.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
  });

  it('isolates positions by bvid+cid storage key', async () => {
    await savePlaybackPosition('BV1', 'cid1', 'a', 42);
    expect(storageSet).toHaveBeenCalledWith({
      biliflow_playback_positions_BV1_cid1: expect.objectContaining({
        a: expect.objectContaining({ positionSec: 42 }),
      }),
    });
  });

  it('keeps consecutive writes to the same video from overwriting each other', async () => {
    await savePlaybackPosition('BV1', 'cid1', 'a', 10);
    await savePlaybackPosition('BV1', 'cid1', 'b', 20);
    const stored = storageSet.mock.calls[storageSet.mock.calls.length - 1][0];
    expect(stored.biliflow_playback_positions_BV1_cid1.a.positionSec).toBe(10);
    expect(stored.biliflow_playback_positions_BV1_cid1.b.positionSec).toBe(20);
  });

  it('degrades gracefully on corrupted stored data', async () => {
    storageGet.mockResolvedValueOnce({ biliflow_playback_positions_BV1_cid1: 'garbage' });
    expect(await loadPlaybackPositions('BV1', 'cid1')).toEqual({});
  });

  it('skips invalid inputs', async () => {
    await savePlaybackPosition('', 'cid1', 'a', 10);
    await savePlaybackPosition('BV1', 'cid1', 'a', -1);
    await savePlaybackPosition('BV1', 'cid1', 'a', NaN);
    expect(storageSet).not.toHaveBeenCalled();
  });
});
