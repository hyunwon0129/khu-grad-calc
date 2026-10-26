// 졸업사정표의 '학교가 이미 판정한 값'을 읽는다. 교육과정 데이터가 없는 학과에서도 동작한다.
// 근거: 2026 학사제도안내 p.13 「교육과정 이수구분별 구분 코드」
//   11 전공기초 · 04 전공필수 · 05 전공선택 · 14,16 필수교과 · 15 배분이수교과 · 17 자유이수교과
//   20 교직(전공선택) · 06 교직교과 · 08 일반선택   (03 = 구 전공교양 → 전공기초)
//
// 사정표 구조 (실제 양식 확인):
//   - 왼쪽 단: 교양. '필수교과/배분이수/자유이수/일반선택' 머리글 아래 과목이 이어진다. 행 앞 01·02는 영역 번호.
//   - 오른쪽 단: 전공. 이수구분 코드(05, 11 …)는 묶음의 첫 행에만 있고 아래 행은 같은 구분(병합 셀).
//   - '[금학기수강학점]' 아래: 이번 학기 수강 과목. 행마다 이수구분 코드가 있다.
//   - '전공계: N ( 전필: a/b 전선: c/d 전기: e/f )' = 취득/기준
//   - '필수교과 x/y a/b' = 영역(취득/기준) 학점(취득/기준)
//   - 상단 표 '취득학점' 열 = 졸업학점 기준(기준 행) / 취득(취득 행)
import type { TextItem } from './pdfText';
import type { RequirementCheck } from './requirements';

export type SchoolCategory =
  | '전공기초' | '전공필수' | '전공선택' | '교양필수' | '배분이수' | '자유이수' | '일반선택' | '교직';

export const AREA_CODE: Record<string, SchoolCategory> = {
  '11': '전공기초', '03': '전공기초', '04': '전공필수', '05': '전공선택',
  '14': '교양필수', '16': '교양필수', '15': '배분이수', '17': '자유이수',
  '08': '일반선택', '20': '교직', '06': '교직',
};

/** 학과 교육과정 데이터(전기·전필·전선 표기)와 맞추기 위한 줄임말 */
export const SHORT_NAME: Partial<Record<SchoolCategory, string>> = {
  전공기초: '전기', 전공필수: '전필', 전공선택: '전선',
};

export interface ReportArea {
  group: '졸업' | '전공' | '교양';
  name: string;       // '졸업학점' | SchoolCategory
  earned: number;
  required: number;
}

/** 앱에 보관하는 사정표 분석 결과 (이름·학번·성적은 없음) */
export interface ReportData {
  source: 'PDF' | 'SAMPLE';
  importedAt: string;               // ISO 시각
  department: string | null;
  admissionYear: number | null;
  areas: ReportArea[];
  categories: Record<string, SchoolCategory>; // 학수번호 → 학교 이수구분
  checks?: RequirementCheck[];      // 학점 밖 졸업요건 판정 (평점 값은 없음)
}

export const SCHOOL_CATEGORIES: SchoolCategory[] = ['전공기초', '전공필수', '전공선택', '교양필수', '배분이수', '자유이수', '일반선택', '교직'];

const CODE_RE = /^[A-Z]{2,6}\d{3,6}$/;
const MAJOR_LABEL: Record<string, SchoolCategory> = {
  전기: '전공기초', 전공기초: '전공기초', 전필: '전공필수', 전공필수: '전공필수', 전선: '전공선택', 전공선택: '전공선택',
};
const LIBERAL_HEADERS: [string, SchoolCategory][] = [
  ['필수교과', '교양필수'], ['배분이수', '배분이수'], ['자유이수', '자유이수'], ['일반선택', '일반선택'],
];

const isTermLike = (a: number, b: number) => a >= 1900 && b <= 4;

/** 소계 줄에서 영역별 취득/기준을 읽는다 (글자 줄만 있으면 됨) */
export function summarizeLines(lines: string[]): ReportArea[] {
  const areas: ReportArea[] = [];

  // 졸업학점 (글자 줄 형식 '졸업학점 a / b'. 실제 사정표는 표 좌표로 읽는다)
  const gradLine = lines.map((l) => l.match(/졸업학점\s*:?\s*(\d+)\s*\/\s*(\d+)/)).find(Boolean);
  if (gradLine) areas.push({ group: '졸업', name: '졸업학점', earned: +gradLine[1], required: +gradLine[2] });

  // 전공: '전공계: N ( 전필: a/b 전선: c/d 전기: e/f )'
  const majorLine = lines.find((l) => /전공계\s*:/.test(l) && /\d+\s*\/\s*\d+/.test(l));
  if (majorLine) {
    const found = new Map<SchoolCategory, ReportArea>();
    for (const m of majorLine.matchAll(/(전공기초|전공필수|전공선택|전기|전필|전선)\s*:?\s*(\d+)\s*\/\s*(\d+)/g)) {
      const name = MAJOR_LABEL[m[1]];
      if (!found.has(name)) found.set(name, { group: '전공', name, earned: +m[2], required: +m[3] });
    }
    for (const name of ['전공기초', '전공필수', '전공선택'] as SchoolCategory[]) {
      const a = found.get(name);
      if (a) areas.push(a);
    }
  }

  // 교양: '필수교과 x/y a/b' (두 번째 쌍이 학점). 쌍이 하나뿐이면 그 쌍을 학점으로 본다.
  for (const [label, name] of LIBERAL_HEADERS.slice(0, 3)) {
    for (const l of lines) {
      const at = l.indexOf(label);
      if (at < 0) continue;
      const pairs = [...l.slice(at).matchAll(/(\d+)\s*\/\s*(\d+)/g)]
        .map((m) => [+m[1], +m[2]] as const)
        .filter(([a, b]) => !isTermLike(a, b))
        .slice(0, 2);
      // 같은 줄의 다음 머리글 이전까지만
      if (pairs.length === 0) continue;
      const [earned, required] = pairs.length === 2 ? pairs[1] : pairs[0];
      areas.push({ group: '교양', name, earned, required });
      break;
    }
  }
  return areas;
}

/** 상단 표의 '취득학점' 열에서 졸업학점 기준·취득을 읽는다 (좌표 필요) */
export function graduationFromItems(items: TextItem[]): ReportArea | null {
  const header = items.find((i) => i.str.trim() === '취득학점');
  if (!header) return null;
  const rowOf = (label: string) =>
    items.find((i) => i.str.trim() === label && i.y < header.y && header.y - i.y < 40 && i.x < header.x);
  const valueIn = (row: TextItem | undefined) => {
    if (!row) return null;
    const cell = items
      .filter((i) => Math.abs(i.y - row.y) <= 2 && Math.abs(i.x - header.x) <= 25 && /\d/.test(i.str))
      .sort((a, b) => Math.abs(a.x - header.x) - Math.abs(b.x - header.x))[0];
    const n = cell?.str.match(/\d+/)?.[0];
    return n ? Number(n) : null;
  };
  const required = valueIn(rowOf('기준'));
  const earned = valueIn(rowOf('취득'));
  if (required === null || earned === null || required < 60 || required > 200) return null;
  return { group: '졸업', name: '졸업학점', earned, required };
}

/**
 * 과목별 학교 이수구분. 같은 단 안에서 위→아래로 훑으며
 *  - 행 앞 2자리가 이수구분 코드면 그 구분(그리고 아래 행들이 이어받음)
 *  - 아니면(01·02 같은 영역 번호이거나 비어 있으면) 단의 현재 머리글 구분
 */
/**
 * PDF 글자 조각이 붙어서 나오는 경우('AMTH1101 미분적분학', '05 IE201')를 낱말 단위로 나눈다.
 * 낱말의 x 위치는 글자 수로 어림한다 (순서와 대략의 거리만 쓰므로 충분).
 */
export function splitItems(items: TextItem[], charWidth = 3.6): TextItem[] {
  const out: TextItem[] = [];
  for (const i of items) {
    const parts = [...i.str.matchAll(/\S+/g)];
    if (parts.length <= 1 || !parts.some((m) => CODE_RE.test(m[0]) || /^\d{2}$/.test(m[0]))) {
      out.push(i);
      continue;
    }
    for (const m of parts) out.push({ str: m[0], x: i.x + m.index! * charWidth, y: i.y });
  }
  return out;
}

export function categorizeItems(rawItems: TextItem[]): Map<string, SchoolCategory> {
  const items = splitItems(rawItems);
  const result = new Map<string, SchoolCategory>();
  const codes = items.filter((i) => CODE_RE.test(i.str.trim()));
  if (codes.length === 0) return result;

  const xs = codes.map((c) => c.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const split = maxX - minX > 150 ? (minX + maxX) / 2 : Infinity;
  const colOf = (i: TextItem) => (i.x >= split ? 1 : 0);

  const yTop = Math.max(...codes.map((c) => c.y)) + 15;
  const yBottom = Math.min(...codes.map((c) => c.y)) - 15;
  const inArea = (i: TextItem) => i.y <= yTop && i.y >= yBottom;

  type Ev = { y: number; x: number; col: number; kind: 'header'; cat: SchoolCategory | null } | { y: number; x: number; col: number; kind: 'code'; item: TextItem };
  const events: Ev[] = [];
  for (const i of items) {
    if (!inArea(i)) continue;
    const s = i.str.trim();
    if (CODE_RE.test(s)) { events.push({ y: i.y, x: i.x, col: colOf(i), kind: 'code', item: i }); continue; }
    const hangul = s.replace(/[^가-힣]/g, '');
    if (!hangul || hangul.length > 10) continue;
    // '금학기 수강' 구역과 '기타' 묶음은 행마다 코드가 있거나 학교 구분을 알 수 없으므로 머리글 구분을 끊는다
    if (s.includes('금학기') || hangul === '기타') { events.push({ y: i.y, x: i.x, col: colOf(i), kind: 'header', cat: null }); continue; }
    const h = LIBERAL_HEADERS.find(([label]) => s.includes(label));
    if (h) events.push({ y: i.y, x: i.x, col: colOf(i), kind: 'header', cat: h[1] });
  }
  events.sort((a, b) => b.y - a.y || a.x - b.x);

  const current: (SchoolCategory | null)[] = [null, null];
  for (const e of events) {
    if (e.kind === 'header') { current[e.col] = e.cat; continue; }
    const code = e.item;
    const lead = items
      .filter((i) => Math.abs(i.y - code.y) <= 2 && i.x < code.x && code.x - i.x <= 80 && colOf(i) === e.col)
      .flatMap((i) => i.str.trim().split(/\s+/))
      .filter((t) => /^\d{2}$/.test(t));
    const known = lead.map((t) => AREA_CODE[t]).find(Boolean);
    if (known) current[e.col] = known;
    const cat = known ?? current[e.col];
    const key = code.str.trim();
    if (cat && !result.has(key)) result.set(key, cat);
  }
  return result;
}

/** 글자 줄만 있을 때(가상 사정표 등): 줄 앞 이수구분 코드로만 분류 */
export function categorizeLines(lines: string[]): Map<string, SchoolCategory> {
  const result = new Map<string, SchoolCategory>();
  for (const l of lines) {
    const m = l.match(/^\s*(\d{2})\s+([A-Z]{2,6}\d{3,6})\b/);
    if (m && AREA_CODE[m[1]] && !result.has(m[2])) result.set(m[2], AREA_CODE[m[1]]);
  }
  return result;
}

export interface CategorizedRow {
  code: string;
  credit: number | null;
  status: 'TAKEN' | 'IN_PROGRESS';
  category?: SchoolCategory;
}

/**
 * 분류하지 못한 과목을 소계와 맞춰 채운다.
 * 영역별 (사정표 취득 − 분류된 과목 학점 합)이 그 과목 학점과 같은 영역이 딱 하나일 때만 배정한다.
 * 사정표의 영역 취득에는 이번 학기 수강 과목도 포함된다.
 */
export function reconcile<T extends CategorizedRow>(rows: T[], areas: ReportArea[]): T[] {
  const out = rows.map((r) => ({ ...r }));
  const sumOf = (name: string) => out.filter((r) => r.category === name).reduce((s, r) => s + (r.credit ?? 0), 0);
  for (const r of out) {
    if (r.category || r.credit === null) continue;
    const fits = areas.filter((a) => a.group !== '졸업' && a.earned - sumOf(a.name) === r.credit);
    if (fits.length === 1) r.category = fits[0].name as SchoolCategory;
  }
  return out;
}

export interface MatchResult {
  ok: boolean;
  compared: number;                                   // 비교한 영역 수
  mismatches: { name: string; counted: number; school: number }[];
}

/**
 * 과목별 학점 합과 사정표의 학교 집계를 비교한다.
 * 영역 취득은 이번 학기 수강분 포함, 졸업학점 취득은 이수 완료분만.
 */
export function matchWithSchool(
  rows: { credit: number | null; status: 'TAKEN' | 'IN_PROGRESS'; category?: SchoolCategory | '' }[],
  areas: ReportArea[],
): MatchResult {
  const mismatches: MatchResult['mismatches'] = [];
  for (const a of areas) {
    const counted = rows
      .filter((r) => (a.group === '졸업' ? r.status === 'TAKEN' : r.category === a.name))
      .reduce((s, r) => s + (r.credit ?? 0), 0);
    if (counted !== a.earned) mismatches.push({ name: a.name, counted, school: a.earned });
  }
  return { ok: areas.length > 0 && mismatches.length === 0, compared: areas.length, mismatches };
}
