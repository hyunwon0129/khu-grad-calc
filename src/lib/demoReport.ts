// 체험용 가상 졸업사정표: 학과 교육과정(권장 학년·학기)과 교양 편성표로 '그럴듯한' 이수 기록을 만든다.
// 실제 학생 정보가 아니다. 학번·이름은 가짜이고, 개인정보 제거 과정을 보여 주려고 넣는다.
// 결과는 실제 사정표와 같은 글자 줄 형식이라, 사정표를 올렸을 때와 똑같은 분석 과정을 거친다.
import type { Course, DepartmentInfo, Program } from './types';
import { choiceGroupOf } from './prereq';
import liberalData from '../data/liberal.json';

export interface DemoStage { id: string; label: string; done: number; inProgress: boolean }
/** done: 마친 학기 수, inProgress: 이번 학기 수강 중 여부 */
export const DEMO_STAGES: DemoStage[] = [
  { id: 'y1', label: '1학년 2학기 수강 중', done: 1, inProgress: true },
  { id: 'y2', label: '2학년 2학기 수강 중', done: 3, inProgress: true },
  { id: 'y3', label: '3학년 2학기 수강 중', done: 5, inProgress: true },
  { id: 'y4', label: '4학년 2학기 수강 중 (졸업 직전)', done: 7, inProgress: true },
];

type Lib = { code: string; name: string; credit: number; kind: string; area: number | null; s1: boolean; s2: boolean };
const lib = liberalData as unknown as {
  required: { name: string; codes: string[]; credit: number; year: number }[];
  requiredFree: { name: string; codes: string[] };
  courses: Lib[];
};

/** 같은 입력이면 늘 같은 결과 (학과·단계로 씨앗을 만든다) */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

const CODE: Record<string, string> = { 전기: '11', 전필: '04', 전선: '05' };
const clean = (s: string) => s.replace(/\s+/g, '');

/** 단계와 이번 학기로 정해지는 가상 학생의 입학연도 */
export function demoAdmissionYear(stageId: string, nowTerm: string): number {
  const stage = DEMO_STAGES.find((s) => s.id === stageId) ?? DEMO_STAGES[2];
  const [ny, ns] = nowTerm.split('-').map(Number);
  const nth = stage.done + (stage.inProgress ? 1 : 0);
  return Math.floor((ny * 2 + (ns - 1) - (nth - 1)) / 2);
}

export interface DemoReport { lines: string[]; admissionYear: number; terms: string[] }

/** nowTerm: 이번 학기 "2026-2" */
export function makeDemoReport(program: Program, courseMap: Map<string, Course>, dept: DepartmentInfo | null, stageId: string, nowTerm: string): DemoReport {
  const stage = DEMO_STAGES.find((s) => s.id === stageId) ?? DEMO_STAGES[2];
  const rand = rng(`${program.programId}:${stage.id}`);
  // 이번 학기가 (done+1)번째 학기가 되도록 입학연도를 정한다
  const [ny, ns] = nowTerm.split('-').map(Number);
  const nth = stage.done + (stage.inProgress ? 1 : 0); // 마지막 학기 번호
  const startIndex = ny * 2 + (ns - 1) - (nth - 1);    // 1학년 1학기의 (연도*2+학기-1)
  const admissionYear = Math.floor(startIndex / 2);
  const termOf = (k: number) => { const i = startIndex + k - 1; return `${Math.floor(i / 2)}-${(i % 2) + 1}`; }; // k번째 학기
  const terms = Array.from({ length: nth }, (_, i) => termOf(i + 1));

  type Row = { cat: string; code: string; name: string; credit: number; k: number };
  const rows: Row[] = [];
  const used = new Set<string>();
  const add = (cat: string, code: string, name: string, credit: number, k: number) => {
    if (used.has(code) || k < 1 || k > nth) return;
    used.add(code); rows.push({ cat, code, name: clean(name), credit, k });
  };

  // 1) 전공: 권장 학년·학기대로, 마지막 학기까지. 택1은 첫 과목만. 일부(약 12%)는 아직 안 들은 것으로 둬서 남은 과목이 생기게
  const pid = program.programId;
  const nodes = new Map((program.diagram?.nodes ?? []).map((n) => [n.code, n]));
  const major = program.courses
    .map((c) => courseMap.get(c))
    .filter((c): c is Course => !!c && !!CODE[c.typeByProgram[pid] ?? ''] && c.credit > 0)
    .filter((c) => (choiceGroupOf(program, c.code)?.[0] ?? c.code) === c.code);
  const placed = new Map<number, number>(); // 학기별 전공 학점
  for (const c of major) {
    const n = nodes.get(c.code);
    const y = n?.year ?? (c.typeByProgram[pid] === '전기' ? 1 : c.typeByProgram[pid] === '전필' ? 2 : 3);
    const sem = n?.semester ?? (n?.both ? 1 : rand() < 0.5 ? 1 : 2);
    const k = (y - 1) * 2 + sem;
    if (k > nth) continue;
    const isMust = c.typeByProgram[pid] !== '전선';
    if (!isMust && rand() < 0.35) continue;      // 전공선택은 다 듣지 않는다
    if (isMust && rand() < 0.08) continue;       // 필수도 가끔 빠뜨려 '꼭 들을 과목'이 보이게
    if ((placed.get(k) ?? 0) + c.credit > 15) continue;
    placed.set(k, (placed.get(k) ?? 0) + c.credit);
    add(CODE[c.typeByProgram[pid]!], c.code, c.name, c.credit, k);
  }

  // 1-1) 진도에 맞게 전공선택을 더 채운다: 학년이 오를수록 기준 학점에 가까워지게 (마지막 학기 앞까지 약 90%)
  const progress = Math.min(1, nth / 8);
  const needSel = Math.round((program.requirements.find((r) => r.category === '전선')?.minCredits ?? 0) * progress * 0.9);
  let selNow = rows.filter((r) => r.cat === '05').reduce((x, r) => x + r.credit, 0);
  const restSel = major.filter((c) => c.typeByProgram[pid] === '전선' && !used.has(c.code))
    .sort((x, y) => (nodes.get(x.code)?.year ?? 3) - (nodes.get(y.code)?.year ?? 3));
  for (const c of restSel) {
    if (selNow >= needSel) break;
    const minYear = nodes.get(c.code)?.year ?? 2;
    for (let k = Math.max(1, (minYear - 1) * 2 + 1); k <= nth; k++) {
      if ((placed.get(k) ?? 0) + c.credit > 12) continue;
      placed.set(k, (placed.get(k) ?? 0) + c.credit);
      add('05', c.code, c.name, c.credit, k); selNow += c.credit;
      break;
    }
  }

  // 2) 교양 필수: 권장 학년 학기에 (주제연구는 2학년)
  lib.required.forEach((r, i) => {
    const k = (r.year - 1) * 2 + (i % 2) + 1;
    if (r.name === '대학영어' && stage.id !== 'y1' && rand() < 0.3) return; // 영어 면제·미이수 사례
    add('16', r.codes[0], r.name, r.credit, Math.min(k, nth));
  });
  // 3) 자유이수: 전공탐색세미나 1학년 1학기
  add('17', lib.requiredFree.codes[0], lib.requiredFree.name, 1, 1);
  // 4) 배분이수: 학기마다 한 과목, 아직 안 들은 영역부터 (3개 영역 채우면 그 뒤로는 가끔)
  const areas = [1, 2, 3, 4, 5].sort(() => rand() - 0.5);
  let ai = 0;
  for (let k = 1; k <= nth; k++) {
    if (ai >= 3 && rand() < 0.6) continue;
    const area = areas[ai % 5];
    const sem = ((startIndex + k - 1) % 2) + 1;
    const pool = lib.courses.filter((c) => c.kind === '배분' && c.area === area && (sem === 1 ? c.s1 : c.s2) && !used.has(c.code));
    if (pool.length) { const c = pool[Math.floor(rand() * pool.length)]; add('15', c.code, c.name, c.credit, k); ai++; }
  }
  // 5) 학기당 15~18학점이 되게 일반선택(온라인 교양 등)으로 채운다
  const perTerm = Math.round((dept?.grad ?? 130) / 8); // 8학기에 졸업학점을 채우는 속도
  const extra = lib.courses.filter((c) => c.kind === '자유' && c.credit >= 2 && !lib.requiredFree.codes.includes(c.code));
  for (let k = 1; k <= nth; k++) {
    let sum = rows.filter((r) => r.k === k).reduce((s, r) => s + r.credit, 0);
    const target = perTerm - 1 + Math.floor(rand() * 3);
    let guard = 0;
    while (sum < target && guard++ < 10) {
      const c = extra[Math.floor(rand() * extra.length)];
      if (!c || used.has(c.code)) continue;
      if (sum + c.credit > 19) break;
      // 자유이수 3학점을 채울 때까지는 자유이수로, 그다음부터는 일반선택으로
      const freeNow = rows.filter((r) => r.cat === '17').reduce((x, r) => x + r.credit, 0);
      add(freeNow < 3 && k >= 2 ? '17' : '08', c.code, c.name, c.credit, k); sum += c.credit;
    }
  }

  // 사정표 숫자: 졸업학점은 이번 학기 수강분을 빼고, 영역은 포함해서 센다(실제 사정표와 같은 방식)
  const now = stage.inProgress ? nth : -1;
  const sumOf = (cats: string[], includeNow = true) => rows.filter((r) => cats.includes(r.cat) && (includeNow || r.k !== now)).reduce((s, r) => s + r.credit, 0);
  const countOf = (cats: string[]) => rows.filter((r) => cats.includes(r.cat)).length;
  const grad = dept?.grad ?? 130;
  const single = dept?.single ?? null;
  const req = {
    전기: program.requirements.find((r) => r.category === '전기')?.minCredits ?? single?.기초 ?? 0,
    전필: program.requirements.find((r) => r.category === '전필')?.minCredits ?? single?.필수 ?? 0,
    전선: program.requirements.find((r) => r.category === '전선')?.minCredits ?? single?.선택 ?? 0,
  };
  const pair = (c: string, r: number) => `${Math.min(sumOf([c]), 999)}/${r}`;
  const engCount = Math.min(3, Math.floor(nth / 3));

  const lines = [
    `출력일시 ${nowTerm.slice(0, 4)}-10-28 10:00:00`,
    `학번 ${admissionYear}000000 성명 체험학생 학과 ${program.department}`,
    `졸업학점 ${sumOf(Object.values({ a: '11', b: '04', c: '05', d: '16', e: '15', f: '17', g: '08' }), false)} / ${grad}`,
    `필수교과 ${countOf(['16'])} / 6 ${sumOf(['16'])} / 17`,
    `배분이수교과 ${Math.min(3, new Set(rows.filter((r) => r.cat === '15').map((r) => r.code)).size)} / 3 ${sumOf(['15'])} / 9`,
    `자유이수 ${countOf(['17'])} / 1 ${sumOf(['17'])} / 3`,
    ...rows.sort((a, b) => a.k - b.k || a.cat.localeCompare(b.cat)).map((r) => {
      const [y, s] = termOf(r.k).split('-');
      return `${r.cat} ${r.code} ${r.name} ${r.credit} ${y} / ${s}`;
    }),
    `전공계: ${sumOf(['11', '04', '05'])} ( 전필: ${pair('04', req.전필)} 전선: ${pair('05', req.전선)} 전기: ${pair('11', req.전기)} )`,
    '졸업평점 충족',
    `영어강의 ${engCount} / 3`,
    `논문 ${stage.id === 'y4' && rand() < 0.5 ? 1 : 0} / 1`,
    stage.id === 'y4' ? '졸업능력인증 충족' : '졸업능력인증 미충족',
    `SW인증 ${Math.min(6, nth * 2)} / 6`,
    '문의 031-000-0000 demo@example.com',
  ];
  return { lines, admissionYear, terms };
}

/** 체험용으로 고를 수 있는 학과: 과목 목록이 있는 학과별 최신 교육과정 하나씩 */
export function demoPrograms(programs: Program[]): Program[] {
  const best = new Map<string, Program>();
  for (const p of programs) {
    if (p.kind !== 'MAJOR' || p.programId.startsWith('SAMPLE') || p.courses.length < 8) continue;
    const key = `${p.campus}:${p.department}`;
    const cur = best.get(key);
    if (!cur || p.admissionYearRange[0] > cur.admissionYearRange[0] || (p.verified && !cur.verified)) best.set(key, p);
  }
  return [...best.values()].sort((a, b) => a.department.localeCompare(b.department, 'ko'));
}
