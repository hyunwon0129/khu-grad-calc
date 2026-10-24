// 추천 알고리즘 간소화 버전 (체크리스트 문서 2장)
import type { Course, Program, TakenCourse } from './types';
import { calculate } from './calc';

const TYPE_PRIORITY: Record<string, number> = { 전필: 0, 전기: 1, 전선: 2 };

export interface NextCourse {
  code: string;
  name: string;
  credit: number;
  type: string;
  year: number;
  semester: number;
  available: boolean;       // 선수과목 충족 여부
  missingPrereqs: string[]; // 부족한 선수과목 이름
  fillsGap: boolean;        // 잔여 학점이 남은 영역의 과목인가
}

/** 1) 다음 과목 추천: 선수과목 필터 → 이수구분 우선순위 → 권장 학년 */
export function recommendNext(
  program: Program,
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
): NextCourse[] {
  const done = new Set(taken.filter((t) => t.status === 'TAKEN').map((t) => t.code));
  const inProgress = new Set(taken.filter((t) => t.status === 'IN_PROGRESS').map((t) => t.code));
  const gaps = new Set(
    calculate(program, courseMap, taken).areas.filter((a) => a.remaining > 0).map((a) => a.category),
  );
  const prereqs = new Map<string, string[]>();
  for (const [pre, post] of program.diagram?.edges ?? []) {
    prereqs.set(post, [...(prereqs.get(post) ?? []), pre]);
  }
  const nodeOf = new Map((program.diagram?.nodes ?? []).map((n) => [n.code, n]));

  return program.courses
    .filter((code) => !done.has(code) && !inProgress.has(code) && courseMap.has(code))
    .map((code) => {
      const c = courseMap.get(code)!;
      const type = c.typeByProgram[program.programId] ?? '기타';
      const missing = (prereqs.get(code) ?? []).filter((p) => !done.has(p) && !inProgress.has(p));
      const node = nodeOf.get(code);
      return {
        code,
        name: c.name,
        credit: c.credit,
        type,
        year: node?.year ?? 9,
        semester: node?.semester ?? 1,
        available: missing.length === 0,
        missingPrereqs: missing.map((m) => courseMap.get(m)?.name ?? m),
        fillsGap: gaps.has(type),
      };
    })
    .sort(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        Number(b.fillsGap) - Number(a.fillsGap) ||
        (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9) ||
        a.year - b.year ||
        a.semester - b.semester,
    );
}

export interface TrackProgress {
  name: string;
  earned: number;
  required: number;
  rate: number;
}

export function trackProgress(program: Program, courseMap: Map<string, Course>, taken: TakenCourse[]): TrackProgress[] {
  const done = new Set(taken.filter((t) => t.status === 'TAKEN').map((t) => t.code));
  return (program.diagram?.tracks ?? [])
    .map((t) => {
      const earned = t.courses.filter((c) => done.has(c)).reduce((s, c) => s + (courseMap.get(c)?.credit ?? 0), 0);
      return { name: t.name, earned, required: t.minCredits, rate: t.minCredits ? earned / t.minCredits : 0 };
    })
    .sort((a, b) => b.rate - a.rate || a.required - a.earned - (b.required - b.earned));
}

export interface ProgramCandidate {
  program: Program;
  overlapCredits: number;
  overlapCount: number;
  neededCredits: number;
  semestersNeeded: number;
  feasible: boolean;
  reason: string;
  policyUnknown: boolean;
}

/** 2) 다전공·MD 추천: 겹치는 학점 → 추가 필요 학점 → 남은 학기 안에 가능한지 */
export function recommendPrograms(
  candidates: Program[],
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
  majorRemaining: number,
  semestersLeft: number,
  creditsPerSemester = 18,
): ProgramCandidate[] {
  const done = new Set(taken.filter((t) => t.status === 'TAKEN').map((t) => t.code));
  const capacity = semestersLeft * creditsPerSemester;

  return candidates
    .map((p) => {
      const overlap = p.courses.filter((c) => done.has(c));
      let overlapCredits = overlap.reduce((s, c) => s + (courseMap.get(c)?.credit ?? 0), 0);
      const policy = p.overlapPolicy?.withMajor;
      if (policy === 'NONE') overlapCredits = 0;
      else if (policy && typeof policy === 'object') overlapCredits = Math.min(overlapCredits, policy.limit);
      const needed = Math.max(0, p.totalMin - overlapCredits);
      const semestersNeeded = Math.ceil(needed / creditsPerSemester);
      return {
        program: p,
        overlapCredits,
        overlapCount: overlap.length,
        neededCredits: needed,
        semestersNeeded,
        feasible: needed + majorRemaining <= capacity,
        reason: `이미 ${overlap.length}과목(${overlapCredits}학점) 인정, 추가 ${needed}학점 필요, 약 ${semestersNeeded}학기`,
        policyUnknown: !policy,
      };
    })
    .sort((a, b) => Number(b.feasible) - Number(a.feasible) || a.neededCredits - b.neededCredits);
}
