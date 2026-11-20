import { useCallback, useEffect, useRef, useState } from 'react';
import { CommunityDigest, ResolvedVideoInfo } from '../../../types';
import { safeSendMessage } from '../../../utils/extensionMessaging';

interface UseCommunityDigestParams {
  videoInfo: ResolvedVideoInfo | null;
  enabled: boolean;
}

interface CommunityDigestState {
  digest: CommunityDigest | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useCommunityDigest({
  videoInfo,
  enabled,
}: UseCommunityDigestParams): CommunityDigestState {
  const [digest, setDigest] = useState<CommunityDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestIdRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const fetchedAttemptRef = useRef(0);
  const bvid = videoInfo?.bvid || '';
  const cid = videoInfo?.cid || '';
  const aid = videoInfo?.aid || '';
  const durationSec = videoInfo?.duration || 0;
  const key = `${bvid}_${cid}`;
  useEffect(() => {
    loadedKeyRef.current = null;
    fetchedAttemptRef.current = attempt;
    setDigest(null);
    setError(null);
  }, [key]);

  useEffect(() => {
    if (!enabled || !key || !bvid || !cid) return;
    if (loadedKeyRef.current === key && fetchedAttemptRef.current === attempt) return;

    const requestId = ++requestIdRef.current;
    fetchedAttemptRef.current = attempt;
    setLoading(true);
    setError(null);
    void safeSendMessage<CommunityDigest>({
      type: 'FETCH_COMMUNITY_DIGEST',
      payload: {
        bvid,
        cid,
        aid,
        durationSec,
      },
    }).then((res) => {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      if (res.success && res.data) {
        loadedKeyRef.current = key;
        setDigest(res.data);
      } else {
        setError(res.error || '社区精选加载失败');
      }
    });
  }, [enabled, key, bvid, cid, aid, durationSec, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { digest, loading, error, retry };
}
