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
      <h2>학점 계획</h2>
      <p className="muted">남은 {remainingLabel} <strong>{remaining}</strong>학점을 학기별로 나눠 봐요</p>
      <div className="fields">
        <label className="field" htmlFor="sem-remaining">남은 정규 학기
          <input id="sem-remaining" type="number" min={0} max={12} value={semesters} className="num"
            onChange={(e) => onSemesters(num(e.target.value, 0, 12))} />
        </label>
        <label className="field" htmlFor="limit-first">1학기 수강허용
          <input id="limit-first" type="number" min={9} max={24} value={limits.first} className="num"
            onChange={(e) => set({ first: num(e.target.value, 1, 24) })} />
        </label>
        <label className="field" htmlFor="limit-second">2학기 수강허용
          <input id="limit-second" type="number" min={9} max={24} value={limits.second} className="num"
            onChange={(e) => set({ second: num(e.target.value, 1, 24) })} />
        </label>
      </div>
      {changed && <button type="button" className="link small" onClick={() => set({ first: schoolLimit!.first, second: schoolLimit!.second })}>학교 기준으로 되돌리기</button>}
      <p className="muted small">
        {schoolLimit
          ? `학교 기준 ${schoolLimit.basis} · ${schoolLimit.first}/${schoolLimit.second}학점 (학사제도안내 64쪽)`
          : '학과를 몰라 18학점으로 두었어요 (학사제도안내 64쪽)'}
        {estimated && ' · 남은 학기는 휴학 없이 8학기 기준'}
      </p>

      <fieldset className="credit-extra">
        <legend>다음 학기에만 더 들을 수 있는 학점</legend>
        <label className="consent" htmlFor="honors-bonus">
          <input id="honors-bonus" type="checkbox" checked={limits.honorsBonus} onChange={(e) => set({ honorsBonus: e.target.checked })} />
          <span>직전 학기 평점 3.9 이상 <strong>+3학점</strong></span>
        </label>

        <div className="toolbar">
          <label htmlFor="saved-credits">학점세이브</label>
          <input id="saved-credits" type="number" min={0} max={3} value={limits.saved} className="num"
            onChange={(e) => set({ saved: num(e.target.value, 0, 3) })} />
          <span className="muted small">학점 (최대 3)</span>
        </div>
        <details className="acc-inner">
          <summary>조건 보기</summary>
          <ul className="muted small">
            <li>성적우수 +3: 직전 학기 15학점 이상, F·N·수강철회 없음. 바로 다음 학기에만, 세이브 불가 (70쪽)</li>
            <li>학점세이브: 덜 들은 만큼 최대 3학점. 직전 학기 평점 2.5 미만·F·수강철회·최소 학점 미만이면 불가 (71쪽)</li>
            <li>평점은 저장하지 않아요</li>
          </ul>
        </details>
      </fieldset>

      {remaining <= 0 ? (
        <p className="ok">더 채울 {remainingLabel}이 없어요</p>
      ) : semesters <= 0 ? (
        <p className="warn">남은 정규 학기가 없어요 · 계절학기나 추가 학기가 필요해요</p>
      ) : (
        <>
          <table className="credit-table">
            <thead><tr><th>학기</th><th>최대</th><th>고르게 나누면</th></tr></thead>
            <tbody>
              {plan.rows.map((r, i) => (
                <tr key={r.term}>
                  <td>{termLabel(r.term)}{i === 0 && <span className="chip info-chip">다음 학기</span>}</td>
                  <td>{r.max}학점{r.extra > 0 && <span className="muted small"> (+{r.extra})</span>}</td>
                  <td><strong>{r.planned}</strong>학점</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>합계</td><td>{plan.capacity}학점</td><td>{Math.min(remaining, plan.capacity)} / {remaining}학점</td></tr></tfoot>
          </table>
          {plan.shortfall > 0
            ? <p className="warn">최대 {plan.capacity}학점보다 {plan.shortfall}학점 많아요 · 계절학기나 추가 학기가 필요할 수 있어요</p>
            : <p className="ok">남은 {semesters}학기 안에 채울 수 있어요 · 여유 {plan.capacity - remaining}학점</p>}
        </>
      )}
    </section>
  );
}
