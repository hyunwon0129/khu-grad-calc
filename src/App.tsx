// 최소 동작 화면: 과목 체크 → 영역별 현황 → 추천. 디자인은 이후 단계에서 교체.
import { useMemo, useState } from 'react';
import coursesData from './data/courses.json';
import programsData from './data/programs.json';
import type { Course, Program, TakenCourse } from './lib/types';
import { calculate } from './lib/calc';
import { recommendNext, recommendPrograms } from './lib/recommend';
import './App.css';

const courses = coursesData as Course[];
const programs = programsData as Program[];
const courseMap = new Map(courses.map((c) => [c.code, c]));

export default function App() {
  const majors = programs.filter((p) => p.kind === 'MAJOR');
  const [programId, setProgramId] = useState(majors[0]?.programId ?? '');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [semestersLeft, setSemestersLeft] = useState(4);

  const program = majors.find((p) => p.programId === programId);
  const taken: TakenCourse[] = useMemo(
    () => [...checked].map((code) => ({ code, term: '-', status: 'TAKEN' as const })),
    [checked],
  );

  if (!program) return <p>교육과정 데이터가 없습니다.</p>;

  const result = calculate(program, courseMap, taken);
  const next = recommendNext(program, courseMap, taken).slice(0, 5);
  const others = recommendPrograms(
    programs.filter((p) => p.kind !== 'MAJOR'),
    courseMap,
    taken,
    result.totalRemaining,
    semestersLeft,
  );

  const toggle = (code: string) =>
    setChecked((prev) => {
      const s = new Set(prev);
      if (s.has(code)) s.delete(code);
      else s.add(code);
      return s;
    });

  return (
    <main>
      <header>
        <h1>졸업요건 계산기</h1>
        <p className="muted">비공식 서비스 · 입력 정보는 이 브라우저 밖으로 전송되지 않습니다</p>
      </header>

      <section>
        <label>
          교육과정{' '}
          <select value={programId} onChange={(e) => { setProgramId(e.target.value); setChecked(new Set()); }}>
            {majors.map((p) => (
              <option key={p.programId} value={p.programId}>
                {p.department} ({p.admissionYearRange[0]}학번){p.verified ? '' : ' · 검증 중'}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2>이수 현황</h2>
        <table>
          <thead><tr><th>영역</th><th>취득</th><th>기준</th><th>잔여</th></tr></thead>
          <tbody>
            {result.areas.map((a) => (
              <tr key={a.category}>
                <td>{a.category}</td><td>{a.earned}</td><td>{a.required}</td>
                <td className={a.remaining ? 'warn' : 'ok'}>{a.remaining}</td>
              </tr>
            ))}
            <tr className="total">
              <td>합계</td><td>{result.totalEarned}</td><td>{result.totalRequired}</td><td>{result.totalRemaining}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>들은 과목 체크</h2>
        <table>
          <thead><tr><th></th><th>학수번호</th><th>과목명</th><th>구분</th><th>학점</th></tr></thead>
          <tbody>
            {program.courses.map((code) => {
              const c = courseMap.get(code)!;
              return (
                <tr key={code} onClick={() => toggle(code)} className="clickable">
                  <td><input type="checkbox" checked={checked.has(code)} readOnly /></td>
                  <td>{code}</td><td>{c.name}</td><td>{c.typeByProgram[program.programId]}</td><td>{c.credit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>다음 학기 추천 과목</h2>
        <ul>
          {next.map((c) => (
            <li key={c.code}>
              {c.available ? '✓ 지금 수강 가능' : '× 선수과목 필요'} · {c.name} ({c.type}, {c.year}학년 {c.semester}학기)
              {!c.available && <span className="muted"> — {c.missingPrereqs.join(', ')} 먼저</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>다전공·MD 추천</h2>
        <label>
          남은 학기{' '}
          <input type="number" min={1} max={8} value={semestersLeft} onChange={(e) => setSemestersLeft(Number(e.target.value))} />
        </label>
        <ul>
          {others.map((o) => (
            <li key={o.program.programId}>
              <strong>{o.program.department}</strong> — {o.reason}
              {!o.feasible && <span className="warn"> · 남은 학기 안에 어려움</span>}
              {o.policyUnknown && <span className="muted"> · 중복 인정 규정은 학교 공지 확인</span>}
            </li>
          ))}
        </ul>
      </section>

      <footer className="muted">참고용이며 최종 졸업 여부는 학교 학사 시스템 기준입니다.</footer>
    </main>
  );
}
