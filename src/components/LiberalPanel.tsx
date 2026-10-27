// 교양(후마니타스칼리지): 필수교과 체크, 배분이수 영역, 자유이수, 그리고 더 들어야 할 과목
import liberalData from '../data/liberal.json';
import type { Course, TakenCourse } from '../lib/types';
import { analyzeLiberal, type ItemState, type LiberalData } from '../lib/liberal';
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
}

const MARK: Record<ItemState, string> = { done: '✓', ongoing: '…', todo: '!' };
const LABEL: Record<ItemState, string> = { done: '이수', ongoing: '수강 중', todo: '남음' };

export default function LiberalPanel({ taken, courseMap, report, views, nowTerm, admissionYear }: Props) {
  const term = nextTerm(nowTerm);
  const sem = Number(term.split('-')[1]) as 1 | 2;
  const st = analyzeLiberal(data, taken, courseMap, { nextSemester: sem, schoolCategory: report?.categories });
  const school = (name: string) => views.find((v) => v.name === name);
  const s필수 = school('교양필수'), s배분 = school('배분이수'), s자유 = school('자유이수');
  const old = !!admissionYear && admissionYear <= 2023;

  const todoRequired = st.required.filter((r) => r.state === 'todo');
  const needArea = Math.max(0, data.rules.배분영역 - st.coveredEst);

  return (
    <section className="liberal">
      <h2>교양 (후마니타스칼리지)</h2>
      <p className="muted">
        필수교과 {data.rules.필수}학점 · 배분이수 5개 영역 중 {data.rules.배분영역}개 영역 {data.rules.배분}학점 이상 · 자유이수 {data.rules.자유}학점 이상, 합계 {data.rules.총}학점 이상
        {old && <strong className="warn"> · {admissionYear}학번은 경과조치 기준이 달라 학교 사정표 값을 우선하세요</strong>}
      </p>

      <h3>더 들어야 할 교양 <span className="muted small">{termLabel(term)} 기준</span></h3>
      <ul className="lib-need">
        {todoRequired.map((r) => (
          <li key={r.name}><span className="chip warn-chip">필수교과</span><strong>{r.name}</strong> <span className="muted small">{r.credit}학점 · {r.year}학년 권장{r.note ? ` · ${r.note}` : ''}</span></li>
        ))}
        {needArea > 0 && (
          <li><span className="chip warn-chip">배분이수</span><strong>{needArea}개 영역 더</strong>{st.unknownAreaCourses.length > 0 && <span className="muted small"> (영역 모르는 과목 {st.unknownAreaCourses.length}개는 다른 영역으로 셈)</span>} <span className="muted small">아직 안 들은 영역: {st.areaState.filter((a) => a.state === 'todo').map((a) => `${a.area}. ${a.name}`).join(' / ')}</span></li>
        )}
        {s배분 && s배분.remaining > 0 && needArea === 0 && (
          <li><span className="chip warn-chip">배분이수</span><strong>{s배분.remaining}학점 더</strong></li>
        )}
        {st.freeSeminar === 'todo' && (
          <li><span className="chip warn-chip">자유이수</span><strong>{data.requiredFree.name}</strong> <span className="muted small">필수 · {data.requiredFree.note}{data.requiredFree.alt ? ` · '${data.requiredFree.alt}'로 대신 가능(공과대학 등)` : ''}</span></li>
        )}
        {s자유 && s자유.remaining > 0 && <li><span className="chip warn-chip">자유이수</span><strong>{s자유.remaining}학점 더</strong></li>}
        {todoRequired.length === 0 && needArea === 0 && st.freeSeminar !== 'todo' && !(s배분?.remaining) && !(s자유?.remaining) && !(s필수?.remaining) && (
          <li className="ok">교양 요건을 모두 채웠거나 이번 학기에 채웁니다.</li>
        )}
      </ul>

      <div className="lib-grid">
        <div>
          <h3>필수교과 {s필수 && <span className="muted small">학교 집계 {s필수.earned}/{s필수.required}</span>}</h3>
          <ul className="lib-check">
            {st.required.map((r) => (
              <li key={r.name} className={`lib-${r.state}`}><span aria-hidden="true">{MARK[r.state]}</span> {r.name} <span className="muted small">{LABEL[r.state]}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>배분이수 영역 {s배분 && <span className="muted small">학교 집계 {s배분.earned}/{s배분.required}</span>}</h3>
          <ul className="lib-check">
            {st.areaState.map((a) => (
              <li key={a.area} className={`lib-${a.state === 'todo' ? 'none' : a.state}`}>
                <span aria-hidden="true">{a.state === 'todo' ? '·' : MARK[a.state]}</span> {a.area}. {a.name}
                {a.courses.length > 0 && <span className="muted small"> · {a.courses.join(', ')}</span>}
              </li>
            ))}
          </ul>
          {st.unknownAreaCourses.length > 0 && (
            <p className="muted small">영역을 확인하지 못한 배분 과목: {st.unknownAreaCourses.join(', ')} (학교 집계 학점에는 포함)</p>
          )}
        </div>
      </div>

      {st.suggestions.some((s) => s.courses.length > 0) && (
        <>
          <h3>배분이수 추천 과목 <span className="muted small">아직 안 들은 영역 · {sem}학기 개설</span></h3>
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
        출처: {data.source.split(' — ')[0]} (교양 편성표·교과목 해설). 서울캠퍼스도 같은 기본구조이며, 실제 개설 과목은 수강편람에서 확인하세요.
        학과에 따라 전공기초 과목으로 배분이수·빅뱅에서문명까지를 대신 인정받을 수 있습니다.
      </p>
    </section>
  );
}
