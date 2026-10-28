import { useState } from 'react';
import type { Program } from '../lib/types';
import type { Step } from '../App';
import { DEMO_STAGES, demoPrograms } from '../lib/demoReport';

interface Props {
  majors: Program[];
  programId: string;
  savedCount: number;
  savedAt: string | null;
  synced?: boolean;
  onProgram: (id: string) => void;
  onChoose: (step: Step) => void;
  onSample: () => void;
  onDemo: (programId: string, stageId: string) => void;
  onClear: () => void;
}

export default function StartScreen({ majors, programId, savedCount, savedAt, synced = false, onChoose, onSample, onDemo, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  // 실제 학과를 먼저, 시험용 샘플은 맨 뒤
  const demoList = demoPrograms(majors);
  const current = majors.find((p) => p.programId === programId);
  const [pick, setPick] = useState(() => (demoList.find((p) => p.department === current?.department) ?? demoList.find((p) => p.department === '산업경영공학과') ?? demoList[0])?.programId ?? '');
  const [stage, setStage] = useState('y3');

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

      <section className="program-quick card-lite" aria-labelledby="program-quick-title">
        <h2 id="program-quick-title">학과 골라 체험하기</h2>
        <p className="muted small">사정표가 없어도 학과·학년을 고르면, 실제 사정표를 올렸을 때와 같은 결과 화면을 가상 기록으로 보여 줘요</p>
        <form className="program-quick-row" onSubmit={(e) => { e.preventDefault(); onDemo(pick, stage); }}>
          <label className="field" htmlFor="program">학과
            <select id="program" value={pick} onChange={(e) => setPick(e.target.value)}>
              {demoList.map((p) => (
                <option key={p.programId} value={p.programId}>{p.department} ({p.campus === 'SEOUL' ? '서울' : '국제'}){p.verified ? '' : ' · 일부 과목 확인 중'}</option>
              ))}
            </select>
          </label>
          <label className="field field-narrow" htmlFor="program-stage">학년
            <select id="program-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              {DEMO_STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
          </label>
          <button type="submit" className="primary">확인</button>
        </form>
        {savedCount > 0 && <p className="warn small">체험하면 이 기기에 입력한 과목이 체험용 기록으로 바뀌어요</p>}
        <p className="muted small">과목 목록이 있는 {demoList.length}개 학과 · 실제 학생 기록이 아닌 예시예요</p>
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
      </section>
    </>
  );
}
