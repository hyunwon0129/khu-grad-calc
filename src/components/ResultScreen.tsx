import { useState } from 'react';
import type { Course, Program, TakenCourse } from '../lib/types';
import { calculate } from '../lib/calc';
import { recommendPrograms, trackProgress } from '../lib/recommend';
import { planRoadmap, nextTerm, termLabel } from '../lib/planner';
import { currentTerm } from '../lib/parseReport';
import ProgressChart from './ProgressChart';
import SchoolProgress, { areaViews } from './SchoolProgress';
import VerdictCard from './VerdictCard';
import { buildVerdict } from '../lib/verdict';
import type { ReportData } from '../lib/reportLayout';
import { sameDept } from '../lib/dept';

interface Props {
  program: Program;
  programs: Program[];
  courseMap: Map<string, Course>;
  taken: TakenCourse[];
  report?: ReportData | null;
  excluded: string[];
  maxCredits: number;
  onExcluded: (codes: string[]) => void;
  onMaxCredits: (n: number) => void;
  onEdit: () => void;
  onReimport: () => void;
}

export default function ResultScreen(p: Props) {
  const { program, programs, courseMap, taken, excluded, maxCredits } = p;
  const [includeInProgress, setIncludeInProgress] = useState(false);
  const [showPlan, setShowPlan] = useState(true);
  const [semestersLeft, setSemestersLeft] = useState(4);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'manual'>('idle');
  const [forceShow, setForceShow] = useState(false);

  const result = calculate(program, courseMap, taken, includeInProgress);
  const nowTerm = currentTerm();
  const plan = planRoadmap(program, courseMap, taken, {
    fromTerm: nextTerm(nowTerm), maxCreditsPerSemester: maxCredits, excluded: new Set(excluded),
  });
  const tracks = trackProgress(program, courseMap, taken);
  const others = recommendPrograms(
    programs.filter((x) => x.kind !== 'MAJOR' && x.campus === program.campus),
    courseMap, taken, result.totalRemaining, semestersLeft,
  );

  const takenCodes = new Set(taken.map((t) => t.code));
  const ipCodes = new Set(taken.filter((t) => t.status === 'IN_PROGRESS').map((t) => t.code));
  const missingRequired = program.courses
    .map((c) => courseMap.get(c))
    .filter((c): c is Course => !!c && c.typeByProgram[program.programId] === '전필' && !takenCodes.has(c.code));
  const uncounted = taken.filter((t) => !courseMap.get(t.code)?.typeByProgram[program.programId]).length;
  const hasPending = ipCodes.size > 0;

  const gradLabel =
    plan.graduationTerm === '충족' ? '전공 요건 충족'
    : plan.graduationTerm ? `계획대로 들으면 ${termLabel(plan.graduationTerm)}에 전공 요건 충족`
    : '현재 계획으로는 전공 요건을 다 채우지 못합니다';

  const report = p.report ?? null;
  const views = report ? areaViews(report, taken, courseMap) : [];
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
    `[${report ? '학과 교육과정 기준 추천' : '졸업요건 현황'}] ${curriculumName} 교육과정${program.verified ? '' : ' (시험용 샘플)'}`,
    ...(report ? [] : [
      `전공 ${result.totalEarned}/${result.totalRequired}학점 (잔여 ${result.totalRemaining})`,
      ...result.areas.map((a) => `- ${a.category} ${a.earned}/${a.required}${a.remaining ? ` (잔여 ${a.remaining})` : ' 완료'}`),
    ]),
    missingRequired.length ? `미이수 전필: ${missingRequired.map((c) => c.name).join(', ')}` : '전필: 모두 이수',
    gradLabel,
  ];
  const summary = [
    ...schoolSummary,
    ...(report && showCurriculum ? [''] : []),
    ...(showCurriculum ? curriculumSummary : []),
  ].join('\n');

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
      {showCurriculum && !program.verified && !report && (
        <p className="notice">
          <span>
            <strong>시험용 샘플 교육과정 기준</strong> · {curriculumName} 데이터는 기능 확인용으로 만든 가상 값이라 실제 학과 요건과 다릅니다.
          </span>
        </p>
      )}

      {report && report.areas.length > 0 && <VerdictCard report={report} views={views} />}

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
          <SchoolProgress report={report} taken={taken} courseMap={courseMap} />
        ) : report ? (
          <p className="warn">사정표에서 영역별 학점을 읽지 못했습니다. 아래 학과 교육과정 기준 결과를 참고하세요.</p>
        ) : null}

        {(!report || report.areas.length === 0) && showCurriculum && (
          <>
            {!program.verified && (
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

      {showCurriculum && report && !program.verified && (
        <p className="notice"><span><strong>아래 추천은 시험용 샘플 교육과정 기준</strong> · {curriculumName} 데이터는 기능 확인용 가상 값입니다.</span></p>
      )}

      {showCurriculum && (
        <>
      <section>
        <h2>꼭 들어야 하는 과목</h2>
        {missingRequired.length === 0 ? (
          <p className="ok">전공필수 과목을 모두 이수했습니다.</p>
        ) : (
          <ul className="must">
            {missingRequired.map((c) => (
              <li key={c.code}>
                <span className="chip warn-chip">전필</span>{c.name} <span className="muted code">{c.code} · {c.credit}학점</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">전공필수는 학점을 다 채워도 빠지면 졸업할 수 없는 경우가 많습니다. 정확한 규정은 학과 교육과정에서 확인하세요.</p>
      </section>

      <section>
        <h2>학기별 로드맵</h2>
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

      {(showCurriculum || report) && (
      <section>
        <h2>상담용 요약</h2>
        <p className="muted">지도교수 상담이나 학과 사무실 문의 때 붙여넣기 좋은 요약입니다. 이름·학번은 들어가지 않습니다.</p>
        <textarea id="summary" className="summary" readOnly value={summary} rows={summary.split('\n').length}
          onFocus={(e) => e.currentTarget.select()} />
        <div className="actions">
          <button type="button" onClick={copy}>요약 복사</button>
          {copied === 'ok' && <span className="ok" role="status">복사했습니다</span>}
          {copied === 'manual' && <span className="muted" role="status">자동 복사가 막혀 있습니다. 위 칸을 눌러 선택한 뒤 복사하세요.</span>}
        </div>
      </section>
      )}
    </>
  );
}
