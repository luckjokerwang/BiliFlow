import { describe, it, expect, vi } from 'vitest';
import { BiliRawSubtitleItem } from '../src/types';
import {
  TranscriptRequestCoordinator,
  TranscriptRequestState,
} from '../src/entrypoints/content/hooks/transcriptRequestCoordinator';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const item = (from: number, content: string): BiliRawSubtitleItem => ({
  from,
  to: from + 2,
  content,
});

describe('TranscriptRequestCoordinator', () => {
  it('reuses an in-flight same-key request for summary retries', async () => {
    const onState = vi.fn();
    const coordinator = new TranscriptRequestCoordinator(onState);
    const gate = deferred<BiliRawSubtitleItem[]>();
    const loader = vi.fn(() => gate.promise);

    const first = coordinator.ensure('BV1_p1_cid', loader);
    const second = coordinator.ensure('BV1_p1_cid', loader);
    gate.resolve([item(0, '第一句'), item(5, '第二句')]);

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
    expect(firstResult.status).toBe('success');

    const finalState = onState.mock.calls.at(-1)?.[0] as TranscriptRequestState;
    expect(finalState.loading).toBe(false);
    expect(finalState.items).toHaveLength(2);
  });

  it('returns superseded for an old retry request and publishes only the new result', async () => {
    const onState = vi.fn();
    const coordinator = new TranscriptRequestCoordinator(onState);
    const oldGate = deferred<BiliRawSubtitleItem[]>();
    const oldRequest = coordinator.ensure('BV1_p1_cid', () => oldGate.promise);
    const newRequest = coordinator.retry('BV1_p1_cid', async () => [
      item(10, '最新字幕'),
    ]);

    oldGate.resolve([item(0, '过期字幕')]);
    const [oldResult, newResult] = await Promise.all([oldRequest, newRequest]);

    expect(oldResult).toEqual({ status: 'superseded' });
    expect(newResult.status).toBe('success');
    const finalState = onState.mock.calls.at(-1)?.[0] as TranscriptRequestState;
    expect(finalState.items[0].content).toBe('最新字幕');
  });

  it('prevents a late old-video response from writing the new video state', async () => {
    const onState = vi.fn();
    const coordinator = new TranscriptRequestCoordinator(onState);
    const oldGate = deferred<BiliRawSubtitleItem[]>();
    const oldRequest = coordinator.ensure('old_p1_cid', () => oldGate.promise);

    coordinator.reset();
    const newRequest = coordinator.ensure('new_p1_cid', async () => [
      item(30, '新视频字幕'),
    ]);
    oldGate.resolve([item(0, '旧视频字幕')]);

    const [oldResult, newResult] = await Promise.all([oldRequest, newRequest]);
    expect(oldResult).toEqual({ status: 'superseded' });
    expect(newResult.status).toBe('success');
    const finalState = onState.mock.calls.at(-1)?.[0] as TranscriptRequestState;
    expect(finalState.items[0].content).toBe('新视频字幕');
  });

  it('allows a fresh ensure after an error and publishes the error state', async () => {
    const onState = vi.fn();
    const coordinator = new TranscriptRequestCoordinator(onState);
    const failing = coordinator.ensure('BV1_p1_cid', async () => {
      throw new Error('字幕请求失败');
    });
    expect(await failing).toEqual({ status: 'error', error: '字幕请求失败' });

    const recovered = coordinator.ensure('BV1_p1_cid', async () => [
      item(0, '恢复后的字幕'),
    ]);
    expect((await recovered).status).toBe('success');
    const finalState = onState.mock.calls.at(-1)?.[0] as TranscriptRequestState;
    expect(finalState.error).toBeNull();
    expect(finalState.items[0].content).toBe('恢复后的字幕');
  });
});
