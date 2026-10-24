// 이수 현황 시각화: 영역마다 한 줄의 막대. 진한 부분 = 취득, 빗금 = 수강 중, 빈 부분 = 잔여
import type { CalcResult } from '../lib/calc';

interface Props {
  result: CalcResult;
  showPending: boolean;
}

function Bar({ earned, pending, required, label }: { earned: number; pending: number; required: number; label: string }) {
  const done = Math.min(earned, required);
  const ip = Math.min(pending, Math.max(0, required - done));
  const pct = (n: number) => (required > 0 ? (n / required) * 100 : 0);
  const desc = `${label}: 기준 ${required}학점 중 ${earned}학점 취득${pending ? `, ${pending}학점 수강 중` : ''}`;
  return (
    <div className="pbar" role="img" aria-label={desc}>
      <span className="pbar-done" style={{ width: `${pct(done)}%` }} />
      <span className="pbar-ip" style={{ width: `${pct(ip)}%` }} />
    </div>
  );
}

export default function ProgressChart({ result, showPending }: Props) {
  const totalPending = showPending ? result.areas.reduce((s, a) => s + a.pending, 0) : 0;
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
        <Bar earned={result.totalEarned} pending={totalPending} required={result.totalRequired} label="전공 합계" />
        <span className="muted">{totalPct}% 달성</span>
      </div>

      <div className="progress-areas">
        {result.areas.map((a) => (
          <div key={a.category} className="progress-row">
            <span className="label">{a.category}</span>
            <Bar earned={a.earned} pending={showPending ? a.pending : 0} required={a.required} label={a.category} />
            <span className="figure">
              {a.earned}<span className="muted">/{a.required}</span>
            </span>
            <span className={a.remaining ? 'remain warn' : 'remain ok'}>
              {a.remaining ? `${a.remaining} 남음` : '완료'}
            </span>
          </div>
        ))}
      </div>

      <div className="legend" aria-hidden="true">
        <span><i className="sw sw-done" />취득</span>
        {showPending && totalPending > 0 && <span><i className="sw sw-ip" />수강 중</span>}
        <span><i className="sw sw-rest" />남은 학점</span>
        {result.overflow > 0 && <span className="muted">기준 초과 {result.overflow}학점은 일반선택 처리 여부를 학교 규정으로 확인하세요</span>}
      </div>
    </div>
  );
}
