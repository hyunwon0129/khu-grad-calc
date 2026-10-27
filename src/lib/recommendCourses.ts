// 다음 학기 과목 추천 (점수 방식)
// 각 과목에 점수를 매겨 높은 순으로 보여 준다. 점수 이유는 화면에 그대로 표시한다.
//  - 꼭 들어야 하는 과목(전공필수, 모두 들어야 하는 전공기초)   +40
//  - 아직 학점이 남은 영역의 과목                              +10 ~ +25 (남은 비율만큼)
//  - 다른 과목의 선수과목이라 먼저 들어야 하는 과목             과목당 +6 (최대 +18)
//  - 권장 학년이 지금 학년 이하(늦어지고 있음)                  +10, 더 늦으면 +15
//  - 다음 학기에 개설되는 과목                                  +8 / 다음 학기 미개설 −20
//  - 관심 다전공에서도 인정되는 과목                            +12 (묶음에 최소 1과목은 꼭 넣음)
//  - 권장 학년보다 2학년 이상 이른 과목                          학년 차이마다 −6
// 선수과목을 아직 안 들은 과목은 '선수과목 먼저' 목록으로 따로 보낸다.
import type { Category, Course, Program, TakenCourse } from './types';
import { calculate } from './calc';
import { choiceBlocked, choiceGroupOf, prereqMap, prereqsMet } from './prereq';
import { nextTerm } from './planner';

export interface Reason { label: string; kind: 'must' | 'gap' | 'unlock' | 'late' | 'term' | 'multi' | 'early' | 'off' }

export interface ScoredCourse {
  code: string;
  name: string;
  credit: number;
  type: Category;
  year: number | null;
  score: number;
  reasons: Reason[];
  offeredNext: boolean | null;   // 다음 학기 개설 여부(교육과정 기준), 모르면 null
  missingPrereqs: string[];      // 아직 안 들은 선수과목 이름
  choiceWith: string[];          // 택1로 묶인 다른 과목 이름
}

export interface RecommendOptions {
  nowTerm: string;                     // 이번 학기 "2026-2"
  admissionYear: number | null;
  gaps?: Map<Category, number>;        // 영역별 남은 학점 (사정표 값이 있으면 그것)
  multiProgram?: Program | null;       // 관심 다전공
  maxCredits?: number;                 // 다음 학기 묶음 학점 상한 (전공 과목)
}

export interface Recommendation {
  term: string;
  studentYear: number | null;
  ranked: ScoredCourse[];       // 바로 들을 수 있는 과목, 점수순
  blocked: ScoredCourse[];      // 선수과목이 먼저 필요한 과목, 점수순
  bundle: ScoredCourse[];       // 다음 학기 추천 묶음
  bundleCredits: number;
  multiCount: number;            // 묶음 중 관심 다전공에서도 인정되는 과목 수
}

/** 입학연도와 학기로 학년 계산 (휴학 없이 진급한다고 가정) */
export function studentYearAt(admissionYear: number | null, term: string): number | null {
  if (!admissionYear) return null;
  const [y, s] = term.split('-').map(Number);
  const idx = (y - admissionYear) * 2 + s; // 몇 번째 학기
  if (idx < 1) return null;
  return Math.min(6, Math.ceil(idx / 2));
}

export function recommendCourses(
  program: Program,
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
  opt: RecommendOptions,
): Recommendation {
  const term = nextTerm(opt.nowTerm);
  const parity = Number(term.split('-')[1]) as 1 | 2;
  const studentYear = studentYearAt(opt.admissionYear, term);
  const pid = program.programId;

  const have = new Set(taken.map((t) => t.code)); // 수강 중 과목도 들은 것으로 본다
  const prereqs = prereqMap(program);
  const nodeOf = new Map((program.diagram?.nodes ?? []).map((n) => [n.code, n]));
  const req = new Map(program.requirements.map((r) => [r.category, r.minCredits]));
  const gaps = opt.gaps ?? new Map(calculate(program, courseMap, taken, true).areas.map((a) => [a.category, a.remaining]));

  // 모두 들어야 하는 영역: 과목 학점 합이 기준과 같으면 (택1 묶음은 하나로 셈)
  const mustTypes = new Set<Category>(['전필']);
  for (const [cat, min] of req) {
    if (cat === '전필' || !min) continue;
    const pool = program.courses
      .map((c) => courseMap.get(c))
      .filter((c): c is Course => !!c && c.typeByProgram[pid] === cat)
      .reduce((s, c) => ((choiceGroupOf(program, c.code)?.[0] ?? c.code) === c.code ? s + c.credit : s), 0);
    if (pool === min) mustTypes.add(cat);
  }

  // 이 과목을 선수과목으로 둔 과목 수
  const unlockCount = new Map<string, number>();
  for (const [pre, post] of program.diagram?.edges ?? []) {
    if (have.has(post)) continue;
    for (const p of pre.split('|')) unlockCount.set(p, (unlockCount.get(p) ?? 0) + 1);
  }
  const multiSet = new Set(opt.multiProgram?.courses ?? []);
  const nameOf = (code: string) => courseMap.get(code)?.name ?? code;

  const all: ScoredCourse[] = [];
  for (const code of program.courses) {
    if (have.has(code) || choiceBlocked(program, code, have)) continue;
    const c = courseMap.get(code);
    const type = c?.typeByProgram[pid];
    if (!c || !type) continue;
    const node = nodeOf.get(code);
    const year = node?.year ?? null;
    const reasons: Reason[] = [];
    let score = 0;

    const gap = gaps.get(type) ?? 0;
    const need = req.get(type) ?? 0;
    const isMust = mustTypes.has(type);
    if (isMust) { score += 40; reasons.push({ kind: 'must', label: type === '전필' ? '전공필수' : `${type} 전부 이수` }); }
    if (gap > 0) {
      const add = need ? Math.round(10 + 15 * Math.min(1, gap / need)) : 10;
      score += add; reasons.push({ kind: 'gap', label: `${type} ${gap}학점 남음` });
    } else if (!isMust) {
      score -= 15; // 이미 채운 영역
    }
    const unlock = unlockCount.get(code) ?? 0;
    if (unlock) { score += Math.min(18, unlock * 6); reasons.push({ kind: 'unlock', label: `${unlock}과목의 선수과목` }); }
    if (year && studentYear) {
      if (year < studentYear) { score += 15; reasons.push({ kind: 'late', label: `${year}학년 권장 과목` }); }
      else if (year === studentYear) { score += 10; reasons.push({ kind: 'late', label: `${year}학년 권장` }); }
      else if (year - studentYear >= 2) { score -= 6 * (year - studentYear - 1); reasons.push({ kind: 'early', label: `${year}학년 과목` }); }
    }
    let offeredNext: boolean | null = null;
    if (node) {
      offeredNext = !!node.both || node.semester === parity;
      if (offeredNext) { score += 8; reasons.push({ kind: 'term', label: `${parity}학기 개설` }); }
      else { score -= 20; reasons.push({ kind: 'off', label: `${parity === 1 ? 2 : 1}학기에만 개설` }); }
    }
    if (multiSet.has(code)) { score += 12; reasons.push({ kind: 'multi', label: `${opt.multiProgram!.department}에도 인정` }); }
    if (c.credit === 0 && (!studentYear || studentYear < 4)) score -= 30; // 졸업논문 등은 마지막 학년에

    const missing = (prereqs.get(code) ?? []).filter((p) => !prereqsMet([p], (x) => have.has(x)));
    all.push({
      code, name: c.name, credit: c.credit, type, year, score, reasons, offeredNext,
      missingPrereqs: missing.map((m) => m.split('|').map(nameOf).join(' 또는 ')),
      choiceWith: (choiceGroupOf(program, code) ?? []).filter((x) => x !== code).map(nameOf),
    });
  }

  const byScore = (a: ScoredCourse, b: ScoredCourse) => b.score - a.score || (a.year ?? 9) - (b.year ?? 9) || a.code.localeCompare(b.code);
  const ranked = all.filter((x) => x.missingPrereqs.length === 0).sort(byScore);
  const blocked = all.filter((x) => x.missingPrereqs.length > 0).sort(byScore);

  // 다음 학기 묶음: 점수순으로 담되, 학점 상한·다음 학기 개설·택1·이미 찬 영역을 지킨다
  const limit = opt.maxCredits ?? 18;
  const left = new Map(gaps);
  const picked: ScoredCourse[] = [];
  const pickedCodes = new Set<string>();
  let credits = 0;
  for (const x of ranked) {
    if (x.offeredNext === false || x.credit === 0) continue;
    if (credits + x.credit > limit) continue;
    if (choiceBlocked(program, x.code, pickedCodes)) continue;
    const l = left.get(x.type) ?? 0;
    if (l <= 0 && !mustTypes.has(x.type)) continue;
    picked.push(x); pickedCodes.add(x.code); credits += x.credit;
    left.set(x.type, l - x.credit);
  }
  // 관심 다전공을 골랐으면, 거기서도 인정되는 과목을 묶음에 최소 1과목 넣는다
  if (multiSet.size && !picked.some((x) => multiSet.has(x.code))) {
    const cand = ranked.find((x) => multiSet.has(x.code) && x.offeredNext !== false && x.credit > 0 && !pickedCodes.has(x.code) && !choiceBlocked(program, x.code, pickedCodes));
    if (cand) {
      if (credits + cand.credit > limit) {
        // 필수가 아닌 과목 중 점수가 가장 낮은 것과 바꾼다
        const idx = [...picked].reverse().findIndex((x) => !mustTypes.has(x.type));
        if (idx >= 0) {
          const out = picked.splice(picked.length - 1 - idx, 1)[0];
          credits -= out.credit; pickedCodes.delete(out.code);
        }
      }
      if (credits + cand.credit <= limit) { picked.push(cand); pickedCodes.add(cand.code); credits += cand.credit; }
    }
  }
  return { term, studentYear, ranked, blocked, bundle: picked, bundleCredits: credits, multiCount: picked.filter((x) => multiSet.has(x.code)).length };
}
