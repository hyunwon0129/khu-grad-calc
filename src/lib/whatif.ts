// 만약에 시뮬레이터: 계획한 과목(영역·학점)을 사정표 집계에 더해 본다. 학과 교육과정 데이터 없이 동작.
import type { SchoolCategory } from './reportLayout';
import type { AreaView } from '../components/SchoolProgress';

export interface PlannedItem {
  id: string;
  name: string;
  category: SchoolCategory;
  credit: number;
}

/** 영역별 계획 학점 합 */
export function plannedByArea(plans: PlannedItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of plans) m.set(p.category, (m.get(p.category) ?? 0) + p.credit);
  return m;
}

/** 계획을 반영한 영역별 남은 학점. 졸업학점에는 모든 계획 학점이 더해진다 */
export function applyPlans(views: AreaView[], plans: PlannedItem[]): AreaView[] {
  if (plans.length === 0) return views;
  const by = plannedByArea(plans);
  const total = plans.reduce((s, p) => s + p.credit, 0);
  return views.map((v) => {
    const add = v.group === '졸업' ? total : by.get(v.name) ?? 0;
    return { ...v, remaining: Math.max(0, v.remaining - add) };
  });
}

/** 남은 영역마다 빠르게 추가할 제안 (3학점 단위) */
export function quickAdds(views: AreaView[], plans: PlannedItem[]): { category: SchoolCategory; credit: number }[] {
  return applyPlans(views, plans)
    .filter((v) => v.group !== '졸업' && v.remaining > 0)
    .map((v) => ({ category: v.name as SchoolCategory, credit: Math.min(3, v.remaining) }));
}

let seq = 0;
export const newPlanId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;
