// 직접 입력: 학과 교육과정 과목을 학년별로 체크 + 다른 학과 과목 검색 + 목록에 없는 과목 추가
import { useState } from 'react';
import type { Course, Program, TakenCourse } from '../lib/types';
import { choiceGroupOf } from '../lib/prereq';

interface Props {
  program: Program;
  majors: Program[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  onChange: (taken: TakenCourse[]) => void;
  onAddCustom: (c: Course) => void;
  onProgram: (id: string) => void;
  onDone: () => void;
}

const CODE_RE = /^[A-Z]{2,6}\d{3,6}$/;

export default function ManualScreen({ program, majors, courseMap, taken, onChange, onAddCustom, onProgram, onDone }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCredit, setNewCredit] = useState(3);
  const [newCategory, setNewCategory] = useState(program.requirements[0]?.category ?? '');
  const [addError, setAddError] = useState('');

  const pid = program.programId;
  const categories = program.requirements.map((r) => r.category);
  const takenCodes = new Set(taken.map((t) => t.code));
  const yearOf = new Map((program.diagram?.nodes ?? []).map((n) => [n.code, n.year]));
  const q = query.trim();
  const matches = (c: Course) => !q || c.name.includes(q.replace(/\s+/g, '')) || c.name.includes(q) || c.code.includes(q.toUpperCase());

  const customCodes = [...courseMap.values()]
    .filter((c) => !program.courses.includes(c.code) && takenCodes.has(c.code))
    .map((c) => c.code);
  const untyped = customCodes.filter((code) => !courseMap.get(code)?.typeByProgram[pid]).length;
  const setType = (c: Course, category: string) => onAddCustom({ ...c, typeByProgram: { ...c.typeByProgram, [pid]: category } });

  const own = program.courses
    .map((code) => courseMap.get(code)!)
    .filter(Boolean)
    .filter((c) => filter === '전체' || c.typeByProgram[pid] === filter)
    .filter(matches);
  // 학년별로 묶는다 (학년 정보가 없으면 '기타')
  const groups = new Map<string, Course[]>();
  for (const c of own) {
    const y = yearOf.get(c.code);
    const key = y ? `${y}학년` : '학년 정보 없음 (타전공 인정 등)';
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const extra = customCodes.map((code) => courseMap.get(code)!).filter(Boolean).filter(matches);
  // 검색어가 있으면 앱에 있는 다른 학과 과목도 찾아 준다
  const others = q.length >= 2
    ? [...courseMap.values()].filter((c) => !program.courses.includes(c.code) && !takenCodes.has(c.code) && !c.code.startsWith('SAMP') && matches(c)).slice(0, 20)
    : [];

  const toggle = (code: string) =>
    onChange(takenCodes.has(code) ? taken.filter((t) => t.code !== code) : [...taken, { code, term: '-', status: 'TAKEN' }]);
  const setAll = (codes: string[], on: boolean) => {
    const set = new Set(codes);
    onChange(on
      ? [...taken, ...codes.filter((c) => !takenCodes.has(c)).map((code) => ({ code, term: '-', status: 'TAKEN' as const }))]
      : taken.filter((t) => !set.has(t.code)));
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!CODE_RE.test(code)) { setAddError('학수번호는 영문 2~6자 + 숫자 3~6자리 형식입니다. 예: ABCD1234'); return; }
    if (newCredit < 0 || newCredit > 6) { setAddError('학점은 0~6 사이로 입력해 주세요.'); return; }
    const existing = courseMap.get(code);
    onAddCustom(existing
      ? { ...existing, typeByProgram: { ...existing.typeByProgram, [pid]: newCategory } }
      : { code, name: newName.trim().slice(0, 40) || '직접 추가한 과목', credit: newCredit, typeByProgram: { [pid]: newCategory }, source: 'manual' });
    if (!takenCodes.has(code)) onChange([...taken, { code, term: '-', status: 'TAKEN' }]);
    setNewCode(''); setNewName(''); setAddError('');
  };

  const row = (c: Course, opts: { showType?: boolean } = {}) => {
    const t = taken.find((x) => x.code === c.code);
    const g = choiceGroupOf(program, c.code);
    return (
      <tr key={c.code} onClick={() => toggle(c.code)} className="clickable">
        <td><input type="checkbox" checked={!!t} readOnly aria-label={`${c.name} 선택`} tabIndex={-1} /></td>
        <td className="code">{c.code}</td>
        <td>
          <button type="button" className="row-toggle" aria-pressed={!!t} onClick={(e) => { e.stopPropagation(); toggle(c.code); }}>
            {c.name}
          </button>
          {t?.status === 'IN_PROGRESS' && <span className="chip">수강 중</span>}
          {g && <span className="muted small"> · 택1</span>}
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          {opts.showType !== false && (c.typeByProgram[pid] ?? (
            <select value="" aria-label={`${c.code} 이수구분`} onChange={(e) => e.target.value && setType(c, e.target.value)}>
              <option value="">지정 필요</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          ))}
        </td>
        <td>{c.credit}</td>
      </tr>
    );
  };

  return (
    <section className="stack">
      <h2>직접 입력</h2>
      <div className="toolbar">
        <label htmlFor="manual-program">학과</label>
        <select id="manual-program" value={pid} onChange={(e) => onProgram(e.target.value)}>
          {[...majors].sort((a, b) => Number(a.programId.startsWith('SAMPLE')) - Number(b.programId.startsWith('SAMPLE')) || a.department.localeCompare(b.department, 'ko') || a.admissionYearRange[0] - b.admissionYearRange[0]).map((p) => (
            <option key={p.programId} value={p.programId}>
              {p.department} · {p.admissionYearRange[0] === p.admissionYearRange[1] ? p.admissionYearRange[0] : `${p.admissionYearRange[0]}~${p.admissionYearRange[1]}`}학번{p.programId.startsWith('SAMPLE') ? ' (샘플)' : p.verified ? '' : ' (일부 과목 확인 중)'}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">
        과목 목록이 있는 학과 {new Set(majors.filter((p) => p.verified).map((p) => p.department)).size}개 (국제캠퍼스 전체·경영학과).
        다른 학과는 졸업사정표를 올리면 학교 집계로 계산됩니다.
      </p>

      <div className="toolbar">
        <input id="search" type="search" placeholder="과목명 또는 학수번호" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="과목 검색" />
        <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="이수구분 필터">
          {['전체', ...categories].map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="muted">{takenCodes.size}과목 선택됨</span>
      </div>
      {untyped > 0 && (
        <p className="warn">이수구분이 정해지지 않은 과목 {untyped}개가 있습니다. 표의 구분 칸에서 지정해야 학점에 반영됩니다.</p>
      )}

      {[...groups.entries()].map(([label, list]) => {
        const codes = list.map((c) => c.code);
        const allOn = codes.every((c) => takenCodes.has(c));
        return (
          <div key={label} className="year-group">
            <div className="year-head">
              <h3>{label}</h3>
              <button type="button" className="link small" onClick={() => setAll(codes, !allOn)}>
                {allOn ? '모두 해제' : '모두 선택'}
              </button>
            </div>
            <div className="table-wrap">
              <table className="manual-table">
                <thead><tr><th></th><th>학수번호</th><th>과목명</th><th>구분</th><th>학점</th></tr></thead>
                <tbody>{list.map((c) => row(c))}</tbody>
              </table>
            </div>
          </div>
        );
      })}
      {own.length === 0 && <p className="muted">이 학과 목록에서 찾은 과목이 없습니다.</p>}

      {extra.length > 0 && (
        <div className="year-group">
          <h3>내가 추가한 과목</h3>
          <div className="table-wrap">
            <table className="manual-table"><tbody>{extra.map((c) => row(c))}</tbody></table>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="year-group">
          <h3>다른 학과 과목 <span className="muted small">체크하면 추가되고, 구분을 정해야 전공 학점에 들어갑니다</span></h3>
          <div className="table-wrap">
            <table className="manual-table"><tbody>{others.map((c) => row(c, { showType: false }))}</tbody></table>
          </div>
        </div>
      )}

      <form className="add-form" onSubmit={add}>
        <strong>목록에 없는 과목 추가</strong>
        <div className="toolbar">
          <input id="new-code" placeholder="학수번호" value={newCode} onChange={(e) => setNewCode(e.target.value)} aria-label="학수번호" />
          <input id="new-name" placeholder="과목명 (선택)" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="과목명" />
          <input id="new-credit" type="number" min={0} max={6} value={newCredit} onChange={(e) => setNewCredit(Number(e.target.value))} className="num" aria-label="학점" />
          <select id="new-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} aria-label="이수구분">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="submit">추가</button>
        </div>
        {addError && <p className="warn" role="alert">{addError}</p>}
      </form>

      <div className="sticky-actions">
        <span className="sticky-count"><strong>{takenCodes.size}</strong>과목 선택</span>
        <button type="button" className="primary" onClick={onDone}>결과 보기</button>
      </div>
    </section>
  );
}
