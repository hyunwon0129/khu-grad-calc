import { useState } from 'react';
import type { Program } from '../lib/types';
import type { Step } from '../App';

interface Props {
  majors: Program[];
  programId: string;
  savedCount: number;
  savedAt: string | null;
  synced?: boolean;
  onProgram: (id: string) => void;
  onChoose: (step: Step) => void;
  onSample: () => void;
  onClear: () => void;
}

export default function StartScreen({ majors, programId, savedCount, savedAt, synced = false, onProgram, onChoose, onSample, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {savedCount > 0 && (
        <section className="resume">
          <div>
            <strong>이 기기에 과목 {savedCount}개가 있어요</strong>
            {savedAt && <span className="muted"> · {savedAt} 저장</span>}
          </div>
          <div className="actions">
            <button type="button" className="primary" onClick={() => onChoose('result')}>이어서 보기</button>
            {!confirming ? (
              <button type="button" className="link" onClick={() => setConfirming(true)}>내 데이터 모두 삭제</button>
            ) : (
              <span className="confirm">
                <span>{synced ? '이 기기와 계정에 저장된 과목과 계획을 모두 지울까요?' : '이 기기에 저장된 과목과 계획을 모두 지울까요?'}</span>
                <button type="button" onClick={() => { onClear(); setConfirming(false); }}>삭제</button>
                <button type="button" className="link" onClick={() => setConfirming(false)}>취소</button>
              </span>
            )}
          </div>
        </section>
      )}

      <section className="hero">
        <p className="hero-lead">졸업사정표 PDF 한 장으로<br />남은 학점을 확인하세요</p>
        <ul className="hero-points">
          <li>학교 집계 그대로 · 모든 학과·학번</li>
          <li>영어강의·논문 등 학점 밖 요건까지</li>
          <li>파일은 내 기기 안에서만 처리</li>
        </ul>
        <div className="hero-actions">
          <button type="button" className="primary big" onClick={() => onChoose('import')}>졸업사정표 올리기</button>
          <button type="button" className="link" onClick={onSample}>예시로 보기</button>
        </div>
      </section>

      <section>
        <h2>사정표 PDF 받는 법</h2>
        <ol className="step-cards">
          <li><span className="step-num" aria-hidden="true">1</span><strong>인포21 로그인</strong><span className="muted">PC 브라우저 권장</span></li>
          <li><span className="step-num" aria-hidden="true">2</span><strong>졸업사정표 조회</strong><span className="muted">메뉴 이름은 다를 수 있어요</span></li>
          <li><span className="step-num" aria-hidden="true">3</span><strong>인쇄 → PDF로 저장</strong><span className="muted">사진·캡처는 읽을 수 없어요</span></li>
        </ol>
      </section>

      <section className="other-ways">
        <h2>다른 방법</h2>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onChoose('manual')}>
            <strong>과목을 직접 입력</strong>
            <span>사정표가 없을 때 과목을 직접 골라요</span>
          </button>
        </div>
        <details className="program-pick">
          <summary>학과 교육과정 직접 고르기</summary>
          <label htmlFor="program">학과·학번</label>{' '}
          <select id="program" value={programId} onChange={(e) => onProgram(e.target.value)}>
            {[...majors].sort((a, b) => Number(a.programId.startsWith('SAMPLE')) - Number(b.programId.startsWith('SAMPLE')) || a.department.localeCompare(b.department, 'ko') || a.admissionYearRange[0] - b.admissionYearRange[0]).map((p) => (
              <option key={p.programId} value={p.programId}>
                {p.department} ({p.admissionYearRange[0] === p.admissionYearRange[1] ? p.admissionYearRange[0] : `${p.admissionYearRange[0]}~${p.admissionYearRange[1]}`}학번){p.programId.startsWith('SAMPLE') ? ' · 시험용 샘플' : p.verified ? '' : ' · 일부 과목 확인 중'}
              </option>
            ))}
          </select>
          <p className="muted">
            사정표를 올리면 학과가 자동으로 골라져요. 과목 목록이 있는 학과는 {new Set(majors.filter((p) => p.verified).map((p) => p.department)).size}개예요(2026 교육과정).
            다른 학과도 사정표만 있으면 남은 학점·요건을 볼 수 있어요.
          </p>
          {savedCount > 0 && <p className="muted">학과를 바꾸면 입력한 과목이 지워져요.</p>}
        </details>
      </section>
    </>
  );
}
