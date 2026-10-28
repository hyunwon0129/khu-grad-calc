// 다전공·마이크로디그리 추천 (2026 학사제도안내 38~40쪽 규정 + 학과 기본구조표)
// - 다전공 학점 기준은 모든 학과에 대해 기본구조표(2026)를 쓴다
// - 과목 목록이 있는 학과는 이미 들은 과목 중 겹치는 학점을 빼 준다 (두 전공에 중복 인정, 졸업학점에는 한 번)
import type { Campus, Course, CreditBlock, DepartmentInfo, Program, TakenCourse } from './types';
import { normDept, sameDept } from './dept';

export interface Student {
  campus: Campus | null;
  department: string | null;
}

export interface MultiCandidate {
  dept: DepartmentInfo;
  required: CreditBlock;
  overlap: CreditBlock;          // 이미 들은 과목으로 인정되는 학점 (영역별 기준까지만)
  overlapCourses: string[];      // 겹치는 과목명
  needed: number;                // 더 들어야 하는 학점
  hasCourseData: boolean;        // 과목 목록이 앱에 있는 학과인가
  dataYear: number | null;       // 과목 목록 기준 연도
  otherCampus: boolean;
  feasible: boolean | null;      // 남은 학기 안에 가능한가 (여유 학점을 모르면 null)
}

const KEY: Record<string, keyof CreditBlock> = { 전기: '기초', 전필: '필수', 전선: '선택' };

export function findDepartment(departments: DepartmentInfo[], name: string | null | undefined, campus?: Campus | null): DepartmentInfo | undefined {
  if (!name) return undefined;
  const same = departments.filter((d) => sameDept(d.name, name));
  return same.find((d) => !campus || d.campus === campus) ?? same[0];
}

/** 학생 소속 기준으로 다전공을 신청할 수 없는 전공인가 (이유 문자열, 가능하면 null) */
export function multiBlockReason(d: DepartmentInfo, student: Student): string | null {
  if (!d.multi) return d.unreadable ? '학사제도안내 표에서 학점을 읽지 못함' : '다전공 과정 없음';
  if (student.department && sameDept(d.name, student.department)) return '내 전공';
  if (student.campus && d.multiBannedFor?.includes(student.campus)) return '다전공 이수 금지 전공';
  const me = normDept(student.department ?? '');
  if (me === normDept('국제통상･금융투자학부') && d.name === '무역학과') return '국제통상·금융투자학부 학생은 무역학과 다전공 불가';
  if ((me === '환경학' || me === '환경공학') && (d.name === '환경학' || d.name === '환경공학')) return '환경학및환경공학과 안에서는 1개 전공만 선택';
  return null;
}

export function recommendMulti(
  departments: DepartmentInfo[],
  programs: Program[],
  courseMap: Map<string, Course>,
  taken: TakenCourse[],
  student: Student,
  room: number | null, // 남은 학기에 내 전공·교양 외로 쓸 수 있는 학점 (모르면 null)
): MultiCandidate[] {
  const have = new Set(taken.map((t) => t.code));
  const list: MultiCandidate[] = [];

  for (const d of departments) {
    if (multiBlockReason(d, student)) continue;
    const required = d.multi!;
    const prog =
      programs.find((p) => p.kind === 'MULTI_MAJOR' && p.campus === d.campus && sameDept(p.department, d.name)) ??
      programs.find((p) => p.kind === 'MAJOR' && p.campus === d.campus && sameDept(p.department, d.name));

    const overlap: CreditBlock = { 기초: 0, 필수: 0, 선택: 0, 계: 0 };
    const overlapCourses: string[] = [];
    if (prog) {
      const raw: CreditBlock = { 기초: 0, 필수: 0, 선택: 0, 계: 0 };
      for (const code of prog.courses) {
        if (!have.has(code)) continue;
        const c = courseMap.get(code);
        let k = KEY[c?.typeByProgram[prog.programId] ?? ''];
        if (d.mergedBasic && k === '기초') k = '필수';
        if (!c || !k) continue;
        raw[k] += c.credit;
        if (c.credit > 0) overlapCourses.push(c.name);
      }
      overlap.기초 = Math.min(raw.기초, required.기초);
      overlap.필수 = Math.min(raw.필수, required.필수);
      overlap.선택 = Math.min(raw.선택, required.선택);
      overlap.계 = Math.min(required.계, overlap.기초 + overlap.필수 + overlap.선택);
    }
    const needed = Math.max(0, required.계 - overlap.계);
    list.push({
      dept: d,
      required,
      overlap,
      overlapCourses,
      needed,
      hasCourseData: !!prog,
      dataYear: prog?.source.year ?? null,
      otherCampus: !!student.campus && d.campus !== student.campus,
      feasible: room === null ? null : needed <= room,
    });
  }

  return list.sort(
    (a, b) =>
      b.overlap.계 - a.overlap.계 ||
      Number(a.otherCampus) - Number(b.otherCampus) ||
      a.needed - b.needed ||
      a.dept.name.localeCompare(b.dept.name, 'ko'),
  );
}

export interface MdCandidate {
  program: Program;
  earned: number;
  needed: number;
  takenNames: string[];
  otherCampus: boolean;
}

/** 마이크로디그리: 1인당 최대 3개, 전공·교양과 중복 인정 */
export function recommendMd(programs: Program[], courseMap: Map<string, Course>, taken: TakenCourse[], campus: Campus | null): MdCandidate[] {
  const have = new Set(taken.map((t) => t.code));
  return programs
    .filter((p) => p.kind === 'MICRO_DEGREE' && !p.programId.startsWith('SAMPLE'))
    .map((p) => {
      const done = p.courses.filter((c) => have.has(c));
      const earned = Math.min(p.totalMin, done.reduce((s, c) => s + (courseMap.get(c)?.credit ?? 0), 0));
      return {
        program: p,
        earned,
        needed: Math.max(0, p.totalMin - earned),
        takenNames: done.map((c) => courseMap.get(c)?.name ?? c),
        otherCampus: !!campus && p.campus !== campus && !p.anyCampus,
      };
    })
    .sort((a, b) => a.needed - b.needed || Number(a.otherCampus) - Number(b.otherCampus));
}

/** 다전공을 하면 내 전공 기준이 단일전공 → 다전공 학점으로 바뀐다 */
export function ownMajorShift(departments: DepartmentInfo[], student: Student): { single: number; multi: number } | null {
  const me = findDepartment(departments, student.department, student.campus);
  if (!me?.single || !me.multi) return null;
  return { single: me.single.계, multi: me.multi.계 };
}
