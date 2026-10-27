// 학기별 학점 계획: 1학기·2학기 수강허용학점이 다를 수 있고, 다음 학기에만 성적우수 추가학점(+3)과 세이브학점(최대 3)을 더한다.
// 근거: 2026 학사제도안내 64쪽 수강허용학점, 70쪽 성적우수자 추가학점 부여제도, 71쪽 학점세이브제도
import { nextTerm } from './planner';

export interface TermLimits {
  first: number;       // 홀수 학기(1학기) 수강허용학점
  second: number;      // 짝수 학기(2학기)
  honorsBonus: boolean; // 직전 학기 평점 3.9 이상 → 다음 학기 +3
  saved: number;        // 세이브학점 0~3 → 다음 학기에만
}

export interface TermRow { term: string; max: number; planned: number; extra: number }
export interface CreditPlan { rows: TermRow[]; capacity: number; shortfall: number; perTermEven: number | null }

export function termMax(l: TermLimits, term: string, isNext: boolean): { max: number; extra: number } {
  const s = Number(term.split('-')[1]);
  const base = s === 1 ? l.first : l.second;
  const extra = isNext ? (l.honorsBonus ? 3 : 0) + Math.max(0, Math.min(3, l.saved)) : 0;
  return { max: base + extra, extra };
}

/** 남은 학점을 학기별 상한 안에서 고르게 나눈다 (앞 학기부터 채우되 평균을 넘기지 않게) */
export function planCredits(remaining: number, nowTerm: string, semesters: number, l: TermLimits): CreditPlan {
  const terms: { term: string; max: number; extra: number }[] = [];
  let t = nowTerm;
  for (let i = 0; i < semesters; i++) { t = nextTerm(t); terms.push({ term: t, ...termMax(l, t, i === 0) }); }
  const capacity = terms.reduce((s, x) => s + x.max, 0);
  // 물 채우기: 가능한 한 고르게
  const planned = terms.map(() => 0);
  let left = Math.min(remaining, capacity);
  while (left > 0) {
    const open = terms.map((_x, i) => i).filter((i) => planned[i] < terms[i].max);
    if (!open.length) break;
    const share = Math.max(1, Math.floor(left / open.length));
    for (const i of open) {
      const add = Math.min(share, terms[i].max - planned[i], left);
      planned[i] += add; left -= add;
      if (left <= 0) break;
    }
  }
  return {
    rows: terms.map((x, i) => ({ term: x.term, max: x.max, planned: planned[i], extra: x.extra })),
    capacity,
    shortfall: Math.max(0, remaining - capacity),
    perTermEven: semesters > 0 ? Math.ceil(remaining / semesters) : null,
  };
}
