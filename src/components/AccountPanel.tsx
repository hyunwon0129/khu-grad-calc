// 계정 영역: 로그인 전에는 동의 + 로그인 방법, 로그인 후에는 동기화 상태와 계정 관리
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  deleteAccount, deleteCloud, enabledProviders, friendlyError, providers, setLocalOwner, signInWithEmail, signInWithProvider, signOut, type Provider,
} from '../lib/cloud';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'waiting';

interface Props {
  session: Session | null;
  status: SyncStatus;
  lastSynced: Date | null;
  onClose: () => void;
  onClearLocal: () => void;   // 이 기기 기록 지우기 (공용 PC에서 로그아웃할 때)
  variant?: 'panel' | 'welcome'; // welcome: 첫 화면에 넣을 때 (닫기 없음)
}

/** 메일 주소 도메인으로 메일함 바로가기 (최근 1시간 메일, 스팸함 포함) */
export function mailboxFor(email: string): { name: string; url: string } | null {
  const d = email.split('@')[1]?.toLowerCase() ?? '';
  if (d === 'gmail.com' || d === 'googlemail.com') return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+newer_than%3A1h' };
  if (d === 'naver.com') return { name: '네이버 메일', url: 'https://mail.naver.com/' };
  if (d === 'daum.net' || d === 'hanmail.net' || d === 'kakao.com') return { name: '다음 메일', url: 'https://mail.daum.net/' };
  if (/^(outlook|hotmail|live)\./.test(d)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/' };
  if (d === 'icloud.com' || d === 'me.com') return { name: 'iCloud 메일', url: 'https://www.icloud.com/mail' };
  return null;
}

/** Google 로그인 버튼용 G 표시 (Google 브랜드 가이드의 4색 G) */
function GoogleMark() {
  return (
    <svg className="g-mark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

const PROVIDER_LABEL: Record<Provider, string> = { kakao: '카카오로 로그인', google: 'Google 계정으로 로그인' };
const CONSENT_KEY = 'khu-grad-calc:consent';

function readConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
}
function writeConsent(v: boolean) {
  try { if (v) localStorage.setItem(CONSENT_KEY, '1'); else localStorage.removeItem(CONSENT_KEY); } catch { /* 무시 */ }
}

export default function AccountPanel({ session, status, lastSynced, onClose, onClearLocal, variant = 'panel' }: Props) {
  const [clearOnLogout, setClearOnLogout] = useState(false);
  const [consent, setConsent] = useState(readConsent);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [socials, setSocials] = useState<Provider[]>(providers);
  useEffect(() => { if (!session) enabledProviders().then(setSocials); }, [session]);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'none' | 'data' | 'account'>('none');

  const run = async (fn: () => Promise<void>, done?: string) => {
    setError(''); setMessage('처리 중…');
    try { await fn(); setMessage(done ?? ''); }
    catch (e) { setMessage(''); setError(friendlyError(e)); }
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
            <button type="button" onClick={() => run(async () => {
              await signOut();
              setLocalOwner(null);
              if (clearOnLogout) onClearLocal();
            })}>로그아웃</button>
            <button type="button" className="link" onClick={onClose}>닫기</button>
          </div>
        </div>

        <label className="consent small" htmlFor="clear-on-logout">
          <input id="clear-on-logout" type="checkbox" checked={clearOnLogout} onChange={(e) => setClearOnLogout(e.target.checked)} />
          <span>로그아웃할 때 이 기기의 기록도 지우기 (공용 PC)</span>
        </label>

        <details>
          <summary>계정·데이터 관리</summary>
          <div className="stack">
            <p className="muted">서버에는 교육과정 선택, 들은 과목(학수번호·과목명·학점·학기·이수구분), 사정표의 학과·입학연도·영역별 학점·요건 충족 여부, 계획·교양 설정만 저장됩니다. 이름·학번·성적·사정표 파일은 저장하지 않습니다. 로그인용 이메일은 인증 서비스에 보관됩니다.</p>
            {confirm === 'none' && (
              <div className="actions">
                <button type="button" className="link" onClick={() => setConfirm('data')}>서버에 저장된 내 데이터 삭제</button>
                <button type="button" className="link" onClick={() => setConfirm('account')}>회원 탈퇴</button>
              </div>
            )}
            {confirm === 'data' && (
              <div className="confirm">
                <span>서버의 과목 기록을 지웁니다. 이 기기에 있는 기록은 남습니다.</span>
                <button type="button" onClick={() => run(async () => { await deleteCloud(session.user.id); setConfirm('none'); }, '서버 데이터를 삭제했습니다.')}>삭제</button>
                <button type="button" className="link" onClick={() => setConfirm('none')}>취소</button>
              </div>
            )}
            {confirm === 'account' && (
              <div className="confirm">
                <span>계정과 서버 데이터를 모두 지웁니다. 되돌릴 수 없습니다.</span>
                <button type="button" onClick={() => run(async () => { await deleteAccount(); writeConsent(false); setLocalOwner(null); setConfirm('none'); }, '탈퇴 처리했습니다.')}>탈퇴</button>
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
    <section className={variant === 'welcome' ? 'account account-welcome' : 'account'} aria-label="로그인">
      {variant === 'panel' && (
        <div className="account-row">
          <div>
            <strong>로그인하고 다른 기기에서 이어보기</strong>
            <div className="muted">로그인하지 않아도 모든 기능을 쓸 수 있습니다.</div>
          </div>
          <button type="button" className="link" onClick={onClose}>닫기</button>
        </div>
      )}

      <label className="consent" htmlFor="consent">
        <input id="consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); writeConsent(e.target.checked); }} />
        <span>
          교육과정 선택, 들은 과목(학수번호·과목명·학점·학기·이수구분), 사정표의 학과·입학연도·영역별 학점·요건 충족 여부를 서버에 저장하는 데 동의합니다.
          {' '}이름·학번·성적·사정표 파일은 저장하지 않으며, 언제든 삭제·탈퇴할 수 있습니다.
        </span>
      </label>

      <div className="login-methods" aria-disabled={!consent}>
        {socials.map((p) => (
          <button key={p} type="button" className={`provider provider-${p}`} disabled={!consent}
            onClick={() => run(() => signInWithProvider(p))}>
            {p === 'google' && <GoogleMark />}{PROVIDER_LABEL[p]}
          </button>
        ))}
        {socials.length > 0 && <p className="or-line muted small"><span>또는 이메일로</span></p>}
        <form className="email-login" onSubmit={(e) => {
          e.preventDefault();
          const to = email.trim();
          setSentTo('');
          run(async () => { await signInWithEmail(to); setSentTo(to); }, `${to}로 로그인 링크를 보냈어요. 메일의 링크를 이 브라우저에서 눌러 주세요.`);
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
      {sentTo && mailboxFor(sentTo) && (
        <a className="button-like mailbox-btn" href={mailboxFor(sentTo)!.url} target="_blank" rel="noopener noreferrer">
          {mailboxFor(sentTo)!.name} 열기 ↗
        </a>
      )}
      {sentTo && <p className="muted small">메일이 안 보이면 스팸함도 확인해 주세요. 링크는 1시간 동안 쓸 수 있어요.</p>}
      
      {error && <p className="warn" role="alert">{error}</p>}
    </section>
  );
}
