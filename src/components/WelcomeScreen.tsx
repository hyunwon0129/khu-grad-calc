// 첫 화면: 로그인하거나 게스트로 시작
import type { ReactNode } from 'react';

interface Props {
  login: ReactNode;          // 로그인 폼 (AccountPanel welcome)
  onGuest: () => void;
  hasLocal: boolean;         // 이 기기에 이전 기록이 있는가
}

export default function WelcomeScreen({ login, onGuest, hasLocal }: Props) {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome-intro">
        <h2 id="welcome-title">사정표 한 장으로 졸업까지</h2>
        <p className="muted">
          남은 학점·필수 과목·교양을 한 화면에 정리해요. 파일은 내 기기 안에서만 읽어요.
        </p>
      </div>

      <div className="welcome-grid">
        <div className="welcome-card">
          <h3>로그인</h3>
          <p className="muted small">어느 기기에서든 이어서 봐요</p>
          {login}
        </div>
        <div className="welcome-card welcome-guest">
          <h3>게스트</h3>
          <p className="muted small">
            가입 없이 바로 써요. 기록은 이 기기에만 저장되고, 나중에 계정으로 옮길 수 있어요.
          </p>
          <button type="button" className="primary guest-btn" onClick={onGuest}>
            {hasLocal ? '게스트로 이어하기' : '게스트로 시작하기'}
          </button>
        </div>
      </div>
    </section>
  );
}
