// 졸업사정표 기준 이수 현황. 학교가 판정한 영역별 취득/기준을 그대로 보여준다(개발가이드 8.5 '학교 값 우선').
// 사정표의 영역 취득에는 이번 학기 수강 과목이 포함되고, 졸업학점 취득에는 포함되지 않는다.
import type { Course, TakenCourse } from '../lib/types';
import type { ReportArea, ReportData, SchoolCategory } from '../lib/reportLayout';
import { SCHOOL_CATEGORIES } from '../lib/reportLayout';
import { Bar } from './ProgressChart';

interface Props {
  report: ReportData;
  taken: TakenCourse[];
  courseMap: Map<string, Course>;
}

export interface AreaView extends ReportArea {
  done: number;      // 이수 완료
  pending: number;   // 이번 학기 수강 중
  remaining: number; // 이번 학기까지 마친 뒤에도 남는 학점
}

export function areaViews(report: ReportData, taken: TakenCourse[], courseMap: Map<string, Course>): AreaView[] {
  const creditOf = (code: string) => courseMap.get(code)?.credit ?? 0;
  const ip = taken.filter((t) => t.status === 'IN_PROGRESS');
  const ipBy = (name: string) => ip.filter((t) => report.categories[t.code] === name).reduce((s, t) => s + creditOf(t.code), 0);
  const ipTotal = ip.reduce((s, t) => s + creditOf(t.code), 0);
  return report.areas.map((a) => {
    if (a.group === '졸업') {
      return { ...a, done: a.earned, pending: ipTotal, remaining: Math.max(0, a.required - a.earned - ipTotal) };
    }
    const pending = Math.min(ipBy(a.name), a.earned);
    return { ...a, done: a.earned - pending, pending, remaining: Math.max(0, a.required - a.earned) };
  });
}

const GROUP_ORDER: ReportArea['group'][] = ['졸업', '전공', '교양'];

export default function SchoolProgress({ report, taken, courseMap }: Props) {
  const views = areaViews(report, taken, courseMap);
  const grad = views.find((v) => v.group === '졸업');
  const lacking = views.filter((v) => v.group !== '졸업' && v.remaining > 0);
  const byCategory = new Map<SchoolCategory | '미분류', TakenCourse[]>();
  for (const t of taken) {
    const k = report.categories[t.code] ?? '미분류';
    byCategory.set(k, [...(byCategory.get(k) ?? []), t]);
  }

  return (
    <div className="progress">
      {grad && (
        <div className="progress-total">
          <div className="progress-head">
            <span className="label">졸업학점</span>
            <span className="figure"><strong>{grad.done}</strong><span className="muted"> / {grad.required}학점</span></span>
            <span className={grad.remaining ? 'remain warn' : 'remain ok'}>
              {grad.remaining ? `${grad.remaining}학점 남음` : '졸업학점 충족'}
            </span>
          </div>
          <Bar earned={grad.done} pending={grad.pending} planned={0} required={grad.required} label="졸업학점" />
          <div className="progress-foot">
            <span className="muted">
              {grad.pending > 0 ? `이번 학기 ${grad.pending}학점을 마치면 ${grad.done + grad.pending}학점` : `${Math.round((grad.done / grad.required) * 100)}% 달성`}
            </span>
            <span className="grad">
              {lacking.length === 0 ? '영역별 기준을 모두 채웠거나 이번 학기에 채웁니다' : `부족한 영역 ${lacking.length}개`}
            </span>
          </div>
        </div>
      )}

      {GROUP_ORDER.filter((g) => g !== '졸업').map((g) => {
        const list = views.filter((v) => v.group === g);
        if (list.length === 0) return null;
        return (
          <div key={g} className="progress-areas">
            <span className="group-label">{g}</span>
            {list.map((a) => (
              <div key={a.name} className="progress-row school-row">
                <span className="label">{a.name}</span>
                <Bar earned={a.done} pending={a.pending} planned={0} required={a.required} label={a.name} />
                <span className="figure">{a.earned}<span className="muted">/{a.required}</span></span>
                <span className={a.remaining ? 'remain warn' : 'remain ok'}>{a.remaining ? `${a.remaining} 남음` : '충족'}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div className="legend" aria-hidden="true">
        <span><i className="sw sw-done" />이수</span>
        {views.some((v) => v.pending > 0) && <span><i className="sw sw-ip" />이번 학기 수강 중</span>}
        <span><i className="sw sw-rest" />남은 학점</span>
        <span className="muted">영역 숫자는 이번 학기 수강분을 포함한 학교 집계입니다</span>
      </div>

      <details className="course-groups">
        <summary>학교 이수구분별 과목 {taken.length}개 보기</summary>
        {[...SCHOOL_CATEGORIES, '미분류' as const].filter((k) => byCategory.has(k)).map((k) => (
          <div key={k} className="course-group">
            <strong>{k}</strong>
            <ul>
              {byCategory.get(k)!.map((t) => {
                const c = courseMap.get(t.code);
                return (
                  <li key={`${t.code}-${t.term}`}>
                    <span className="code">{t.code}</span> {c?.name ?? ''}
                    <span className="muted"> · {c?.credit ?? '?'}학점 · {t.term}</span>
                    {t.status === 'IN_PROGRESS' && <span className="chip">수강 중</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </details>
    </div>
  );
}
