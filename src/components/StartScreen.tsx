import { useState } from 'react';
import type { Program } from '../lib/types';
import type { Step } from '../App';

interface Props {
  majors: Program[];
  programId: string;
  savedCount: number;
  savedAt: string | null;
  onProgram: (id: string) => void;
  onChoose: (step: Step) => void;
  onClear: () => void;
}

export default function StartScreen({ majors, programId, savedCount, savedAt, onProgram, onChoose, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {savedCount > 0 && (
        <section className="resume">
          <div>
            <strong>입력해 둔 과목 {savedCount}개가 이 기기에 있습니다</strong>
            {savedAt && <span className="muted"> · {savedAt} 저장</span>}
          </div>
          <div className="actions">
            <button type="button" className="primary" onClick={() => onChoose('result')}>이어서 보기</button>
            {!confirming ? (
              <button type="button" className="link" onClick={() => setConfirming(true)}>내 데이터 모두 삭제</button>
            ) : (
              <span className="confirm">
                <span>이 기기에 저장된 과목과 계획을 모두 지울까요?</span>
                <button type="button" onClick={() => { onClear(); setConfirming(false); }}>삭제</button>
                <button type="button" className="link" onClick={() => setConfirming(false)}>취소</button>
              </span>
            )}
          </div>
        </section>
      )}

      <section>
        <h2>1. 내 교육과정</h2>
        <label htmlFor="program">학과·학번</label>{' '}
        <select id="program" value={programId} onChange={(e) => onProgram(e.target.value)}>
          {majors.map((p) => (
            <option key={p.programId} value={p.programId}>
              {p.department} ({p.admissionYearRange[0]}학번){p.verified ? '' : ' · 검증 중'}
            </option>
          ))}
        </select>
        {savedCount > 0 && <p className="muted">학과를 바꾸면 입력한 과목이 초기화됩니다.</p>}
      </section>

      <section>
        <h2>2. 이수 과목 입력 방식</h2>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onChoose('import')}>
            <strong>졸업사정표로 자동 입력</strong>
            <span>학사정보시스템에서 받은 졸업사정표 PDF를 올리면 들은 과목을 읽어옵니다. 읽은 결과는 반영 전에 확인·수정할 수 있습니다.</span>
          </button>
          <button type="button" className="choice" onClick={() => onChoose('manual')}>
            <strong>직접 입력</strong>
            <span>과목 목록에서 들은 과목을 체크합니다. 목록에 없는 과목은 학수번호로 추가할 수 있습니다.</span>
          </button>
        </div>
      </section>

      <section className="features">
        <h2>결과 화면에서 볼 수 있는 것</h2>
        <ul>
          <li>영역별 이수 현황과 남은 학점</li>
          <li>아직 안 들은 전공필수 과목</li>
          <li>졸업까지 학기별 로드맵과 예상 충족 학기</li>
          <li>다전공·마이크로디그리 추천과 근거</li>
          <li>상담 때 붙여넣을 요약</li>
        </ul>
        <p className="muted">입력한 과목은 이 기기 브라우저에만 저장됩니다. 이름·학번·사정표 파일은 저장하지 않습니다.</p>
      </section>
    </>
  );
}
