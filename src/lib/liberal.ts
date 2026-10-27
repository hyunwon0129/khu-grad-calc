// 교양(후마니타스칼리지) 이수 현황과 더 들어야 할 것
// 기준: 2026학년도 교양교육과정 기본구조표 — 필수교과 17학점(6과목), 배분이수 5개 영역 중 3개 영역 9학점 이상,
//       자유이수 3학점 이상(전공탐색및기업가정신세미나 필수), 합계 29학점 이상 (2024학번 이후)
// 면제·대체: [별표5] 대학영어 이수면제, [별표4] 전공기초 강좌로 빅뱅에서문명까지·배분이수 대체(총 3학점),
//            외국인 학생(대학영어→한국어 과목, 전공탐색세미나 면제), 편입생(배분 영역 구분 없음, 전공탐색세미나 면제),
//            2019~2023학번 경과조치(배분 영역 구분 없이 12학점, 합계 32학점)
import type { Course, TakenCourse } from './types';

export interface LiberalCourse { code: string; name: string; credit: number; kind: '필수' | '배분' | '자유'; area: number | null; year: number; s1: boolean; s2: boolean }
interface Rules { 필수: number; 배분: number; 배분영역: number; 자유: number; 총: number; note?: string }
export interface Substitution { target: string; years: [number, number]; courses: string[]; depts?: string[]; college?: string }
export interface LiberalData {
  source: string;
  basis: string;
  areas: Record<string, string>;
  required: { name: string; codes: string[]; credit: number; year: number; after?: string }[];
  requiredFree: { name: string; codes: string[]; alt?: string; note?: string };
  rules: Rules;
  rules2019?: Rules;
  courses: LiberalCourse[];
  englishExempt: { source: string; tests: Record<string, number>; others: string[]; notes: string[] };
  koreanForForeigners: string[];
  substitutions: Substitution[];
  substitutionSource: string;
}

export type StudentType = '일반' | '외국인' | '편입생';
export interface LiberalOptions {
  studentType: StudentType;
  englishExempt: boolean;
}
export const DEFAULT_LIB_OPTIONS: LiberalOptions = { studentType: '일반', englishExempt: false };

export type ItemState = 'done' | 'ongoing' | 'todo' | 'exempt' | 'subst';

export interface LiberalStatus {
  rules: Rules;
  areaRule: boolean;               // 영역 조건이 있는가 (2024학번 이후 일반 학생)
  required: { name: string; credit: number; year: number; state: ItemState; note?: string }[];
  areaState: { area: number; name: string; state: ItemState; courses: string[] }[];
  areaCovered: number;
  coveredEst: number;
  unknownAreaCourses: string[];
  credits: { 필수: number; 배분: number; 자유: number };
  substBaebun: { course: string; credit: number } | null;  // 배분이수로 대체 인정된 전공기초
  freeSeminar: ItemState;
  suggestions: { area: number; name: string; courses: LiberalCourse[] }[];
  freeSuggestions: LiberalCourse[];
  nextSemester: 1 | 2;
  notes: string[];
}

const norm = (s: string) => s.replace(/[\s()·･:;]/g, '').replace(/Ⅰ/g, '1').replace(/Ⅱ/g, '2');
const dot = (s: string) => s.replace(/[··‧・･ㆍ]/g, '·').replace(/\s+/g, '');

/** 공인 영어 성적이 대학영어 면제 기준을 넘는가 */
export function meetsEnglishScore(data: LiberalData, test: string, score: number): boolean {
  const min = data.englishExempt.tests[test];
  return min !== undefined && score >= min;
}

/** 학과·학번에 해당하는 이수대체 규칙 */
export function substitutionsFor(data: LiberalData, dept: { name: string; college: string } | null | undefined, admissionYear: number | null): Substitution[] {
  if (!dept || !admissionYear) return [];
  return data.substitutions.filter((s) =>
    admissionYear >= s.years[0] && admissionYear <= s.years[1] &&
    ((s.depts && s.depts.some((d) => dot(d) === dot(dept.name))) || (s.college && s.college === dept.college)));
}

export function analyzeLiberal(
  data: LiberalData,
  taken: TakenCourse[],
  courseMap: Map<string, Course>,
  opts: {
    nextSemester: 1 | 2;
    schoolCategory?: Record<string, string>;
    options?: LiberalOptions;
    dept?: { name: string; college: string } | null;
    admissionYear?: number | null;
  } = { nextSemester: 1 },
): LiberalStatus {
  const o = opts.options ?? DEFAULT_LIB_OPTIONS;
  const year = opts.admissionYear ?? null;
  const old = !!year && year >= 2019 && year <= 2023;
  const rules: Rules = old && data.rules2019 ? data.rules2019 : data.rules;
  const areaRule = !old && o.studentType !== '편입생';
  const notes: string[] = [];
  if (old && data.rules2019?.note) notes.push(data.rules2019.note);
  if (o.studentType === '편입생') notes.push('편입생: 배분이수는 영역 구분 없이 학점만 채우면 되고, 전공탐색및기업가정신세미나는 면제입니다.');
  if (o.studentType === '외국인') notes.push('외국인 학생: 대학영어 대신 한국어1·한국어2·한국어의이해1·한국어의이해2 중 한 과목으로 대체할 수 있고, 전공탐색및기업가정신세미나는 면제입니다.');

  const byCode = new Map(data.courses.map((c) => [c.code, c]));
  const byName = new Map(data.courses.map((c) => [norm(c.name), c]));
  const stateOf = (t: TakenCourse): ItemState => (t.status === 'IN_PROGRESS' ? 'ongoing' : 'done');
  const rank: Record<ItemState, number> = { todo: 0, ongoing: 1, subst: 2, exempt: 3, done: 4 };
  const better = (a: ItemState, b: ItemState): ItemState => (rank[a] >= rank[b] ? a : b);

  const mine = taken.map((t) => {
    const name = courseMap.get(t.code)?.name ?? '';
    const lc = byCode.get(t.code) ?? (name ? byName.get(norm(name)) : undefined);
    return { t, name: lc?.name ?? name, lc, state: stateOf(t), credit: courseMap.get(t.code)?.credit ?? lc?.credit ?? 0 };
  });

  // 전공기초 대체 (총 3학점까지: 처음 맞는 한 과목만)
  const subs = substitutionsFor(data, opts.dept, year);
  let substUsed: { target: string; course: string; credit: number; state: ItemState } | null = null;
  for (const s of subs) {
    const hit = mine.find((m) => s.courses.some((c) => norm(c) === norm(m.name)));
    if (hit) { substUsed = { target: s.target, course: hit.name, credit: Math.min(3, hit.credit || 3), state: hit.state }; break; }
  }
  if (subs.length && !substUsed) {
    const names = [...new Set(subs.flatMap((s) => s.courses))].join(' 또는 ');
    notes.push(`${opts.dept!.name}: 전공기초 ${names}을(를) 들으면 ${subs[0].target === '배분' ? '배분이수' : subs[0].target}로 대체 인정됩니다(3학점까지).`);
  }

  const required = data.required.map((r) => {
    let st: ItemState = 'todo';
    let note = r.after ? `${r.after} 다음에` : undefined;
    for (const m of mine) {
      if (r.codes.includes(m.t.code) || norm(m.name) === norm(r.name)) st = better(st, m.state);
    }
    if (r.name === '대학영어') {
      if (o.englishExempt && st === 'todo') { st = 'exempt'; note = '2학점은 다른 과목으로 졸업학점 채우기'; }
      if (o.studentType === '외국인') {
        const k = mine.find((m) => data.koreanForForeigners.some((n) => norm(n) === norm(m.name)));
        if (k) { st = better(st, k.state === 'done' ? 'subst' : 'ongoing'); note = k.name; }
        else if (st === 'todo') note = '외국인 학생은 한국어1·2, 한국어의이해1·2 중 한 과목으로 대체 가능';
      }
    }
    if (substUsed && substUsed.target === r.name && st === 'todo') {
      st = substUsed.state === 'done' ? 'subst' : 'ongoing';
      note = `전공기초 ${substUsed.course}`;
    }
    return { name: r.name, credit: r.credit, year: r.year, state: st, note };
  });

  const areaHit = new Map<number, { state: ItemState; courses: string[] }>();
  const unknownAreaCourses: string[] = [];
  const credits = { 필수: 0, 배분: 0, 자유: 0 };
  let freeSeminar: ItemState = o.studentType === '일반' ? 'todo' : 'exempt';
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
  const substBaebun = substUsed && substUsed.target === '배분' ? { course: substUsed.course, credit: substUsed.credit } : null;
  if (substBaebun) credits.배분 += substBaebun.credit;

  const areaState = Object.entries(data.areas).map(([k, name]) => {
    const a = Number(k); const h = areaHit.get(a);
    return { area: a, name, state: h?.state ?? ('todo' as ItemState), courses: h?.courses ?? [] };
  });
  const areaCovered = areaState.filter((a) => a.state !== 'todo').length;
  const coveredEst = Math.min(rules.배분영역 || 0, areaCovered + unknownAreaCourses.length);

  const takenCodes = new Set(taken.map((t) => t.code));
  const sem = opts.nextSemester;
  const offered = (c: LiberalCourse) => (sem === 1 ? c.s1 : c.s2);
  let suggestions: LiberalStatus['suggestions'] = [];
  if (areaRule) {
    const needAreas = coveredEst >= rules.배분영역 ? [] : areaState.filter((a) => a.state === 'todo');
    suggestions = needAreas.map((a) => ({
      area: a.area, name: a.name,
      courses: data.courses.filter((c) => c.kind === '배분' && c.area === a.area && !takenCodes.has(c.code) && offered(c)).slice(0, 4),
    }));
  } else if (credits.배분 < rules.배분) {
    // 영역 구분이 없으면 아무 영역에서나 (영역별로 1과목씩 고르게)
    suggestions = areaState.map((a) => ({
      area: a.area, name: a.name,
      courses: data.courses.filter((c) => c.kind === '배분' && c.area === a.area && !takenCodes.has(c.code) && offered(c)).slice(0, 2),
    }));
  }
  const freeSuggestions = freeSeminar === 'todo' ? data.courses.filter((c) => data.requiredFree.codes.includes(c.code)) : [];

  return { rules, areaRule, required, areaState, areaCovered, coveredEst, unknownAreaCourses, credits, substBaebun, freeSeminar, suggestions, freeSuggestions, nextSemester: sem, notes };
}

/** 더 들어야 할 교양 한 줄 목록 (요약 체크리스트·교양 탭 공용). school은 사정표 영역(교양필수·배분이수·자유이수) */
export function liberalTodo(
  st: LiberalStatus,
  data: LiberalData,
  school: { name: string; remaining: number }[] = [],
): { kind: '필수교과' | '배분이수' | '자유이수'; label: string; detail?: string }[] {
  const s = (n: string) => school.find((v) => v.name === n);
  const out: { kind: '필수교과' | '배분이수' | '자유이수'; label: string; detail?: string }[] = [];
  for (const r of st.required.filter((x) => x.state === 'todo')) out.push({ kind: '필수교과', label: r.name, detail: `${r.credit}학점 · ${r.year}학년 권장${r.note ? ` · ${r.note}` : ''}` });
  const needArea = st.areaRule ? Math.max(0, st.rules.배분영역 - st.coveredEst) : 0;
  const sb = s('배분이수');
  const needBaebun = sb ? sb.remaining : Math.max(0, st.rules.배분 - st.credits.배분);
  if (needArea > 0) out.push({ kind: '배분이수', label: `${needArea}개 영역 더`, detail: st.areaState.filter((a) => a.state === 'todo').map((a) => `${a.area}. ${a.name}`).join(' / ') });
  else if (needBaebun > 0) out.push({ kind: '배분이수', label: `${needBaebun}학점 더`, detail: st.areaRule ? undefined : '영역 구분 없음' });
  if (st.freeSeminar === 'todo') out.push({ kind: '자유이수', label: data.requiredFree.name, detail: `필수${data.requiredFree.note ? ` · ${data.requiredFree.note}` : ''}${data.requiredFree.alt ? ` · '${data.requiredFree.alt}'로 대신 가능(공과대학 등)` : ''}` });
  const sf = s('자유이수');
  if (sf && sf.remaining > 0) out.push({ kind: '자유이수', label: `${sf.remaining}학점 더` });
  return out;
}
