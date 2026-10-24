// 직접 입력: 과목 목록 체크 + 목록에 없는 과목 추가
import { useState } from 'react';
import type { Course, Program, TakenCourse } from '../lib/types';

interface Props {
  program: Program;
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  onChange: (taken: TakenCourse[]) => void;
  onAddCustom: (c: Course) => void;
  onDone: () => void;
}

const CODE_RE = /^[A-Z]{2,6}\d{3,6}$/;

export default function ManualScreen({ program, courseMap, taken, onChange, onAddCustom, onDone }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [newCode, setNewCode] = useState('');
  const [newCredit, setNewCredit] = useState(3);
  const [newCategory, setNewCategory] = useState(program.requirements[0]?.category ?? '');
  const [addError, setAddError] = useState('');

  const categories = program.requirements.map((r) => r.category);
  const takenCodes = new Set(taken.map((t) => t.code));
  const customCodes = [...courseMap.values()]
    .filter((c) => !program.courses.includes(c.code) && c.typeByProgram[program.programId])
    .map((c) => c.code);
  const list = [...program.courses, ...customCodes]
    .map((code) => courseMap.get(code)!)
    .filter(Boolean)
    .filter((c) => filter === '전체' || c.typeByProgram[program.programId] === filter)
    .filter((c) => !query || c.name.includes(query) || c.code.includes(query.toUpperCase()));

  const toggle = (code: string) =>
    onChange(
      takenCodes.has(code)
        ? taken.filter((t) => t.code !== code)
        : [...taken, { code, term: '-', status: 'TAKEN' }],
    );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!CODE_RE.test(code)) { setAddError('학수번호는 영문 2~6자 + 숫자 3~6자리 형식입니다. 예: ABCD1234'); return; }
    if (newCredit < 0 || newCredit > 6) { setAddError('학점은 0~6 사이로 입력해 주세요.'); return; }
    const existing = courseMap.get(code);
    onAddCustom(existing
      ? { ...existing, typeByProgram: { ...existing.typeByProgram, [program.programId]: newCategory } }
      : { code, name: '직접 추가한 과목', credit: newCredit, typeByProgram: { [program.programId]: newCategory } });
    if (!takenCodes.has(code)) onChange([...taken, { code, term: '-', status: 'TAKEN' }]);
    setNewCode(''); setAddError('');
  };

  return (
    <section className="stack">
      <h2>직접 입력</h2>
      <div className="toolbar">
        <input id="search" type="search" placeholder="과목명 또는 학수번호" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="과목 검색" />
        <select id="filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="이수구분 필터">
          {['전체', ...categories].map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="muted">{takenCodes.size}과목 선택됨</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th></th><th>학수번호</th><th>과목명</th><th>구분</th><th>학점</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const t = taken.find((x) => x.code === c.code);
              return (
                <tr key={c.code} onClick={() => toggle(c.code)} className="clickable">
                  <td><input type="checkbox" checked={!!t} readOnly aria-label={`${c.name} 선택`} /></td>
                  <td className="code">{c.code}</td>
                  <td>{c.name}{t?.status === 'IN_PROGRESS' && <span className="chip">수강 중</span>}</td>
                  <td>{c.typeByProgram[program.programId]}</td>
                  <td>{c.credit}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="muted">검색 결과가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <form className="add-form" onSubmit={add}>
        <strong>목록에 없는 과목 추가</strong>
        <div className="toolbar">
          <input id="new-code" placeholder="학수번호" value={newCode} onChange={(e) => setNewCode(e.target.value)} aria-label="학수번호" />
          <input id="new-credit" type="number" min={0} max={6} value={newCredit} onChange={(e) => setNewCredit(Number(e.target.value))} className="num" aria-label="학점" />
          <select id="new-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} aria-label="이수구분">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="submit">추가</button>
        </div>
        {addError && <p className="warn" role="alert">{addError}</p>}
      </form>

      <div className="actions">
        <button type="button" className="primary" onClick={onDone}>결과 보기</button>
      </div>
    </section>
  );
}
