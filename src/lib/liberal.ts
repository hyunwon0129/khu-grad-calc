// 교양(후마니타스칼리지) 이수 현황과 더 들어야 할 것
// 기준: 2026학년도 교양교육과정 기본구조표 — 필수교과 17학점(6과목), 배분이수 5개 영역 중 3개 영역 9학점 이상,
//       자유이수 3학점 이상(전공탐색및기업가정신세미나 필수), 합계 29학점 이상 (2024학번 이후)
import type { Course, TakenCourse } from './types';

export interface LiberalCourse { code: string; name: string; credit: number; kind: '필수' | '배분' | '자유'; area: number | null; year: number; s1: boolean; s2: boolean }
export interface LiberalData {
  source: string;
  basis: string;
  areas: Record<string, string>;
  required: { name: string; codes: string[]; credit: number; year: number; after?: string }[];
  requiredFree: { name: string; codes: string[]; alt?: string; note?: string };
  rules: { 필수: number; 배분: number; 배분영역: number; 자유: number; 총: number };
  courses: LiberalCourse[];
}

export type ItemState = 'done' | 'ongoing' | 'todo';

export interface LiberalStatus {
  required: { name: string; credit: number; year: number; state: ItemState; note?: string }[];
  areaState: { area: number; name: string; state: ItemState; courses: string[] }[];
  areaCovered: number;            // 이수(또는 수강 중)로 확인된 영역 수
  coveredEst: number;             // 영역 모르는 과목까지 서로 다른 영역으로 셌을 때
  unknownAreaCourses: string[];   // 배분 과목인데 영역을 모르는 과목
  credits: { 필수: number; 배분: number; 자유: number };  // 과목으로 센 학점 (수강 중 포함)
  freeSeminar: ItemState;
  suggestions: { area: number; name: string; courses: LiberalCourse[] }[];
  freeSuggestions: LiberalCourse[];
  nextSemester: 1 | 2;
}

const norm = (s: string) => s.replace(/[\s()·･:;]/g, '');

export function analyzeLiberal(
  data: LiberalData,
  taken: TakenCourse[],
  courseMap: Map<string, Course>,
  opts: { nextSemester: 1 | 2; schoolCategory?: Record<string, string> } = { nextSemester: 1 },
): LiberalStatus {
  const byCode = new Map(data.courses.map((c) => [c.code, c]));
  const byName = new Map(data.courses.map((c) => [norm(c.name), c]));
  const stateOf = (t: TakenCourse): ItemState => (t.status === 'IN_PROGRESS' ? 'ongoing' : 'done');
  const better = (a: ItemState, b: ItemState): ItemState => (a === 'done' || b === 'done' ? 'done' : a === 'ongoing' || b === 'ongoing' ? 'ongoing' : 'todo');

  // 들은 과목을 교양 과목으로 해석 (학수번호 → 과목명 순)
  const mine = taken.map((t) => {
    const name = courseMap.get(t.code)?.name ?? '';
    const lc = byCode.get(t.code) ?? (name ? byName.get(norm(name)) : undefined);
    return { t, name: lc?.name ?? name, lc, state: stateOf(t), credit: courseMap.get(t.code)?.credit ?? lc?.credit ?? 0 };
  });

  const required = data.required.map((r) => {
    let st: ItemState = 'todo';
    for (const m of mine) {
      if (r.codes.includes(m.t.code) || norm(m.name) === norm(r.name)) st = better(st, m.state);
    }
    return { name: r.name, credit: r.credit, year: r.year, state: st, note: r.after ? `${r.after} 다음에` : undefined };
  });

  const areaHit = new Map<number, { state: ItemState; courses: string[] }>();
  const unknownAreaCourses: string[] = [];
  const credits = { 필수: 0, 배분: 0, 자유: 0 };
  let freeSeminar: ItemState = 'todo';
  for (const m of mine) {
    const school = opts.schoolCategory?.[m.t.code];
    const kind = m.lc?.kind ?? (school === '교양필수' ? '필수' : school === '배분이수' ? '배분' : school === '자유이수' ? '자유' : null);
    if (!kind) continue;
    credits[kind] += m.credit;
    if (kind === '배분') {
      if (m.lc?.area) {
        const cur = areaHit.get(m.lc.area) ?? { state: 'todo' as ItemState, courses: [] };
        areaHit.set(m.lc.area, { state: better(cur.state, m.state), courses: [...cur.courses, m.name] });
      } else unknownAreaCourses.push(m.name || m.t.code);
    }
    if (kind === '자유' && (data.requiredFree.codes.includes(m.t.code) || norm(m.name) === norm(data.requiredFree.name) || (data.requiredFree.alt && norm(m.name) === norm(data.requiredFree.alt)))) {
      freeSeminar = better(freeSeminar, m.state);
    }
  }

  const areaState = Object.entries(data.areas).map(([k, name]) => {
    const a = Number(k); const h = areaHit.get(a);
    return { area: a, name, state: h?.state ?? 'todo', courses: h?.courses ?? [] };
  });
  const areaCovered = areaState.filter((a) => a.state !== 'todo').length;

  const takenCodes = new Set(taken.map((t) => t.code));
  const sem = opts.nextSemester;
  const offered = (c: LiberalCourse) => (sem === 1 ? c.s1 : c.s2);
  // 아직 안 채운 영역에서 다음 학기 개설 과목 추천 (영역을 이미 3개 채웠으면 추천 안 함)
  // 영역을 모르는 배분 과목은 서로 다른 영역이라고 보고 센다 (학교 집계 우선)
  const coveredEst = Math.min(data.rules.배분영역, areaCovered + unknownAreaCourses.length);
  const needAreas = coveredEst >= data.rules.배분영역 ? [] : areaState.filter((a) => a.state === 'todo');
  const suggestions = needAreas.map((a) => ({
    area: a.area,
    name: a.name,
    courses: data.courses.filter((c) => c.kind === '배분' && c.area === a.area && !takenCodes.has(c.code) && offered(c)).slice(0, 4),
  }));
  const freeSuggestions = freeSeminar === 'todo'
    ? data.courses.filter((c) => data.requiredFree.codes.includes(c.code))
    : [];

  return { required, areaState, areaCovered, coveredEst, unknownAreaCourses, credits, freeSeminar, suggestions, freeSuggestions, nextSemester: sem };
}
