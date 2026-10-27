// 다전공·마이크로디그리 추천
// 모든 학과의 다전공 학점은 2026 학사제도안내 기본구조표, 겹치는 과목은 과목 목록이 있는 학과만 계산한다.
import { useMemo, useState } from 'react';
import type { Course, DepartmentInfo, Program, TakenCourse } from '../lib/types';
import { recommendMd, recommendMulti, ownMajorShift, type Student } from '../lib/multi';
import { capacity, type CreditLimit } from '../lib/creditLimit';

interface Props {
  departments: DepartmentInfo[];
  programs: Program[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  student: Student;
  nowTerm: string;
  initialSemesters: number;
  limit: CreditLimit | null;
  mustRemaining: number;   // 남은 학기에 꼭 채워야 하는 영역 학점 (전공·교양 영역 남은 학점)
  freeRemaining: number;   // 졸업학점 중 영역 지정 없이 남은 학점 (다전공 과목으로 채우면 추가 부담 없음)
}

const CAMPUS = { SEOUL: '서울', INTL: '국제' } as const;
const SHOW = 6;

export default function MultiPanel(p: Props) {
  const [semesters, setSemesters] = useState(p.initialSemesters);
  const [query, setQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState<'ALL' | 'SEOUL' | 'INTL'>('ALL');
  const [showAll, setShowAll] = useState(false);

  const cap = p.limit ? capacity(p.limit, p.nowTerm, semesters) : semesters * 18;
  const room = Math.max(0, cap - p.mustRemaining);
  const all = useMemo(
    () => recommendMulti(p.departments, p.programs, p.courseMap, p.taken, p.student, room),
    [p.departments, p.programs, p.courseMap, p.taken, p.student, room],
  );
  const mds = recommendMd(p.programs, p.courseMap, p.taken, p.student.campus);
  const shift = ownMajorShift(p.departments, p.student);

  const q = query.replace(/\s+/g, '');
  const filtered = all.filter(
    (c) => (campusFilter === 'ALL' || c.dept.campus === campusFilter) && (!q || c.dept.name.includes(q) || c.dept.college.includes(q)),
  );
  const visible = showAll || q ? filtered : filtered.slice(0, SHOW);

  return (
    <section className="multi">
      <h2>다전공·마이크로디그리</h2>

      <div className="toolbar">
        <label htmlFor="sem-left">남은 학기</label>
        <input id="sem-left" type="number" min={1} max={8} value={semesters} className="num"
          onChange={(e) => setSemesters(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
        <span className="muted">
          {p.limit ? `수강허용 1학기 ${p.limit.first}·2학기 ${p.limit.second}학점 기준` : '학기당 18학점 기준'} · 남은 학기 최대 {cap}학점
        </span>
      </div>

      <ul className="facts">
        <li>꼭 채울 영역 학점 <strong>{p.mustRemaining}</strong></li>
        <li>다전공에 쓸 수 있는 여유 <strong>{room}</strong>학점</li>
        {p.freeRemaining > 0 && <li>그중 졸업학점 안에서 추가 부담 없이 <strong>{Math.min(room, p.freeRemaining)}</strong>학점</li>}
      </ul>
      {shift && shift.multi < shift.single && (
        <p className="notice">
          <span>
            <strong>다전공을 하면 내 전공 기준이 줄어듭니다</strong> · 단일전공 {shift.single}학점 → 다전공 {shift.multi}학점 (2026 기본구조표).
            줄어든 만큼을 두 번째 전공에 쓸 수 있어요.
          </span>
        </p>
      )}

      <div className="toolbar">
        <input type="search" placeholder="전공·단과대학 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="다전공 검색" />
        <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value as typeof campusFilter)} aria-label="캠퍼스">
          <option value="ALL">두 캠퍼스</option>
          <option value="SEOUL">서울캠퍼스</option>
          <option value="INTL">국제캠퍼스</option>
        </select>
        <span className="muted">{filtered.length}개 전공</span>
      </div>

      <p className="muted small">
        겹치는 과목은 과목 목록이 있는 학과({new Set(p.programs.filter((x) => x.kind !== 'MICRO_DEGREE' && !x.programId.startsWith('SAMPLE')).map((x) => x.department)).size}개, 국제캠퍼스 전체·경영학과)만 계산합니다.
        나머지는 다전공 기준 학점만 보여 줍니다.
      </p>
      <ul className="multi-list">
        {visible.map((c) => (
          <li key={`${c.dept.campus}-${c.dept.name}`} className="multi-item">
            <div className="multi-head">
              <strong>{c.dept.name}</strong>
              <span className="muted">{CAMPUS[c.dept.campus]} · {c.dept.college}</span>
              {c.otherCampus && <span className="chip">다른 캠퍼스</span>}
              {c.feasible === false && <span className="chip warn-chip">남은 학기 안에 빠듯</span>}
            </div>
            <div className="multi-body">
              <span>다전공 <strong>{c.required.계}</strong>학점 <span className="muted">(기초 {c.required.기초} · 필수 {c.required.필수} · 선택 {c.required.선택})</span></span>
              {c.overlap.계 > 0 && <span className="ok">이미 {c.overlap.계}학점 인정 → <strong>{c.needed}학점</strong> 더</span>}
            </div>
            {c.overlapCourses.length > 0 && (
              <p className="muted small">겹치는 과목: {c.overlapCourses.slice(0, 6).join(', ')}{c.overlapCourses.length > 6 ? ` 외 ${c.overlapCourses.length - 6}개` : ''}</p>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="muted">조건에 맞는 전공이 없습니다.</li>}
      </ul>
      {!showAll && !q && filtered.length > SHOW && (
        <button type="button" className="link" onClick={() => setShowAll(true)}>전체 {filtered.length}개 보기</button>
      )}

      <details className="multi-rules">
        <summary>다전공 규정 요약</summary>
        <ul>
          <li>2학기 이상 등록한 재학생이 신청하고, 선발되면 다음 학기부터 수강합니다(편입생은 1학기 이상).</li>
          <li>두 전공에 함께 개설된 과목은 양쪽 다전공 학점으로 인정되지만, 졸업학점에는 한 번만 들어갑니다.</li>
          <li>같은 단과대학에서 전공기초가 같은 두 전공은 전공기초를 한 번만 이수하면 됩니다.</li>
          <li>의·약학, 간호, 서울캠퍼스 예·체능, 자율전공학부 등은 다전공이 금지되어 목록에서 뺐습니다.</li>
          <li>학점 기준은 2026학년도 표입니다. 내 학번 기준은 해당 학과 시행세칙에서 확인하세요.</li>
        </ul>
        <p className="muted">근거: 2026 학사제도안내 38~43쪽</p>
      </details>

      <h3>마이크로디그리 <span className="muted small">1인당 최대 3개 · 전공·교양 학점과 중복 인정</span></h3>
      <ul className="multi-list">
        {mds.map((m) => (
          <li key={m.program.programId} className="multi-item">
            <div className="multi-head">
              <strong>{m.program.department}</strong>
              <span className="muted">{CAMPUS[m.program.campus]} · {m.program.college}</span>
              {m.otherCampus && <span className="chip">다른 캠퍼스</span>}
            </div>
            <div className="multi-body">
              <span>{m.program.note}</span>
              {m.earned > 0 ? <span className="ok">{m.earned}학점 이수 → <strong>{m.needed}학점</strong> 더</span> : <span>{m.needed}학점</span>}
            </div>
            {m.takenNames.length > 0 && <p className="muted small">들은 과목: {m.takenNames.join(', ')}</p>}
          </li>
        ))}
        {mds.length === 0 && <li className="muted">마이크로디그리 데이터가 아직 없습니다.</li>}
      </ul>
      <p className="muted small">마이크로디그리는 학과 시행세칙에 공개된 과정만 넣었습니다(현재 경영학과 3개). 신청은 2학기 이상 이수한 재학생부터 가능합니다.</p>
    </section>
  );
}
