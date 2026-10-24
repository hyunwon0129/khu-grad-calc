// 계정 영역: 로그인 전에는 동의 + 로그인 방법, 로그인 후에는 동기화 상태와 계정 관리
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  deleteAccount, deleteCloud, providers, signInWithEmail, signInWithProvider, signOut, type Provider,
} from '../lib/cloud';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'waiting';

interface Props {
  session: Session | null;
  status: SyncStatus;
  lastSynced: Date | null;
  onClose: () => void;
}

const PROVIDER_LABEL: Record<Provider, string> = { kakao: '카카오로 로그인', google: 'Google로 로그인' };
const CONSENT_KEY = 'khu-grad-calc:consent';

function readConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
}
function writeConsent(v: boolean) {
  try { if (v) localStorage.setItem(CONSENT_KEY, '1'); else localStorage.removeItem(CONSENT_KEY); } catch { /* 무시 */ }
}

export default function AccountPanel({ session, status, lastSynced, onClose }: Props) {
  const [consent, setConsent] = useState(readConsent);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'none' | 'data' | 'account'>('none');

  const run = async (fn: () => Promise<void>, done?: string) => {
    setError(''); setMessage('처리 중…');
    try { await fn(); setMessage(done ?? ''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  if (session) {
    const statusText: Record<SyncStatus, string> = {
      idle: '동기화 준비됨', loading: '서버에서 불러오는 중…', saving: '저장 중…',
      saved: lastSynced ? `${lastSynced.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨` : '저장됨',
      error: '저장하지 못했습니다. 인터넷 연결을 확인하세요.', waiting: '어떤 데이터를 쓸지 선택해 주세요',
    };
    return (
      <section className="account" aria-label="계정">
        <div className="account-row">
          <div>
            <strong>{session.user.email ?? '로그인됨'}</strong>
            <div className={status === 'error' ? 'warn' : 'muted'} role="status">{statusText[status]}</div>
          </div>
          <div className="actions">
            <button type="button" onClick={() => run(signOut)}>로그아웃</button>
            <button type="button" className="link" onClick={onClose}>닫기</button>
          </div>
        </div>

        <details>
          <summary>계정·데이터 관리</summary>
          <div className="stack">
            <p className="muted">서버에는 교육과정 선택, 들은 과목(학수번호·과목명·학점·학기·이수구분), 영역별 학점, 로드맵 설정만 저장됩니다. 로그인용 이메일은 인증 서비스에 보관됩니다.</p>
            {confirm === 'none' && (
              <div className="actions">
                <button type="button" className="link" onClick={() => setConfirm('data')}>서버에 저장된 내 데이터 삭제</button>
                <button type="button" className="link" onClick={() => setConfirm('account')}>회원 탈퇴</button>
              </div>
            )}
            {confirm === 'data' && (
              <div className="confirm">
                <span>서버의 과목 기록을 지웁니다. 이 기기에 있는 기록은 남습니다.</span>
                <button type="button" onClick={() => run(async () => { await deleteCloud(); setConfirm('none'); }, '서버 데이터를 삭제했습니다.')}>삭제</button>
                <button type="button" className="link" onClick={() => setConfirm('none')}>취소</button>
              </div>
            )}
            {confirm === 'account' && (
              <div className="confirm">
                <span>계정과 서버 데이터를 모두 지웁니다. 되돌릴 수 없습니다.</span>
                <button type="button" onClick={() => run(async () => { await deleteAccount(); writeConsent(false); setConfirm('none'); }, '탈퇴 처리했습니다.')}>탈퇴</button>
                <button type="button" className="link" onClick={() => setConfirm('none')}>취소</button>
              </div>
            )}
          </div>
        </details>
        {message && <p className={message === "처리 중…" ? "muted" : "ok"} role="status">{message}</p>}
        {error && <p className="warn" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="account" aria-label="로그인">
      <div className="account-row">
        <div>
          <strong>로그인하고 다른 기기에서 이어보기</strong>
          <div className="muted">로그인하지 않아도 모든 기능을 쓸 수 있습니다.</div>
        </div>
        <button type="button" className="link" onClick={onClose}>닫기</button>
      </div>

      <label className="consent" htmlFor="consent">
        <input id="consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); writeConsent(e.target.checked); }} />
        <span>
          교육과정 선택, 들은 과목(학수번호·과목명·학점·학기·이수구분), 사정표의 영역별 학점을 서버에 저장하는 데 동의합니다.
          {' '}이름·학번·성적·사정표 파일은 저장하지 않으며, 언제든 삭제·탈퇴할 수 있습니다.
        </span>
      </label>

      <div className="login-methods" aria-disabled={!consent}>
        {providers.map((p) => (
          <button key={p} type="button" className={`provider provider-${p}`} disabled={!consent}
            onClick={() => run(() => signInWithProvider(p))}>
            {PROVIDER_LABEL[p]}
          </button>
        ))}
        <form className="email-login" onSubmit={(e) => {
          e.preventDefault();
          run(() => signInWithEmail(email.trim()), `${email.trim()}로 로그인 링크를 보냈습니다. 메일의 링크를 이 브라우저에서 열어 주세요.`);
        }}>
          <label htmlFor="login-email" className="muted">이메일로 로그인 링크 받기</label>
          <div className="toolbar">
            <input id="login-email" type="email" required placeholder="you@khu.ac.kr" value={email}
              onChange={(e) => setEmail(e.target.value)} disabled={!consent} autoComplete="email" />
            <button type="submit" disabled={!consent || !email}>링크 받기</button>
          </div>
        </form>
      </div>
      {message && <p className={message === "처리 중…" ? "muted" : "ok"} role="status">{message}</p>}
      {error && <p className="warn" role="alert">{error}</p>}
    </section>
  );
}
