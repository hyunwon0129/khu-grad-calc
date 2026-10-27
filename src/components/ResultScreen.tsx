import { useEffect, useRef, useState } from 'react';
import type { Course, DepartmentInfo, Program, TakenCourse } from '../lib/types';
import { calculate } from '../lib/calc';
import { trackProgress } from '../lib/recommend';
import { choiceGroupOf } from '../lib/prereq';
import { findDepartment } from '../lib/multi';
import { creditLimit } from '../lib/creditLimit';
import { estimateSemestersLeft } from '../lib/verdict';
import MultiPanel from './MultiPanel';
import ShareCard from './ShareCard';
import RecommendPanel from './RecommendPanel';
import LiberalPanel from './LiberalPanel';
import type { LiberalOptions } from '../lib/liberal';
import { newPlanId } from '../lib/whatif';
import type { SchoolCategory } from '../lib/reportLayout';
import Glossary from './Glossary';
import { planRoadmap, nextTerm, termLabel } from '../lib/planner';
import { currentTerm } from '../lib/parseReport';
import ProgressChart from './ProgressChart';
import SchoolProgress, { areaViews } from './SchoolProgress';
import GradSummary, { type SummaryRow } from './GradSummary';
import CreditPlanPanel from './CreditPlanPanel';
import { planCredits, type TermLimits } from '../lib/creditPlan';
import { manualChecks, multiRequired } from '../lib/requirements';
import liberalData from '../data/liberal.json';
import { analyzeLiberal, liberalTodo, type LiberalData } from '../lib/liberal';
import WhatIfPanel from './WhatIfPanel';
import MatchBadge from './MatchBadge';
import { matchWithSchool } from '../lib/reportLayout';
import { applyPlans, plannedByArea, type PlannedItem } from '../lib/whatif';
import { buildVerdict } from '../lib/verdict';
import type { ReportData } from '../lib/reportLayout';
import { sameDept } from '../lib/dept';

const TABS = [
  ['status', '이수 현황'], ['recommend', '다음 학기 과목'], ['plan', '학기 계획'],
  ['liberal', '교양'], ['multi', '다전공·MD'], ['share', '요약·공유'],
] as const;
type Tab = (typeof TABS)[number][0];
const TAB_KEY = 'khu-grad-calc:tab';
const readTab = (): Tab => {
  try { const v = localStorage.getItem(TAB_KEY); return (TABS.some(([k]) => k === v) ? v : 'status') as Tab; } catch { return 'status'; }
};
const STATUS_ROW = { met: 'ok', exempt: 'ok', unmet: 'todo', unknown: 'check', na: 'ok' } as const;

interface Props {
  program: Program;
  programs: Program[];
  departments: DepartmentInfo[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  report?: ReportData | null;
  plans: PlannedItem[];
  onPlans: (p: PlannedItem[]) => void;
  libOptions: LiberalOptions;
  onLibOptions: (o: LiberalOptions) => void;
  excluded: string[];
  maxCredits: number;
  onExcluded: (codes: string[]) => void;
  onMaxCredits: (n: number) => void;
  onEdit: () => void;
  onReimport: () => void;
}

export default function ResultScreen(p: Props) {
  const { program, programs, departments, courseMap, taken, excluded, maxCredits } = p;
  const [includeInProgress, setIncludeInProgress] = useState(false);
  const [showPlan, setShowPlan] = useState(true);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'manual'>('idle');
  const [forceShow, setForceShow] = useState(false);
  const [tab, setTabState] = useState<Tab>(readTab);
  const panelRef = useRef<HTMLDivElement>(null);
  const setTab = (t: Tab, scroll = false) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* 저장 못 해도 동작 */ }
    if (scroll) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const result = calculate(program, courseMap, taken, includeInProgress);
  const nowTerm = currentTerm();
  const plan = planRoadmap(program, courseMap, taken, {
    fromTerm: nextTerm(nowTerm), maxCreditsPerSemester: maxCredits, excluded: new Set(excluded),
  });
  const tracks = trackProgress(program, courseMap, taken);

  const takenCodes = new Set(taken.map((t) => t.code));
  const ipCodes = new Set(taken.filter((t) => t.status === 'IN_PROGRESS').map((t) => t.code));
  // 꼭 들어야 하는 과목: 전공필수 + (과목 학점 합이 기준과 같아 전부 들어야 하는) 전공기초. 택1 묶음은 하나만
  const typeOf = (c: Course) => c.typeByProgram[program.programId];
  const basicReq = program.requirements.find((r) => r.category === '전기')?.minCredits ?? 0;
  const basicAll = program.courses.map((c) => courseMap.get(c)).filter((c): c is Course => !!c && typeOf(c) === '전기');
  const basicPool = basicAll.reduce((s, c) => (choiceGroupOf(program, c.code)?.[0] ?? c.code) === c.code ? s + c.credit : s, 0);
  const mustTypes = new Set(['전필', ...(basicReq > 0 && basicPool === basicReq ? ['전기'] : [])]);
  const missingRequired = program.courses
    .map((c) => courseMap.get(c))
    .filter((c): c is Course => !!c && mustTypes.has(typeOf(c)) && !takenCodes.has(c.code))
    .filter((c) => {
      const g = choiceGroupOf(program, c.code);
      if (!g) return true;
      if (g.some((x) => takenCodes.has(x))) return false;
      return g[0] === c.code; // 묶음 대표 하나만 보여 준다
    });
  const uncounted = taken.filter((t) => !courseMap.get(t.code)?.typeByProgram[program.programId]).length;
  const hasPending = ipCodes.size > 0;

  const gradLabel =
    plan.graduationTerm === '충족' ? '전공 요건 충족'
    : plan.graduationTerm ? `계획대로 들으면 ${termLabel(plan.graduationTerm)}에 전공 요건 충족`
    : '현재 계획으로는 전공 요건을 다 채우지 못합니다';

  const report = p.report ?? null;
  const views = report ? areaViews(report, taken, courseMap) : [];
  const isSample = program.programId.startsWith('SAMPLE');
  const myDeptName = report?.department ?? (isSample ? null : program.department);
  const myDept = findDepartment(departments, myDeptName, report?.department ? null : program.campus);
  const student = { campus: myDept?.campus ?? (isSample ? null : program.campus), department: myDeptName };
  const admissionYear = report?.admissionYear ?? null;
  const limit = creditLimit(myDept, admissionYear ?? program.admissionYearRange[0]);
  const areaLeft = views.filter((v) => v.group !== '졸업' && !/계$/.test(v.name)).reduce((s, v) => s + v.remaining, 0);
  const gradLeft = views.find((v) => v.group === '졸업')?.remaining ?? 0;
  const mustRemaining = report && views.length ? areaLeft : result.totalRemaining;
  const freeRemaining = report && views.length ? Math.max(0, gradLeft - areaLeft) : 0;
  // 추천에 쓸 영역별 남은 학점: 사정표가 있고 학과가 같으면 학교 집계, 아니면 교육과정 계산
  const SCHOOL_TO_SHORT: Record<string, string> = { 전공기초: '전기', 전공필수: '전필', 전공선택: '전선' };
  const recGaps = report && views.length && !(report.department && !sameDept(report.department, program.department))
    ? new Map(views.filter((v) => SCHOOL_TO_SHORT[v.name]).map((v) => [SCHOOL_TO_SHORT[v.name], v.remaining] as [string, number]))
    : undefined;
  const SHORT_TO_SCHOOL: Record<string, SchoolCategory> = { 전기: '전공기초', 전필: '전공필수', 전선: '전공선택' };
  const yearOff = !!admissionYear && !isSample && (admissionYear < program.admissionYearRange[0] || admissionYear > program.admissionYearRange[1]);
  const schoolSummary = report
    ? [
        `[졸업요건 현황] ${report.department ?? ''} ${report.admissionYear ? `${report.admissionYear}학번` : ''} · 졸업사정표 기준`.replace(/\s+/g, ' '),
        buildVerdict(views, report.checks ?? []).headline,
        ...views.map((v) =>
          v.group === '졸업'
            ? `- 졸업학점 ${v.done}/${v.required} (남음 ${v.remaining}${v.pending ? `, 이번 학기 ${v.pending}학점 수강 중` : ''})`
            : `- ${v.name} ${v.earned}/${v.required}${v.remaining ? ` (남음 ${v.remaining})` : ' 충족'}`),
        ...(report.checks ?? []).map((c) => `- ${c.name}: ${({ met: '충족', unmet: '미충족', exempt: '면제', na: '해당 없음', unknown: '확인 필요' } as const)[c.status]}${c.detail ? ` (${c.detail})` : ''}`),
      ]
    : [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('ok');
    } catch {
      setCopied('manual');
    }
  };

  const exclude = (code: string) => p.onExcluded([...excluded, code]);
  const restore = (code: string) => p.onExcluded(excluded.filter((c) => c !== code));

  const counted = taken.length - uncounted;
  const fileDept = report?.department ?? null;
  const mismatch = !!fileDept && !sameDept(fileDept, program.department);
  const showCurriculum = !mismatch || forceShow;
  const curriculumName = `${program.department} ${program.admissionYearRange[0]}학번`;

  const curriculumSummary = [
    `[${report ? '학과 교육과정 기준 추천' : '졸업요건 현황'}] ${curriculumName} 교육과정${isSample ? ' (시험용 샘플)' : ''}`,
    ...(report ? [] : [
      `전공 ${result.totalEarned}/${result.totalRequired}학점 (잔여 ${result.totalRemaining})`,
      ...result.areas.map((a) => `- ${a.category} ${a.earned}/${a.required}${a.remaining ? ` (잔여 ${a.remaining})` : ' 완료'}`),
    ]),
    missingRequired.length ? `미이수 필수 과목: ${missingRequired.map((c) => c.name).join(', ')}` : '필수 과목: 모두 이수',
    gradLabel,
  ];
  const summary = [
    ...schoolSummary,
    ...(report && showCurriculum ? [''] : []),
    ...(showCurriculum ? curriculumSummary : []),
  ].join('\n');

  // ── 학기 학점 계획 (1·2학기 수강허용학점이 다를 수 있고, 다음 학기에만 +3·세이브)
  const yearForCalc = admissionYear ?? (isSample ? null : program.admissionYearRange[0]);
  const estSem = estimateSemestersLeft(yearForCalc, nowTerm);
  const [semesters, setSemesters] = useState<number>(estSem ?? 4);
  const [limits, setLimits] = useState<TermLimits>(() => ({ first: limit?.first ?? 18, second: limit?.second ?? 18, honorsBonus: false, saved: 0 }));
  const limitKey = limit ? `${limit.first}/${limit.second}` : '';
  useEffect(() => {
    if (limit) setLimits((l) => ({ ...l, first: limit.first, second: limit.second }));
    // 학과·학번이 바뀌면 학교 기준으로 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitKey]);
  const verdict = report && views.length ? buildVerdict(views, report.checks ?? []) : null;
  const creditsLeft = verdict ? verdict.remainingCredits : result.totalRemaining;
  const creditPlan = planCredits(creditsLeft, nowTerm, semesters, limits);
  const capPlan = planCredits(0, nowTerm, semesters, limits);
  const capNote = limits.first === limits.second ? `학기당 ${limits.first}학점 기준` : `1학기 ${limits.first}·2학기 ${limits.second}학점 기준`;

  // ── 교양 남은 것
  const libData = liberalData as unknown as LiberalData;
  const nextSem = Number(nextTerm(nowTerm).split('-')[1]) as 1 | 2;
  const libStatus = analyzeLiberal(libData, taken, courseMap, {
    nextSemester: nextSem, schoolCategory: report?.categories, options: p.libOptions, dept: myDept ?? null, admissionYear: yearForCalc,
  });
  const libTodo = liberalTodo(libStatus, libData, views);

  // ── 졸업 요건 체크리스트
  const needMulti = multiRequired(admissionYear ?? (isSample ? null : program.admissionYearRange[0]), myDept ?? null);
  // 같은 내용을 한 줄로 모은다: 졸업학점(+남은 학기 안에 가능한지), 전공(영역별), 교양(영역별+과목), 그 밖의 요건
  const rows: SummaryRow[] = [];
  const left = (xs: { name: string; remaining: number }[]) => xs.filter((x) => x.remaining > 0).map((x) => `${x.name} ${x.remaining}`).join(' · ');
  const capText = semesters <= 0 ? '남은 정규 학기 없음'
    : creditPlan.shortfall > 0 ? `${semesters}학기 최대 ${creditPlan.capacity}학점으로는 ${creditPlan.shortfall}학점 부족`
    : `${semesters}학기 동안 학기당 약 ${Math.ceil(creditsLeft / semesters)}학점`;
  const capBad = creditsLeft > 0 && (semesters <= 0 || creditPlan.shortfall > 0);
  if (report && views.length) {
    const grad = views.find((v) => v.group === '졸업');
    if (grad) {
      rows.push({
        key: 'grad', label: '졸업학점', status: grad.remaining > 0 ? 'todo' : grad.pending ? 'ongoing' : 'ok',
        detail: grad.remaining > 0 ? `${grad.remaining}학점 남음 (${grad.done}/${grad.required}) · ${capText}` : `${grad.done}/${grad.required}`,
        tab: 'plan',
      });
    }
    const major = views.filter((v) => v.group === '전공' && !/계$/.test(v.name));
    if (major.length) {
      const l = left(major);
      rows.push({ key: 'major', label: '전공 학점', status: l ? 'todo' : 'ok', detail: l ? `${l}학점 남음` : '모두 충족', tab: 'status' });
    }
  } else {
    const l = left(result.areas.map((a) => ({ name: a.category, remaining: a.remaining })));
    rows.push({ key: 'major', label: '전공 학점', status: l ? 'todo' : 'ok', detail: l ? `${l}학점 남음 · ${capText}` : '모두 충족', tab: 'status' });
  }
  if (showCurriculum) {
    rows.push({
      key: 'must', label: '꼭 들어야 하는 전공 과목', status: missingRequired.length ? 'todo' : 'ok',
      detail: missingRequired.length ? `${missingRequired.length}과목: ${missingRequired.slice(0, 3).map((c) => c.name).join(', ')}${missingRequired.length > 3 ? ' 등' : ''}` : '모두 이수', tab: 'recommend',
    });
  }
  const libSchool = left(views.filter((v) => v.group === '교양' && !/계$/.test(v.name)));
  rows.push({
    key: 'liberal', label: '교양', status: libTodo.length || libSchool ? 'todo' : 'ok',
    detail: libTodo.length ? libTodo.map((x) => (x.kind === '필수교과' ? x.label : `${x.kind} ${x.label}`)).slice(0, 4).join(', ') + (libTodo.length > 4 ? ` 외 ${libTodo.length - 4}개` : '')
      : libSchool ? `${libSchool}학점 남음` : '모두 충족',
    tab: 'liberal',
  });
  for (const c of report && views.length ? report.checks ?? [] : []) {
    if (c.status === 'na') continue;
    rows.push({ key: `c-${c.key}`, label: c.name, status: STATUS_ROW[c.status], detail: c.detail ?? c.hint, tab: c.status === 'unmet' ? 'status' : undefined });
  }
  if (needMulti) {
    rows.push({ key: 'multi', label: '다전공·마이크로디그리·부전공', status: 'check', detail: '2026학번부터 1개 이상 필수', tab: 'multi' });
  }
  if (!(report && views.length) && capBad) rows.push({ key: 'cap', label: '남은 학기 학점', status: 'todo', detail: capText, tab: 'plan' });
  for (const m of manualChecks(yearForCalc, myDept ?? null)) {
    if (/다전공/.test(m.name)) continue;
    rows.push({ key: `m-${m.name}`, label: m.name, status: 'check', detail: m.detail });
  }
  const headline = verdict ? verdict.headline : result.totalRemaining ? `전공 ${result.totalRemaining}학점이 남았습니다` : '전공 학점을 모두 채웠습니다';
  const planLine = verdict && p.plans.length ? (() => {
    const pv = buildVerdict(applyPlans(views, p.plans), report?.checks ?? []);
    return pv.allDone ? '계획대로 들으면 학점·요건을 모두 채웁니다' : `계획대로 들으면 ${pv.headline}`;
  })() : null;
  const tabs = TABS.filter(([k]) => showCurriculum || k !== 'recommend').filter(([k]) => k !== 'share' || showCurriculum || report);
  const activeTab: Tab = tabs.some(([k]) => k === tab) ? tab : 'status';
  const tabLabel = (k: string) => TABS.find(([x]) => x === k)?.[1] ?? k;

  return (
    <>
      {mismatch && (
        <section className="notice notice-warn" role="status">
          <strong>{fileDept} 과목 추천은 준비 중입니다</strong>
          <span>
            남은 학점은 아래처럼 사정표 기준으로 계산했습니다. 꼭 들어야 하는 과목과 학기별 로드맵은
            {' '}{fileDept} 과목 목록이 있어야 해서 아직 보여드릴 수 없습니다. (앱에 있는 교육과정: {curriculumName})
          </span>
          <span className="actions">
            <button type="button" className="link" onClick={() => setForceShow((v) => !v)}>
              {forceShow ? '다시 숨기기' : `그래도 ${curriculumName} 기준으로 보기`}
            </button>
          </span>
        </section>
      )}
      {showCurriculum && !isSample && (program.note || yearOff || !program.verified) && (
        <p className="notice">
          <span>
            <strong>{program.department} 과목 데이터: {program.source.year}학년도 교육과정</strong>
            {yearOff && ` · ${admissionYear}학번 교육과정과 다를 수 있어요.`}
            {program.note && ` ${program.note}`}
            {!program.verified && ' 책자에서 일부 과목을 읽지 못해 과목 목록이 완전하지 않을 수 있습니다.'}
          </span>
        </p>
      )}
      {showCurriculum && isSample && !report && (
        <p className="notice">
          <span>
            <strong>시험용 샘플 교육과정 기준</strong> · {curriculumName} 데이터는 기능 확인용으로 만든 가상 값이라 실제 학과 요건과 다릅니다.
          </span>
        </p>
      )}

      <GradSummary headline={headline} allDone={verdict ? verdict.allDone : result.totalRemaining === 0} planLine={planLine}
        rows={rows} tabLabel={tabLabel} onOpen={(t) => setTab(t as Tab, true)} />

      <div className="result-tabs" role="tablist" aria-label="세부 항목">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={activeTab === k} aria-controls="tab-panel"
            className={activeTab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="tab-panel" id="tab-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} ref={panelRef}>
      {activeTab === 'status' && (

      <section>
        <h2>이수 현황{report && <span className="h2-sub"> · 졸업사정표 기준</span>}</h2>
        <p className="input-summary">
          {report && (
            <span className="chip">
              {report.source === 'SAMPLE' ? '가상 사정표' : '사정표 PDF'}{' '}
              {new Date(report.importedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 불러옴
            </span>
          )}
          {report?.department && <><strong>{report.department}</strong>{report.admissionYear ? ` ${report.admissionYear}학번` : ''} · </>}
          과목 <strong>{taken.length}</strong>개
          {ipCodes.size > 0 && <span className="muted"> · 이번 학기 수강 중 {ipCodes.size}개</span>}
        </p>

        {report && report.areas.length > 0 ? (
          <>
            <MatchBadge compact result={matchWithSchool(
              taken.map((t) => ({ credit: courseMap.get(t.code)?.credit ?? null, status: t.status, category: report.categories[t.code] })),
              report.areas,
            )} />
            <SchoolProgress report={report} taken={taken} courseMap={courseMap} planned={plannedByArea(p.plans)} />
            <WhatIfPanel views={views} plans={p.plans} onPlans={p.onPlans} />
          </>
        ) : report ? (
          <p className="warn">사정표에서 영역별 학점을 읽지 못했습니다. 아래 학과 교육과정 기준 결과를 참고하세요.</p>
        ) : null}

        {(!report || report.areas.length === 0) && showCurriculum && (
          <>
            {isSample && (
              <p className="notice"><span><strong>시험용 샘플 교육과정 기준</strong> · {curriculumName} 데이터는 기능 확인용 가상 값입니다.</span></p>
            )}
            {taken.length > 0 && counted === 0 && (
              <p className="warn" role="status">
                입력한 과목이 선택한 교육과정의 과목 목록에 하나도 없어 학점이 0으로 계산됐습니다. 과목 직접 수정에서 이수구분을 지정하면 반영됩니다.
              </p>
            )}
            <ProgressChart
              result={result}
              showPending={!includeInProgress}
              planned={showPlan ? plan.plannedByCategory : undefined}
              graduationLabel={gradLabel}
            />
            <div className="toolbar">
              {hasPending && (
                <label><input id="include-ip" type="checkbox" checked={includeInProgress} onChange={(e) => setIncludeInProgress(e.target.checked)} /> 수강 중 과목도 이수로 계산</label>
              )}
              <label><input id="show-plan" type="checkbox" checked={showPlan} onChange={(e) => setShowPlan(e.target.checked)} /> 로드맵 계획 겹쳐 보기</label>
            </div>
            {uncounted > 0 && <p className="muted">이 교육과정에 속하지 않거나 이수구분이 정해지지 않은 과목 {uncounted}개는 전공 학점에서 제외했습니다.</p>}
          </>
        )}
        <div className="toolbar">
          <button type="button" className="link" onClick={p.onEdit}>과목 직접 수정</button>
          <button type="button" className="link" onClick={p.onReimport}>사정표 다시 불러오기</button>
        </div>
      </section>
      )}

      {showCurriculum && report && isSample && ['recommend', 'plan'].includes(activeTab) && (
        <p className="notice"><span><strong>아래 추천은 시험용 샘플 교육과정 기준</strong> · {curriculumName} 데이터는 기능 확인용 가상 값입니다.</span></p>
      )}

      {showCurriculum && activeTab === 'recommend' && (
      <RecommendPanel
        program={program}
        programs={programs}
        courseMap={courseMap}
        taken={taken}
        nowTerm={nowTerm}
        admissionYear={admissionYear ?? (isSample ? null : program.admissionYearRange[0])}
        gaps={recGaps && recGaps.size ? recGaps : undefined}
        maxCredits={maxCredits}
        plannedNames={new Set(p.plans.map((x) => x.name))}
        onPlan={report && report.areas.length ? (c) => p.onPlans([...p.plans, { id: newPlanId(), name: c.name, category: SHORT_TO_SCHOOL[c.type] ?? '전공선택', credit: c.credit }]) : undefined}
      />
      )}

      {showCurriculum && activeTab === 'recommend' && (
      <details className="must-more">
        <summary>{missingRequired.length ? `아직 안 들은 꼭 들어야 하는 전공 과목 ${missingRequired.length}개` : '꼭 들어야 하는 전공 과목: 모두 이수'}</summary>
        {missingRequired.length > 0 && (
          <ul className="must">
            {missingRequired.map((c) => (
              <li key={c.code}>
                <span className="chip warn-chip">{typeOf(c)}</span>
                {choiceGroupOf(program, c.code)
                  ? <>{choiceGroupOf(program, c.code)!.map((x) => courseMap.get(x)?.name ?? x).join(' 또는 ')} <span className="muted">· 택1</span></>
                  : <>{c.name} <span className="muted code">{c.code} · {c.credit}학점</span></>}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">전공필수는 학점을 다 채워도 빠지면 졸업할 수 없는 경우가 많습니다. 정확한 규정은 학과 교육과정에서 확인하세요.</p>
      </details>
      )}

      {activeTab === 'plan' && (
        <CreditPlanPanel remaining={creditsLeft} remainingLabel={verdict ? '졸업학점' : '전공 학점'} semesters={semesters} onSemesters={setSemesters} estimated={estSem !== null}
          limits={limits} onLimits={setLimits} schoolLimit={limit} plan={creditPlan} />
      )}

      {showCurriculum && activeTab === 'plan' && (
        <>
      <section>
        <h2>전공 과목 로드맵</h2>
        <div className="toolbar">
          <label htmlFor="max-credits">학기당 전공 학점</label>
          <input id="max-credits" type="number" min={3} max={21} step={3} value={maxCredits} className="num"
            onChange={(e) => p.onMaxCredits(Math.max(3, Number(e.target.value)))} />
          <span className="muted">교양·일반선택을 뺀 전공 과목 기준</span>
        </div>

        {plan.semesters.length === 0 && plan.graduationTerm === '충족' && <p className="ok">더 들어야 할 전공 과목이 없습니다.</p>}

        <ol className="roadmap">
          {plan.semesters.map((s, i) => (
            <li key={s.term} className="sem">
              <div className="sem-head">
                <strong>{termLabel(s.term)}</strong>
                {i === 0 && <span className="chip ok-chip">다음 학기</span>}
                <span className="muted">{s.credits}학점</span>
              </div>
              <ul>
                {s.courses.map((c) => (
                  <li key={c.code} className="sem-course">
                    <span className="chip">{c.type}</span>
                    <span>{c.name}{c.offParity && <span className="muted"> · 권장 학기 아님</span>}</span>
                    <button type="button" className="link small" onClick={() => exclude(c.code)} aria-label={`${c.name} 계획에서 빼기`}>빼기</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        {plan.shortfall.length > 0 && (
          <p className="warn">
            과목이 모자라 채우지 못한 학점: {plan.shortfall.map((s) => `${s.category} ${s.credits}`).join(', ')}.
            {' '}뺀 과목을 되돌리거나 학기당 학점을 늘려 보세요.
          </p>
        )}
        {plan.blocked.length > 0 && plan.shortfall.length > 0 && (
          <p className="muted">선수과목 때문에 배치하지 못한 과목: {plan.blocked.join(', ')}</p>
        )}
        {excluded.length > 0 && (
          <p className="muted">
            계획에서 뺀 과목:{' '}
            {excluded.map((code) => (
              <button key={code} type="button" className="link small" onClick={() => restore(code)}>
                {courseMap.get(code)?.name ?? code} 되돌리기
              </button>
            ))}
          </p>
        )}
        <p className="muted">선수과목과 권장 학기를 기준으로 짠 예시입니다. 실제 개설 여부는 수강편람에서 확인하세요.</p>
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

        </>
      )}

      {activeTab === 'liberal' && (
      <LiberalPanel taken={taken} courseMap={courseMap} report={report} views={views} nowTerm={nowTerm}
        admissionYear={admissionYear ?? (isSample ? null : program.admissionYearRange[0])} dept={myDept ?? null}
        options={p.libOptions} onOptions={p.onLibOptions} />
      )}

      {activeTab === 'multi' && (
      <MultiPanel
        departments={departments}
        programs={programs}
        courseMap={courseMap}
        taken={taken}
        student={student}
        cap={capPlan.capacity}
        capNote={`남은 ${semesters}학기 · ${capNote}`}
        required={needMulti}
        mustRemaining={mustRemaining}
        freeRemaining={freeRemaining}
      />
      )}

      {(showCurriculum || report) && activeTab === 'share' && (
      <section>
        <h2>요약·공유</h2>
        <p className="muted">지도교수 상담이나 학과 사무실 문의 때 붙여넣기 좋은 요약입니다. 이름·학번은 들어가지 않습니다.</p>
        <textarea id="summary" className="summary" readOnly value={summary} rows={summary.split('\n').length}
          onFocus={(e) => e.currentTarget.select()} />
        <div className="actions">
          <button type="button" onClick={copy}>요약 복사</button>
          {copied === 'ok' && <span className="ok" role="status">복사했습니다</span>}
          {copied === 'manual' && <span className="muted" role="status">자동 복사가 막혀 있습니다. 위 칸을 눌러 선택한 뒤 복사하세요.</span>}
        </div>
        <ShareCard
          title={report ? `${report.department ?? ''} ${report.admissionYear ? `${report.admissionYear}학번` : ''}`.trim() || '내 졸업요건' : curriculumName}
          headline={report && views.length ? buildVerdict(views, report.checks ?? []).headline : result.totalRemaining ? `전공 ${result.totalRemaining}학점이 남았습니다` : '전공 학점을 모두 채웠습니다'}
          bars={report && views.length
            ? views.filter((v) => !/계$/.test(v.name)).map((v) => ({ name: v.name, earned: v.group === '졸업' ? v.done : v.earned, required: v.required }))
            : result.areas.map((a) => ({ name: a.category, earned: a.earned, required: a.required }))}
          footnote={report ? (report.source === 'SAMPLE' ? '가상 사정표 예시 · 비공식 참고용' : '졸업사정표 기준 · 비공식 참고용') : `${curriculumName} 교육과정 기준 · 비공식 참고용`}
        />
      </section>
      )}
      </div>

      <Glossary />
    </>
  );
}
