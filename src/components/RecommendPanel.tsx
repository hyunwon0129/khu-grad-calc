// 다음 학기 추천 과목: 점수(필수·남은 영역·선수과목·학년·개설학기·관심 다전공)로 고른 과목과 이유
import { useMemo, useState } from 'react';
import type { Category, Course, Program, TakenCourse } from '../lib/types';
import { recommendCourses, type ScoredCourse } from '../lib/recommendCourses';
import { termLabel } from '../lib/planner';
import { sameDept } from '../lib/dept';

interface Props {
  program: Program;
  programs: Program[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  nowTerm: string;
  admissionYear: number | null;
  gaps?: Map<Category, number>;
  maxCredits: number;
  onPlan?: (c: ScoredCourse) => void;   // 사정표가 있을 때 '만약에' 계획에 추가
  plannedNames?: Set<string>;
}

const SHOW = 8;

export default function RecommendPanel(p: Props) {
  const [multiId, setMultiId] = useState('');
  const [showAll, setShowAll] = useState(false);

  // 관심 다전공 후보: 과목 목록이 있는 다른 학과 (다전공 과정 우선)
  const multiOptions = useMemo(() => {
    const seen = new Map<string, Program>();
    for (const x of p.programs) {
      if (x.programId.startsWith('SAMPLE') || x.kind === 'MICRO_DEGREE') continue;
      if (sameDept(x.department, p.program.department)) continue;
      const key = `${x.campus}:${x.department}`;
      const cur = seen.get(key);
      if (!cur || (x.kind === 'MULTI_MAJOR' && cur.kind !== 'MULTI_MAJOR') || x.admissionYearRange[0] > cur.admissionYearRange[0]) seen.set(key, x);
    }
    return [...seen.values()].sort((a, b) => a.department.localeCompare(b.department, 'ko'));
  }, [p.programs, p.program.department]);
  const multiProgram = multiOptions.find((x) => x.programId === multiId) ?? null;

  const rec = recommendCourses(p.program, p.courseMap, p.taken, {
    nowTerm: p.nowTerm, admissionYear: p.admissionYear, gaps: p.gaps, multiProgram, maxCredits: p.maxCredits,
  });
  const list = showAll ? rec.ranked.slice(0, 30) : rec.ranked.slice(0, SHOW);

  const row = (c: ScoredCourse, opts: { inBundle?: boolean } = {}) => (
    <li key={c.code} className={`rec-item${opts.inBundle ? ' rec-bundle' : ''}`}>
      <div className="rec-head">
        <span className="chip">{c.type}</span>
        <strong>{c.name}</strong>
        <span className="muted code">{c.code} · {c.credit}학점{c.year ? ` · ${c.year}학년` : ''}</span>
        {p.onPlan && (
          p.plannedNames?.has(c.name)
            ? <span className="muted small">계획에 있음</span>
            : <button type="button" className="link small" onClick={() => p.onPlan!(c)} aria-label={`${c.name} 계획에 추가`}>계획에 추가</button>
        )}
      </div>
      <div className="rec-reasons">
        {c.reasons.map((r) => <span key={r.label} className={`reason reason-${r.kind}`}>{r.label}</span>)}
        {c.choiceWith.length > 0 && <span className="reason">택1: {c.choiceWith.join(', ')}</span>}
      </div>
      {c.missingPrereqs.length > 0 && <p className="muted small">먼저 들을 과목: {c.missingPrereqs.join(', ')}</p>}
    </li>
  );

  return (
    <section className="recommend">
      <h2>다음 학기 추천 과목</h2>
      <p className="muted">
        {termLabel(rec.term)}{rec.studentYear ? ` · ${rec.studentYear}학년 기준` : ''} · {p.program.department} {p.program.admissionYearRange[0]} 교육과정에서
        점수가 높은 순서입니다. 실제 개설 여부와 시간표는 수강편람에서 확인하세요.
      </p>

      <div className="toolbar">
        <label htmlFor="multi-interest">관심 다전공</label>
        <select id="multi-interest" value={multiId} onChange={(e) => setMultiId(e.target.value)}>
          <option value="">선택 안 함</option>
          {multiOptions.map((x) => (
            <option key={x.programId} value={x.programId}>{x.department} ({x.campus === 'SEOUL' ? '서울' : '국제'})</option>
          ))}
        </select>
        <span className="muted small">고르면 그 전공에서도 인정되는 과목을 위로 올립니다</span>
      </div>

      {rec.bundle.length > 0 ? (
        <>
          <h3>추천 묶음 <span className="muted small">전공 {rec.bundleCredits}학점 · 학기당 전공 {p.maxCredits}학점 기준</span></h3>
          <ul className="rec-list">{rec.bundle.map((c) => row(c, { inBundle: true }))}</ul>
        </>
      ) : (
        <p className="ok">다음 학기에 꼭 채워야 할 전공 영역이 없습니다.</p>
      )}

      <details className="rec-more" open={showAll}>
        <summary onClick={(e) => { e.preventDefault(); setShowAll((v) => !v); }}>
          {showAll ? '접기' : `점수순 전체 보기 (${rec.ranked.length}과목)`}
        </summary>
        <ul className="rec-list">{list.map((c) => row(c))}</ul>
      </details>

      {rec.blocked.length > 0 && (
        <details className="rec-more">
          <summary>선수과목을 먼저 들어야 하는 과목 {rec.blocked.length}개</summary>
          <ul className="rec-list">{rec.blocked.slice(0, 10).map((c) => row(c))}</ul>
        </details>
      )}

      <details className="rec-more">
        <summary>추천 기준</summary>
        <ul className="muted small">
          <li>전공필수, 그리고 전부 들어야 하는 전공기초: +40</li>
          <li>아직 학점이 남은 영역: +10~25 (남은 비율이 클수록), 이미 채운 영역: −15</li>
          <li>다른 과목의 선수과목: 과목당 +6 (최대 +18)</li>
          <li>권장 학년이 지금 학년이면 +10, 이미 지났으면 +15, 2학년 이상 이르면 학년마다 −6</li>
          <li>다음 학기 개설 +8, 다음 학기 미개설 −20</li>
          <li>관심 다전공에서도 인정: +8</li>
          <li>선수과목을 안 들은 과목은 따로 모으고, 택1 과목은 하나만 추천합니다.</li>
        </ul>
      </details>
    </section>
  );
}
