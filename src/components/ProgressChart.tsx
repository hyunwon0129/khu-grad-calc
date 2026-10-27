// 이수 현황 시각화: 영역마다 한 줄의 막대.
// 진한 부분 = 취득, 빗금 = 수강 중, 테두리만 = 로드맵에 계획한 학점, 회색 = 남은 학점
import type { CalcResult } from '../lib/calc';
import type { Category } from '../lib/types';

interface Props {
  result: CalcResult;
  showPending: boolean;
  planned?: Map<Category, number>;
  graduationLabel?: string | null;
}

/** 막대 색 안내 (막대 바로 아래에 작게) */
export function BarLegend({ pending, planned, plannedLabel = '계획' }: { pending: boolean; planned: boolean; plannedLabel?: string }) {
  return (
    <p className="legend bar-legend">
      <span><i className="sw sw-done" aria-hidden="true" />이수한 학점</span>
      {pending && <span><i className="sw sw-ip" aria-hidden="true" />이번 학기 수강 중</span>}
      {planned && <span><i className="sw sw-plan" aria-hidden="true" />{plannedLabel}</span>}
      <span><i className="sw sw-rest" aria-hidden="true" />남은 학점</span>
    </p>
  );
}

export function Bar({ earned, pending, planned, required, label }: {
  earned: number; pending: number; planned: number; required: number; label: string;
}) {
  const done = Math.min(earned, required);
  const ip = Math.min(pending, Math.max(0, required - done));
  const pl = Math.min(planned, Math.max(0, required - done - ip));
  const pct = (n: number) => (required > 0 ? (n / required) * 100 : 0);
  const desc = `${label}: 기준 ${required}학점 중 ${earned}학점 취득${pending ? `, ${pending}학점 수강 중` : ''}${planned ? `, ${planned}학점 계획` : ''}`;
  return (
    <div className="pbar" role="img" aria-label={desc}>
      <span className="pbar-done" style={{ width: `${pct(done)}%` }} />
      <span className="pbar-ip" style={{ width: `${pct(ip)}%` }} />
      <span className="pbar-plan" style={{ width: `${pct(pl)}%` }} />
    </div>
  );
}

export default function ProgressChart({ result, showPending, planned = new Map(), graduationLabel }: Props) {
  const pendingOf = (n: number) => (showPending ? n : 0);
  const totalPending = result.areas.reduce((s, a) => s + pendingOf(a.pending), 0);
  const totalPlanned = [...planned.values()].reduce((s, v) => s + v, 0);
  const totalPct = result.totalRequired ? Math.min(100, Math.round((result.totalEarned / result.totalRequired) * 100)) : 0;

  return (
    <div className="progress">
      <div className="progress-total">
        <div className="progress-head">
          <span className="label">전공 합계</span>
          <span className="figure">
            <strong>{result.totalEarned}</strong>
            <span className="muted"> / {result.totalRequired}학점</span>
          </span>
          <span className={result.totalRemaining ? 'remain warn' : 'remain ok'}>
            {result.totalRemaining ? `${result.totalRemaining}학점 남음` : '전공 학점 충족'}
          </span>
        </div>
        <Bar earned={result.totalEarned} pending={totalPending} planned={totalPlanned} required={result.totalRequired} label="전공 합계" />
        <BarLegend pending={totalPending > 0} planned={totalPlanned > 0} plannedLabel="로드맵 계획" />
        <div className="progress-foot">
          <span className="muted">{totalPct}% 달성</span>
          {graduationLabel && <span className="grad">{graduationLabel}</span>}
        </div>
      </div>

      <div className="progress-areas">
        {result.areas.map((a) => (
          <div key={a.category} className="progress-row">
            <span className="label">{a.category}</span>
            <Bar earned={a.earned} pending={pendingOf(a.pending)} planned={planned.get(a.category) ?? 0} required={a.required} label={a.category} />
            <span className="figure">
              {a.earned}<span className="muted">/{a.required}</span>
            </span>
            <span className={a.remaining ? 'remain warn' : 'remain ok'}>
              {a.remaining ? `${a.remaining} 남음` : '완료'}
            </span>
          </div>
        ))}
      </div>

      {result.overflow > 0 && <p className="muted small">기준 초과 {result.overflow}학점은 일반선택 처리 여부를 학교 규정으로 확인하세요</p>}
    </div>
  );
}
