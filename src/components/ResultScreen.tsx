import { useState } from 'react';
import type { Course, Program, TakenCourse } from '../lib/types';
import { calculate } from '../lib/calc';
import { recommendNext, recommendPrograms, trackProgress } from '../lib/recommend';
import ProgressChart from './ProgressChart';

interface Props {
  program: Program;
  programs: Program[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  onEdit: () => void;
  onReimport: () => void;
}

export default function ResultScreen({ program, programs, courseMap, taken, onEdit, onReimport }: Props) {
  const [includeInProgress, setIncludeInProgress] = useState(false);
  const [semestersLeft, setSemestersLeft] = useState(4);

  const result = calculate(program, courseMap, taken, includeInProgress);
  const next = recommendNext(program, courseMap, taken).slice(0, 6);
  const tracks = trackProgress(program, courseMap, taken);
  const others = recommendPrograms(
    programs.filter((p) => p.kind !== 'MAJOR' && p.campus === program.campus),
    courseMap, taken, result.totalRemaining, semestersLeft,
  );
  const uncounted = taken.filter((t) => !courseMap.get(t.code)?.typeByProgram[program.programId]).length;
  const hasPending = result.areas.some((a) => a.pending > 0) || taken.some((t) => t.status === 'IN_PROGRESS');

  return (
    <>
      <section>
        <h2>이수 현황</h2>
        <ProgressChart result={result} showPending={!includeInProgress} />
        <div className="toolbar">
          {hasPending && (
            <label><input id="include-ip" type="checkbox" checked={includeInProgress} onChange={(e) => setIncludeInProgress(e.target.checked)} /> 수강 중 과목도 이수한 것으로 계산</label>
          )}
          <button type="button" className="link" onClick={onEdit}>과목 직접 수정</button>
          <button type="button" className="link" onClick={onReimport}>사정표 다시 불러오기</button>
        </div>
        {uncounted > 0 && <p className="muted">이 교육과정에 속하지 않거나 이수구분이 정해지지 않은 과목 {uncounted}개는 전공 학점에서 제외했습니다.</p>}
      </section>

      <section>
        <h2>다음 학기 추천 과목</h2>
        <ul>
          {next.map((c) => (
            <li key={c.code}>
              <span className={c.available ? 'chip ok-chip' : 'chip'}>{c.available ? '수강 가능' : '선수과목 필요'}</span>
              {c.name} <span className="muted">({c.type} · {c.year}학년 {c.semester}학기 권장)</span>
              {!c.available && <span className="muted"> — {c.missingPrereqs.join(', ')} 먼저</span>}
            </li>
          ))}
          {next.length === 0 && <li className="muted">이 교육과정의 과목을 모두 이수했습니다.</li>}
        </ul>
      </section>

      {tracks.length > 0 && (
        <section>
          <h2>트랙 달성률</h2>
          <ul>
            {tracks.map((t) => (
              <li key={t.name} className="track">
                <span>{t.name}</span>
                <span className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, t.rate * 100)}%` }} /></span>
                <span className="muted">{t.earned}/{t.required}학점</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>다전공·MD 추천</h2>
        <label htmlFor="sem-left">남은 학기</label>{' '}
        <input id="sem-left" type="number" min={1} max={8} value={semestersLeft} className="num" onChange={(e) => setSemestersLeft(Number(e.target.value))} />
        <ul>
          {others.map((o) => (
            <li key={o.program.programId}>
              <strong>{o.program.department}</strong> — {o.reason}
              {!o.feasible && <span className="warn"> · 남은 학기 안에 어려움</span>}
              {o.policyUnknown && <span className="muted"> · 중복 인정 규정은 학교 공지 확인</span>}
            </li>
          ))}
          {others.length === 0 && <li className="muted">추천할 다전공·MD 데이터가 아직 없습니다.</li>}
        </ul>
      </section>
    </>
  );
}
