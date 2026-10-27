// 학기별 로드맵: 남은 요건을 채우는 과목을 선수과목·권장 학기·학기당 학점 상한에 맞춰 배치한다.
// 개설 여부(시간표) 데이터가 없으므로 권장 학기만 참고한다.
import type { Course, Program, TakenCourse, Category } from './types';
import { calculate } from './calc';
import { prereqMap, prereqsMet, choiceBlocked } from './prereq';

export interface PlannedCourse {
  code: string;
  name: string;
  credit: number;
  type: Category;
  offParity: boolean; // 권장 학기(1·2학기)와 다른 학기에 배치됨
}

export interface PlanSemester {
  term: string; // "2027-1"
  courses: PlannedCourse[];
  credits: number;
}

export interface Plan {
  semesters: PlanSemester[];
  plannedByCategory: Map<Category, number>;
  graduationTerm: string | null;  // 전공 요건이 모두 채워지는 학기 (이미 충족이면 '충족')
  shortfall: { category: Category; credits: number }[]; // 과목이 모자라 계획으로도 못 채우는 학점
  blocked: string[]; // 선수과목 때문에 배치하지 못한 과목명
}

const PRIORITY: Record<string, number> = { 전필: 0, 전기: 1, 전선: 2 };

export function nextTerm(term: string): string {
  const [y, s] = term.split('-').map(Number);
  return s === 1 ? `${y}-2` : `${y + 1}-1`;
}

export function planRoadmap(
  program: Program,
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
  options: { fromTerm: string; maxCreditsPerSemester: number; excluded?: Set<string>; maxSemesters?: number },
): Plan {
  const { fromTerm, maxCreditsPerSemester, excluded = new Set(), maxSemesters = 8 } = options;
  // 수강 중 과목은 이수할 것으로 보고 계획한다
  const base = calculate(program, courseMap, taken, true);
  const need = new Map(base.areas.map((a) => [a.category, a.remaining]));
  let totalNeed = base.totalRemaining;

  const done = new Set(taken.map((t) => t.code));
  const prereqs = prereqMap(program);
  const nodeOf = new Map((program.diagram?.nodes ?? []).map((n) => [n.code, n]));

  let pool = program.courses.filter((c) => !done.has(c) && !excluded.has(c) && courseMap.get(c)?.typeByProgram[program.programId]);
  pool = pool.filter((c) => !choiceBlocked(program, c, done));
  const semesters: PlanSemester[] = [];
  const plannedByCategory = new Map<Category, number>();
  const placed = new Set<string>();
  const stillNeeded = () => totalNeed > 0 || [...need.values()].some((v) => v > 0);

  let term = fromTerm;
  for (let i = 0; i < maxSemesters && stillNeeded(); i++, term = nextTerm(term)) {
    const parity = Number(term.split('-')[1]);
    const available = pool
      .filter((c) => prereqsMet(prereqs.get(c), (x) => done.has(x) || placed.has(x)))
      .filter((c) => !choiceBlocked(program, c, placed))
      .map((code) => {
        const c = courseMap.get(code)!;
        const type = c.typeByProgram[program.programId];
        const node = nodeOf.get(code);
        return { c, type, node, offParity: !!node && !node.both && node.semester !== parity };
      })
      .filter((x) => (need.get(x.type) ?? 0) > 0 || (totalNeed > 0 && !need.has(x.type)))
      .sort(
        (a, b) =>
          Number(a.offParity) - Number(b.offParity) ||
          (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9) ||
          (a.node?.year ?? 9) - (b.node?.year ?? 9),
      );

    const sem: PlanSemester = { term, courses: [], credits: 0 };
    for (const x of available) {
      if (choiceBlocked(program, x.c.code, new Set(sem.courses.map((c) => c.code)))) continue;
      if (sem.credits + x.c.credit > maxCreditsPerSemester) continue;
      if ((need.get(x.type) ?? 0) <= 0 && need.has(x.type)) continue; // 같은 학기에 이미 채워짐
      sem.courses.push({ code: x.c.code, name: x.c.name, credit: x.c.credit, type: x.type, offParity: x.offParity });
      sem.credits += x.c.credit;
      if (need.has(x.type)) need.set(x.type, (need.get(x.type) ?? 0) - x.c.credit);
      totalNeed -= x.c.credit;
      plannedByCategory.set(x.type, (plannedByCategory.get(x.type) ?? 0) + x.c.credit);
    }
    // 같은 학기 안에서는 선수·후수를 함께 듣지 않도록 학기가 끝난 뒤 placed에 반영
    sem.courses.forEach((c) => placed.add(c.code));
    pool = pool.filter((c) => !placed.has(c));
    if (sem.courses.length === 0) break; // 더 배치할 수 있는 과목이 없음
    semesters.push(sem);
  }

  const shortfall = [...need.entries()].filter(([, v]) => v > 0).map(([category, credits]) => ({ category, credits }));
  const blocked = pool
    .filter((c) => !prereqsMet(prereqs.get(c), (x) => done.has(x) || placed.has(x)))
    .map((c) => courseMap.get(c)?.name ?? c);

  let graduationTerm: string | null = null;
  if (!stillNeeded()) graduationTerm = semesters.length ? semesters[semesters.length - 1].term : '충족';

  return { semesters, plannedByCategory, graduationTerm, shortfall, blocked };
}

/** "2027-1" → "2027년 1학기" */
export function termLabel(term: string): string {
  const [y, s] = term.split('-');
  return `${y}년 ${s}학기`;
}
