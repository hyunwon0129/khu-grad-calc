// 요건 조회와 학점 계산 (개발가이드 7.1~7.2)
import type { Course, Program, Profile, TakenCourse, Category } from './types';

export interface AreaResult {
  category: Category;
  required: number;
  earned: number;
  pending: number;   // 수강 중(미확정) 학점
  remaining: number;
}

export interface CalcResult {
  areas: AreaResult[];
  totalRequired: number;
  totalEarned: number;
  totalRemaining: number;
  overflow: number;
}

/** 입학연도가 범위에 드는 과정을 찾고, 없으면 가장 가까운 이전 연도 과정을 반환 */
export function findProgram(
  programs: Program[],
  profile: Profile,
  kind: Program['kind'] = 'MAJOR',
): { program: Program | undefined; exact: boolean } {
  const pool = programs.filter(
    (p) => p.kind === kind && p.campus === profile.campus && p.department === profile.department,
  );
  const y = profile.admissionYear;
  const exact = pool.find((p) => p.admissionYearRange[0] <= y && y <= p.admissionYearRange[1]);
  if (exact) return { program: exact, exact: true };
  const earlier = pool
    .filter((p) => p.admissionYearRange[1] < y)
    .sort((a, b) => b.admissionYearRange[1] - a.admissionYearRange[1])[0];
  return { program: earlier, exact: false };
}

/** (학수번호, 학기) 기준 중복 제거. 재수강은 학기가 달라 유지 */
export function dedupe(taken: TakenCourse[]): TakenCourse[] {
  const seen = new Set<string>();
  return taken.filter((t) => {
    const key = `${t.code}|${t.term}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function calculate(
  program: Program,
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
  includeInProgress = false,
): CalcResult {
  const earned = new Map<Category, number>();
  const pending = new Map<Category, number>();
  const counted = new Set<string>(); // 같은 과목 재수강은 한 번만 인정

  for (const t of dedupe(taken)) {
    const course = courseMap.get(t.code);
    const type = course?.typeByProgram[program.programId];
    if (!course || !type) continue;
    if (t.status === 'IN_PROGRESS' && !includeInProgress) {
      pending.set(type, (pending.get(type) ?? 0) + course.credit);
      continue;
    }
    if (counted.has(t.code)) continue;
    counted.add(t.code);
    earned.set(type, (earned.get(type) ?? 0) + course.credit);
  }

  let overflow = 0;
  const areas = program.requirements.map((r) => {
    const e = earned.get(r.category) ?? 0;
    overflow += Math.max(0, e - r.minCredits);
    return {
      category: r.category,
      required: r.minCredits,
      earned: e,
      pending: pending.get(r.category) ?? 0,
      remaining: Math.max(0, r.minCredits - e),
    };
  });

  const totalEarned = [...earned.values()].reduce((a, b) => a + b, 0);
  return {
    areas,
    totalRequired: program.totalMin,
    totalEarned,
    totalRemaining: Math.max(0, program.totalMin - totalEarned),
    overflow,
  };
}
