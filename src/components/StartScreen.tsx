import type { Program } from '../lib/types';
import type { Step } from '../App';

interface Props {
  majors: Program[];
  programId: string;
  hasData: boolean;
  onProgram: (id: string) => void;
  onChoose: (step: Step) => void;
}

export default function StartScreen({ majors, programId, hasData, onProgram, onChoose }: Props) {
  return (
    <>
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
      </section>

      <section>
        <h2>2. 이수 과목 입력 방식</h2>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onChoose('import')}>
            <strong>졸업사정표로 자동 입력</strong>
            <span>학사정보시스템에서 받은 졸업사정표 PDF를 올리면 들은 과목을 읽어옵니다. 읽은 결과는 저장 전에 확인·수정할 수 있습니다.</span>
          </button>
          <button type="button" className="choice" onClick={() => onChoose('manual')}>
            <strong>직접 입력</strong>
            <span>과목 목록에서 들은 과목을 체크합니다. 목록에 없는 과목은 학수번호로 추가할 수 있습니다.</span>
          </button>
        </div>
        {hasData && (
          <p>
            <button type="button" className="link" onClick={() => onChoose('result')}>입력한 내용으로 결과 보기 →</button>
          </p>
        )}
      </section>
    </>
  );
}
