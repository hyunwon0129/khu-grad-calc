// 학기 학점 계획: 1학기·2학기 수강허용학점, 성적우수 추가학점(+3), 학점세이브(최대 3)
import type { CreditLimit } from '../lib/creditLimit';
import type { CreditPlan, TermLimits } from '../lib/creditPlan';
import { termLabel } from '../lib/planner';

interface Props {
  remaining: number;           // 이번 학기 이후 남은 학점
  remainingLabel: string;      // '졸업학점' 또는 '전공 학점'
  semesters: number;
  onSemesters: (n: number) => void;
  estimated: boolean;          // 남은 학기를 학번으로 추정했는가
  limits: TermLimits;
  onLimits: (l: TermLimits) => void;
  schoolLimit: CreditLimit | null;
  plan: CreditPlan;
}

export default function CreditPlanPanel({ remaining, remainingLabel, semesters, onSemesters, estimated, limits, onLimits, schoolLimit, plan }: Props) {
  const set = (patch: Partial<TermLimits>) => onLimits({ ...limits, ...patch });
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || lo));
  const changed = !!schoolLimit && (limits.first !== schoolLimit.first || limits.second !== schoolLimit.second);

  return (
    <section className="credit-plan">
      <h2>학기 학점 계획</h2>
      <p className="muted">이번 학기 이후 남은 {remainingLabel} <strong>{remaining}</strong>학점을 남은 학기에 나눠 봅니다.</p>
      <div className="toolbar">
        <label htmlFor="sem-remaining">남은 정규 학기</label>
        <input id="sem-remaining" type="number" min={0} max={12} value={semesters} className="num"
          onChange={(e) => onSemesters(num(e.target.value, 0, 12))} />
        <label htmlFor="limit-first">1학기 수강허용</label>
        <input id="limit-first" type="number" min={9} max={24} value={limits.first} className="num"
          onChange={(e) => set({ first: num(e.target.value, 1, 24) })} />
        <label htmlFor="limit-second">2학기 수강허용</label>
        <input id="limit-second" type="number" min={9} max={24} value={limits.second} className="num"
          onChange={(e) => set({ second: num(e.target.value, 1, 24) })} />
        {changed && <button type="button" className="link small" onClick={() => set({ first: schoolLimit!.first, second: schoolLimit!.second })}>학교 기준으로</button>}
      </div>
      <p className="muted small">
        {schoolLimit
          ? `학교 기준: ${schoolLimit.basis} · 1학기 ${schoolLimit.first}학점, 2학기 ${schoolLimit.second}학점 (2026 학사제도안내 64쪽).`
          : '수강허용학점은 단과대학·학번마다 다릅니다(2026 학사제도안내 64쪽). 학과를 알 수 없어 18학점으로 두었습니다.'}
        {estimated && ' 남은 학기는 휴학 없이 8학기에 졸업한다고 보고 계산했습니다.'}
      </p>

      <fieldset className="credit-extra">
        <legend>다음 학기에만 더 들을 수 있는 학점</legend>
        <label className="consent" htmlFor="honors-bonus">
          <input id="honors-bonus" type="checkbox" checked={limits.honorsBonus} onChange={(e) => set({ honorsBonus: e.target.checked })} />
          <span>직전 학기 평점 3.9 이상 <strong>+3학점</strong></span>
        </label>
        <p className="muted small">성적우수자 추가학점: 직전 학기 15학점 이상 수강, F·N 없음, 수강철회 없음일 때 바로 다음 학기에만 (70쪽). 세이브할 수 없습니다.</p>
        <div className="toolbar">
          <label htmlFor="saved-credits">학점세이브</label>
          <input id="saved-credits" type="number" min={0} max={3} value={limits.saved} className="num"
            onChange={(e) => set({ saved: num(e.target.value, 0, 3) })} />
          <span className="muted small">학점 (최대 3)</span>
        </div>
        <p className="muted small">직전 학기에 수강허용학점보다 덜 들은 만큼(최대 3학점) 다음 학기에 더 들을 수 있습니다. 직전 학기 평점 2.5 미만·F 있음·수강철회·최소 학점 미만이면 안 됩니다 (71쪽).</p>
        <p className="muted small">평점은 저장하지 않습니다. 체크 여부도 이 화면에서만 씁니다.</p>
      </fieldset>

      {remaining <= 0 ? (
        <p className="ok">더 채울 {remainingLabel}이 없습니다.</p>
      ) : semesters <= 0 ? (
        <p className="warn">남은 정규 학기가 없습니다. 계절학기나 추가 학기(수업연한 초과)가 필요합니다.</p>
      ) : (
        <>
          <table className="credit-table">
            <thead><tr><th>학기</th><th>최대</th><th>고르게 나누면</th></tr></thead>
            <tbody>
              {plan.rows.map((r, i) => (
                <tr key={r.term}>
                  <td>{termLabel(r.term)}{i === 0 && <span className="chip ok-chip">다음 학기</span>}</td>
                  <td>{r.max}학점{r.extra > 0 && <span className="muted small"> (+{r.extra})</span>}</td>
                  <td><strong>{r.planned}</strong>학점</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>합계</td><td>{plan.capacity}학점</td><td>{Math.min(remaining, plan.capacity)} / {remaining}학점</td></tr></tfoot>
          </table>
          {plan.shortfall > 0
            ? <p className="warn">남은 학기 최대 학점({plan.capacity})보다 {plan.shortfall}학점 많습니다. 계절학기나 추가 학기가 필요할 수 있습니다.</p>
            : <p className="ok">남은 {semesters}학기 안에 졸업학점을 채울 수 있습니다 · 여유 {plan.capacity - remaining}학점</p>}
        </>
      )}
    </section>
  );
}
