// 교양(후마니타스칼리지): 필수교과·배분이수·자유이수, 면제·대체 기준, 더 들어야 할 과목
import { useState } from 'react';
import liberalData from '../data/liberal.json';
import type { Course, DepartmentInfo, TakenCourse } from '../lib/types';
import { analyzeLiberal, liberalTodo, meetsEnglishScore, type ItemState, type LiberalData, type LiberalOptions, type StudentType } from '../lib/liberal';
import type { ReportData } from '../lib/reportLayout';
import type { AreaView } from './SchoolProgress';
import { nextTerm, termLabel } from '../lib/planner';

const data = liberalData as unknown as LiberalData;

interface Props {
  taken: TakenCourse[];
  courseMap: Map<string, Course>;
  report?: ReportData | null;
  views: AreaView[];
  nowTerm: string;
  admissionYear: number | null;
  dept?: DepartmentInfo | null;
  options: LiberalOptions;
  onOptions: (o: LiberalOptions) => void;
}

const MARK: Record<ItemState, string> = { done: '✓', ongoing: '…', todo: '!', exempt: '✓', subst: '✓' };
const LABEL: Record<ItemState, string> = { done: '이수', ongoing: '수강 중', todo: '남음', exempt: '면제', subst: '대체 인정' };
const okState = (s: ItemState) => s !== 'todo';

export default function LiberalPanel({ taken, courseMap, report, views, nowTerm, admissionYear, dept, options, onOptions }: Props) {
  const [test, setTest] = useState('TOEIC');
  const [score, setScore] = useState('');
  const term = nextTerm(nowTerm);
  const sem = Number(term.split('-')[1]) as 1 | 2;
  const st = analyzeLiberal(data, taken, courseMap, {
    nextSemester: sem, schoolCategory: report?.categories, options, dept: dept ?? null, admissionYear,
  });
  const school = (name: string) => views.find((v) => v.name === name);
  const s필수 = school('교양필수'), s배분 = school('배분이수');
  const pre2019 = !!admissionYear && admissionYear < 2019;

  const todo = liberalTodo(st, data, views);
  const needArea = st.areaRule ? Math.max(0, st.rules.배분영역 - st.coveredEst) : 0;
  const needBaebunCredits = s배분 ? s배분.remaining : Math.max(0, st.rules.배분 - st.credits.배분);
  const scoreNum = Number(score);
  const scoreOk = score !== '' && meetsEnglishScore(data, test, scoreNum);
  const set = (patch: Partial<LiberalOptions>) => onOptions({ ...options, ...patch });

  return (
    <section className="liberal">
      <h2>교양 (후마니타스칼리지)</h2>
      <p className="muted">
        필수교과 {st.rules.필수}학점 · 배분이수 {st.areaRule ? `5개 영역 중 ${st.rules.배분영역}개 영역 ` : '영역 구분 없이 '}{st.rules.배분}학점 이상 · 자유이수 {st.rules.자유}학점 이상, 합계 {st.rules.총}학점 이상
        {pre2019 && <strong className="warn"> · {admissionYear}학번은 입학연도 교양교육과정을 따르므로 학교 사정표 값을 우선하세요</strong>}
      </p>

      <div className="lib-options">
        <label htmlFor="lib-type">학생 구분</label>
        <select id="lib-type" value={options.studentType} onChange={(e) => set({ studentType: e.target.value as StudentType })}>
          <option value="일반">일반 입학</option>
          <option value="외국인">외국인 유학생</option>
          <option value="편입생">편입생</option>
        </select>
        <label className="consent" htmlFor="lib-eng">
          <input id="lib-eng" type="checkbox" checked={options.englishExempt} onChange={(e) => set({ englishExempt: e.target.checked })} />
          <span>대학영어 이수면제 대상이에요</span>
        </label>
      </div>
      <details className="lib-exempt">
        <summary>대학영어 면제 기준 확인</summary>
        <ul className="small">
          <li>공인 영어시험: {Object.entries(data.englishExempt.tests).map(([k, v]) => `${k} ${v}점`).join(' · ')} 이상</li>
          {data.englishExempt.others.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <div className="toolbar">
          <select value={test} onChange={(e) => setTest(e.target.value)} aria-label="시험 종류">
            {Object.keys(data.englishExempt.tests).map((k) => <option key={k}>{k}</option>)}
          </select>
          <input type="number" inputMode="numeric" className="num" placeholder="점수" value={score} onChange={(e) => setScore(e.target.value)} aria-label="영어 점수" />
          {score !== '' && (scoreOk
            ? <span className="ok">면제 기준 충족 <button type="button" className="link small" onClick={() => set({ englishExempt: true })}>면제로 표시</button></span>
            : <span className="warn">기준({data.englishExempt.tests[test]}점) 미달</span>)}
        </div>
        <p className="muted small">{data.englishExempt.notes.join(' · ')}. 점수는 이 화면에서만 확인하고 저장하지 않습니다. 면제는 학교에 신청해야 반영됩니다.</p>
      </details>

      <h3>더 들어야 할 교양 <span className="muted small">{termLabel(term)} 기준</span></h3>
      <ul className="lib-need">
        {todo.map((x) => (
          <li key={x.kind + x.label}><span className="chip warn-chip">{x.kind}</span><strong>{x.label}</strong>{x.detail && <span className="muted small"> {x.detail}</span>}</li>
        ))}
        {todo.length === 0 && (
          <li className="ok">교양 요건을 모두 채웠거나 이번 학기에 채웁니다{s필수?.remaining ? ` (학교 집계 교양필수 ${s필수.remaining}학점 남음 — 면제·대체는 학교에 신청해야 반영)` : ''}.</li>
        )}
      </ul>

      {st.notes.length > 0 && <ul className="lib-notes muted small">{st.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

      <details className="lib-detail">
        <summary>필수교과·배분 영역별 이수 현황</summary>
      <div className="lib-grid">
        <div>
          <h3>필수교과 {s필수 && <span className="muted small">학교 집계 {s필수.earned}/{s필수.required}</span>}</h3>
          <ul className="lib-check">
            {st.required.map((r) => (
              <li key={r.name} className={okState(r.state) ? (r.state === 'ongoing' ? 'lib-ongoing' : 'lib-done') : 'lib-todo'}>
                <span aria-hidden="true">{MARK[r.state]}</span> {r.name} <span className="muted small">{LABEL[r.state]}{r.state !== 'todo' && r.note ? ` · ${r.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>배분이수 {st.areaRule ? '영역' : '(영역 구분 없음)'} {s배분 && <span className="muted small">학교 집계 {s배분.earned}/{s배분.required}</span>}</h3>
          <ul className="lib-check">
            {st.areaState.map((a) => (
              <li key={a.area} className={a.state === 'todo' ? 'lib-none' : a.state === 'ongoing' ? 'lib-ongoing' : 'lib-done'}>
                <span aria-hidden="true">{a.state === 'todo' ? '·' : MARK[a.state]}</span> {a.area}. {a.name}
                {a.courses.length > 0 && <span className="muted small"> · {a.courses.join(', ')}</span>}
              </li>
            ))}
          </ul>
          {st.substBaebun && <p className="ok small">전공기초 {st.substBaebun.course}(으)로 배분이수 {st.substBaebun.credit}학점 대체 인정</p>}
          {st.unknownAreaCourses.length > 0 && (
            <p className="muted small">영역을 확인하지 못한 배분 과목: {st.unknownAreaCourses.join(', ')} (학교 집계 학점에는 포함)</p>
          )}
        </div>
      </div>

      </details>

      {st.suggestions.some((s) => s.courses.length > 0) && (needArea > 0 || needBaebunCredits > 0) && (
        <>
          <h3>배분이수 추천 과목 <span className="muted small">{st.areaRule ? '아직 안 들은 영역' : '아무 영역'} · {sem}학기 개설</span></h3>
          {st.suggestions.filter((s) => s.courses.length).map((s) => (
            <div key={s.area} className="lib-area">
              <strong>{s.area}. {s.name}</strong>
              <ul>
                {s.courses.map((c) => <li key={c.code}>{c.name} <span className="muted code">{c.code} · {c.credit}학점</span></li>)}
              </ul>
            </div>
          ))}
        </>
      )}
      {st.freeSuggestions.length > 0 && (
        <p className="muted small">자유이수 필수 과목 학수번호: {st.freeSuggestions.map((c) => `${c.name} ${c.code}`).join(', ')}</p>
      )}
      <p className="muted small">
        출처: 2026학년도 교육과정 Ⅲ. 교양교육과정(기본구조표·교양 편성표·[별표4] 이수대체·[별표5] 영어 면제·[별표6] 경과조치).
        서울캠퍼스도 같은 기본구조이며, 실제 개설 과목은 수강편람에서 확인하세요. 면제·대체는 학교 신청·승인이 있어야 사정표에 반영됩니다.
      </p>
    </section>
  );
}
