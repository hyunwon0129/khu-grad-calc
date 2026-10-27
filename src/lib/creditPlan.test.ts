import { describe, expect, it } from 'vitest';
import { planCredits, termMax } from './creditPlan';

describe('학기별 학점 계획', () => {
  const l = { first: 18, second: 15, honorsBonus: false, saved: 0 };
  it('1학기 18 · 2학기 15처럼 학기마다 상한이 다르다', () => {
    const p = planCredits(100, '2026-2', 3, l); // 2027-1, 2027-2, 2028-1
    expect(p.rows.map((r) => r.max)).toEqual([18, 15, 18]);
    expect(p.capacity).toBe(51);
    expect(p.shortfall).toBe(49);
  });
  it('성적우수(+3)와 세이브(최대 3)는 다음 학기에만 붙는다', () => {
    const b = { ...l, honorsBonus: true, saved: 5 };
    expect(termMax(b, '2027-1', true)).toEqual({ max: 24, extra: 6 });
    expect(termMax(b, '2027-2', false)).toEqual({ max: 15, extra: 0 });
  });
  it('남은 학점을 상한 안에서 고르게 나눈다', () => {
    const p = planCredits(40, '2026-2', 3, l);
    expect(p.rows.reduce((s, r) => s + r.planned, 0)).toBe(40);
    expect(p.rows.every((r) => r.planned <= r.max)).toBe(true);
    expect(p.shortfall).toBe(0);
  });
});

import { multiRequired } from './requirements';
describe('졸업요건 ⑫ 다전공·MD·부전공 1개 이상', () => {
  it('2026학번부터, 의학·간호·약학계열은 제외(약과학과는 적용)', () => {
    expect(multiRequired(2025, { college: '공과대학', name: '산업경영공학과' })).toBe(false);
    expect(multiRequired(2026, { college: '공과대학', name: '산업경영공학과' })).toBe(true);
    expect(multiRequired(2026, { college: '간호과학대학', name: '간호학과' })).toBe(false);
    expect(multiRequired(2026, { college: '약학대학', name: '약학과(6년제)' })).toBe(false);
    expect(multiRequired(2026, { college: '약학대학', name: '약과학과' })).toBe(true);
    expect(multiRequired(null, null)).toBeNull();
  });
});
