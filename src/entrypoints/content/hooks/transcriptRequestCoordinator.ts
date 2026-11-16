import { BiliRawSubtitleItem } from '../../../types';

export interface TranscriptRequestState {
  items: BiliRawSubtitleItem[];
  loading: boolean;
  error: string | null;
}

export type TranscriptLoadResult =
  | { status: 'success'; items: BiliRawSubtitleItem[] }
  | { status: 'error'; error: string }
  | { status: 'superseded' };

type RequestPhase = 'loading' | 'success' | 'error';

interface CurrentRequest {
  key: string;
  id: number;
  // Owned for local invalidation only. The loader takes no signal, so a
  // superseded request's background network is allowed to finish naturally;
  // publishing is gated by the monotonic id below instead.
  controller: AbortController;
  phase: RequestPhase;
  promise: Promise<TranscriptLoadResult>;
}

/**
 * Single-flight coordinator for the full transcript, kept independent from the
 * summary lifecycle. At most one request is active for a video key; a repeated
 * `ensure` reuses an in-flight promise or a resolved success, while a retry or
 * video switch invalidates the previous request so its late result can never
 * publish state.
 */
export class TranscriptRequestCoordinator {
  private onState: (state: TranscriptRequestState) => void;
  private idCounter = 0;
  private current: CurrentRequest | null = null;

  constructor(onState: (state: TranscriptRequestState) => void) {
    this.onState = onState;
  }

  private publish(state: TranscriptRequestState): void {
    this.onState(state);
  }

  private isCurrent(id: number): boolean {
    return this.current !== null && this.current.id === id;
  }

  private start(
    videoKey: string,
    loader: () => Promise<BiliRawSubtitleItem[]>
  ): Promise<TranscriptLoadResult> {
    // Local invalidation of whatever request we are replacing.
    if (this.current) {
      this.current.controller.abort();
    }

    const id = ++this.idCounter;
    const controller = new AbortController();
    const request: CurrentRequest = {
      key: videoKey,
      id,
      controller,
      phase: 'loading',
      promise: undefined as unknown as Promise<TranscriptLoadResult>,
    };
    this.current = request;

    this.publish({ items: [], loading: true, error: null });

    const run = async (): Promise<TranscriptLoadResult> => {
      try {
        const raw = await loader();
        const items = (Array.isArray(raw) ? raw : []).filter(
          (item) =>
            !!item &&
            typeof item.content === 'string' &&
            item.content.trim().length > 0
        );
        if (!this.isCurrent(id)) {
          return { status: 'superseded' };
        }
        request.phase = 'success';
        this.publish({ items, loading: false, error: null });
        return { status: 'success', items };
      } catch (err) {
        if (!this.isCurrent(id)) {
          return { status: 'superseded' };
        }
        const error = err instanceof Error ? err.message : String(err);
        request.phase = 'error';
        this.publish({ items: [], loading: false, error });
        return { status: 'error', error };
      }
    };

    request.promise = run();
    return request.promise;
  }

  /**
   * Reuses the same-key in-flight/success request; a previous same-key error
   * (or a different key) starts a fresh request.
   */
  ensure(
    videoKey: string,
    loader: () => Promise<BiliRawSubtitleItem[]>
  ): Promise<TranscriptLoadResult> {
    const cur = this.current;
    if (cur && cur.key === videoKey && cur.phase !== 'error') {
      return cur.promise;
    }
    return this.start(videoKey, loader);
  }

  /** Invalidates the previous request and always starts a fresh one. */
  retry(
    videoKey: string,
    loader: () => Promise<BiliRawSubtitleItem[]>
  ): Promise<TranscriptLoadResult> {
    return this.start(videoKey, loader);
  }

  /** Invalidates the current key and publishes an empty state. */
  reset(): void {
    if (this.current) {
      this.current.controller.abort();
      this.current = null;
    }
    this.publish({ items: [], loading: false, error: null });
  }
}
