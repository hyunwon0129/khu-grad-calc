// 선수과목·택1 규칙 공통 처리
// - 선수과목 'A|B' 는 둘 중 하나만 들어도 된다 (예: 기초프로그래밍 또는 웹/파이선프로그래밍)
// - choiceGroups 는 '택1' 묶음: 하나를 들었거나 계획에 넣으면 나머지는 필요 없다
import type { Program } from './types';

/** 후수과목 → 선수과목 목록 */
export function prereqMap(program: Program): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [pre, post] of program.diagram?.edges ?? []) m.set(post, [...(m.get(post) ?? []), pre]);
  return m;
}

/** 선수과목 목록을 모두 충족했는가 ('A|B'는 하나만 있으면 충족) */
export function prereqsMet(pres: string[] | undefined, has: (code: string) => boolean): boolean {
  return (pres ?? []).every((p) => p.split('|').some(has));
}

/** 같은 택1 묶음의 다른 과목을 이미 들었거나 계획했으면 true */
export function choiceBlocked(program: Program, code: string, have: Set<string>): boolean {
  return (program.choiceGroups ?? []).some((g) => g.includes(code) && g.some((x) => x !== code && have.has(x)));
}

/** 택1 묶음에 속한 과목이면 그 묶음 */
export function choiceGroupOf(program: Program, code: string): string[] | undefined {
  return (program.choiceGroups ?? []).find((g) => g.includes(code));
}
