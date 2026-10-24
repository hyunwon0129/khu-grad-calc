// 로그인 상태에 따라 서버와 데이터를 맞춘다.
// - 로그인 직후: 서버 기록을 불러온다. 이 기기 기록과 다르면 사용자에게 고르게 한다.
// - 이후: 데이터가 바뀔 때마다 0.8초 뒤 서버에 저장한다. 데이터가 비면 서버 행도 지운다.
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { deleteCloud, fetchCloud, onSession, pushCloud } from './cloud';
import { isEmpty, sameData, sanitize, type UserData } from './storage';
import type { SyncStatus } from '../components/AccountPanel';

export function useCloudSync(current: UserData, apply: (d: UserData) => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [conflict, setConflict] = useState<UserData | null>(null);
  const [ready, setReady] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const currentRef = useRef(current);
  currentRef.current = current;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => onSession(setSession), []);
  const userId = session?.user.id;

  // 로그인 직후 서버 기록 불러오기
  useEffect(() => {
    setReady(false);
    setConflict(null);
    if (!userId) return;
    let cancelled = false;
    setStatus('loading');
    fetchCloud()
      .then((remote) => {
        if (cancelled) return;
        const local = currentRef.current;
        if (!remote || isEmpty(remote)) {
          setReady(true); // 서버가 비어 있으면 이 기기 기록을 올린다
        } else if (isEmpty(local) || sameData(local, remote)) {
          applyRef.current(remote);
          setReady(true);
        } else {
          setConflict(remote);
          setStatus('waiting');
        }
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [userId]);

  // 바뀔 때마다 저장
  const key = JSON.stringify(sanitize(current));
  useEffect(() => {
    if (!userId || !ready) return;
    setStatus('saving');
    const t = setTimeout(() => {
      const data = currentRef.current;
      const op = isEmpty(data) ? deleteCloud() : pushCloud(userId, data);
      op.then(() => { setStatus('saved'); setLastSynced(new Date()); })
        .catch(() => setStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [key, userId, ready]);

  const resolveConflict = (use: 'cloud' | 'local') => {
    if (conflict && use === 'cloud') applyRef.current(conflict);
    setConflict(null);
    setReady(true);
  };

  return { session, status, conflict, resolveConflict, lastSynced };
}
