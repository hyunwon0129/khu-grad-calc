import { describe, expect, it } from 'vitest';
import { applyPlans, quickAdds, type PlannedItem } from './whatif';
import type { AreaView } from '../components/SchoolProgress';

const v = (group: AreaView['group'], name: string, remaining: number): AreaView =>
  ({ group, name, earned: 0, required: 0, done: 0, pending: 0, remaining });
const views = [v('졸업', '졸업학점', 66), v('전공', '전공필수', 3), v('교양', '배분이수', 3), v('교양', '자유이수', 1)];
const plan = (category: PlannedItem['category'], credit: number): PlannedItem => ({ id: category + credit, name: '', category, credit });

describe('만약에 시뮬레이터', () => {
  it('계획 학점을 영역과 졸업학점에서 뺀다', () => {
    const out = applyPlans(views, [plan('전공필수', 3), plan('일반선택', 3)]);
    expect(out.find((x) => x.name === '졸업학점')?.remaining).toBe(60);
    expect(out.find((x) => x.name === '전공필수')?.remaining).toBe(0);
    expect(out.find((x) => x.name === '배분이수')?.remaining).toBe(3);
  });

  it('0 아래로 내려가지 않음', () => {
    expect(applyPlans(views, [plan('자유이수', 3)]).find((x) => x.name === '자유이수')?.remaining).toBe(0);
  });

  it('남은 영역만 빠른 추가 제안', () => {
    expect(quickAdds(views, [plan('전공필수', 3)])).toEqual([
      { category: '배분이수', credit: 3 },
      { category: '자유이수', credit: 1 },
    ]);
  });
});
