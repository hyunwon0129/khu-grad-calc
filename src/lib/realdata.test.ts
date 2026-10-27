// 실제 학과 데이터(산업경영 2025·컴퓨터공학 2024·경영 2026·2026 기본구조표)로 계산 규칙 확인
import { describe, expect, it } from 'vitest';
import courses from '../data/courses.json';
import programs from '../data/programs.json';
import departmentsData from '../data/departments.json';
import type { Course, DepartmentInfo, Program, TakenCourse } from './types';
import { planRoadmap } from './planner';
import { recommendNext } from './recommend';
import { calculate } from './calc';
import { creditLimit, capacity } from './creditLimit';
import { findDepartment, multiBlockReason, recommendMd, recommendMulti, ownMajorShift } from './multi';
import { matchProgram } from './dept';

const courseMap = new Map((courses as unknown as Course[]).map((c) => [c.code, c]));
const all = programs as unknown as Program[];
const departments = departmentsData.departments as unknown as DepartmentInfo[];
const ie = all.find((p) => p.programId === 'IE-2025-MAJOR')!;
const t = (code: string, status: TakenCourse['status'] = 'TAKEN'): TakenCourse => ({ code, term: '2025-1', status });

describe('산업경영공학과 2025 교육과정', () => {
  it('원문 학점 기준 (전기24·전필6·전선49 = 79)', () => {
    expect(ie.requirements.map((r) => r.minCredits)).toEqual([24, 6, 49]);
    expect(ie.totalMin).toBe(79);
    expect(calculate(ie, courseMap, []).totalRemaining).toBe(79);
  });

  it('웹/파이선프로그래밍(SWCON104)도 기초프로그래밍 대신 전공기초로 인정', () => {
    const r = calculate(ie, courseMap, [t('SWCON104')]);
    expect(r.areas.find((a) => a.category === '전기')?.earned).toBe(3);
  });

  it('데이터사이언스 선수과목은 기초프로그래밍 또는 웹/파이선 중 하나', () => {
    const none = recommendNext(ie, courseMap, []).find((c) => c.code === 'IE215')!;
    expect(none.available).toBe(false);
    expect(none.missingPrereqs[0]).toContain('또는');
    const viaSw = recommendNext(ie, courseMap, [t('SWCON104')]).find((c) => c.code === 'IE215')!;
    expect(viaSw.available).toBe(true);
  });

  it('창의적종합설계 1·2는 택1: 하나를 들었으면 다른 하나는 추천·계획하지 않는다', () => {
    const recs = recommendNext(ie, courseMap, [t('IE423')]);
    expect(recs.some((c) => c.code === 'IE430')).toBe(false);
    const plan = planRoadmap(ie, courseMap, [], { fromTerm: '2027-1', maxCreditsPerSemester: 21, maxSemesters: 8 });
    const planned = plan.semesters.flatMap((s) => s.courses.map((c) => c.code));
    expect(planned.filter((c) => c === 'IE423' || c === 'IE430').length).toBe(1);
    expect(planned.filter((c) => c === 'IE104' || c === 'SWCON104').length).toBe(1);
  });

  it('로드맵은 선수과목을 앞 학기에 둔다 (실험통계학 → 응용통계학 → 품질공학)', () => {
    const plan = planRoadmap(ie, courseMap, [], { fromTerm: '2027-1', maxCreditsPerSemester: 18, maxSemesters: 10 });
    const termOf = new Map(plan.semesters.flatMap((s) => s.courses.map((c) => [c.code, s.term])));
    if (termOf.has('IE208')) expect(termOf.get('IE208')! > termOf.get('IE207')!).toBe(true);
    if (termOf.has('IE312')) expect(termOf.get('IE312')! > termOf.get('IE208')!).toBe(true);
  });

  it('사정표 학과명·학번으로 교육과정 자동 선택 (2026학번도 2025 과목표)', () => {
    const majors = all.filter((p) => p.kind === 'MAJOR');
    expect(matchProgram(majors, '산업경영공학과', 2026)?.programId).toBe('IE-2025-MAJOR');
    expect(matchProgram(majors, '컴퓨터공학과', 2024)?.programId).toBe('CE-2024-MAJOR');
  });
});

describe('수강허용학점 (2026 학사제도안내 64쪽)', () => {
  const dep = (name: string) => findDepartment(departments, name)!;
  it('공과대학은 학기당 18', () => {
    expect(creditLimit(dep('산업경영공학과'), 2025)).toMatchObject({ first: 18, second: 18 });
  });
  it('경영대학 2018학번 이후 1학기 18·2학기 15', () => {
    expect(creditLimit(dep('경영학과'), 2026)).toMatchObject({ first: 18, second: 15 });
    expect(creditLimit(dep('경영학과'), 2017)).toMatchObject({ first: 18, second: 18 });
  });
  it('컴퓨터공학과 2023학번 이전 21/18', () => {
    expect(creditLimit(dep('컴퓨터공학과'), 2023)).toMatchObject({ first: 21, second: 18 });
    expect(creditLimit(dep('컴퓨터공학과'), 2024)).toMatchObject({ first: 18, second: 18 });
  });
  it('문과대학 2024학번부터 18/15, 체육대학도 같음', () => {
    expect(creditLimit(dep('사학과'), 2024)).toMatchObject({ first: 18, second: 15 });
    expect(creditLimit(dep('태권도학과'), 2023)).toMatchObject({ first: 18, second: 18 });
  });
  it('남은 학기 최대 학점: 2026-2 다음부터 3학기 (1·2·1학기)', () => {
    expect(capacity({ first: 18, second: 15 }, '2026-2', 3)).toBe(18 + 15 + 18);
  });
});

describe('다전공 추천 (2026 기본구조표·38쪽 규정)', () => {
  const student = { campus: 'INTL' as const, department: '산업경영공학과' };

  it('기본구조표: 산업경영공학과 다전공 51, 경영학과 39, 컴퓨터공학과 51', () => {
    expect(findDepartment(departments, '산업경영공학과')?.multi?.계).toBe(51);
    expect(findDepartment(departments, '경영학과')?.multi?.계).toBe(39);
    expect(findDepartment(departments, '컴퓨터공학과')?.multi?.계).toBe(51);
  });

  it('금지 전공·내 전공은 후보에서 빠진다', () => {
    expect(multiBlockReason(findDepartment(departments, '산업경영공학과')!, student)).toBe('내 전공');
    expect(multiBlockReason(findDepartment(departments, '간호학과')!, student)).not.toBeNull();
    expect(multiBlockReason(findDepartment(departments, '작곡과')!, student)).not.toBeNull();
    // 국제캠퍼스 학생은 서울 영어영문학과 불가, 서울 학생은 가능
    expect(multiBlockReason(findDepartment(departments, '영어영문학과')!, student)).not.toBeNull();
    expect(multiBlockReason(findDepartment(departments, '영어영문학과')!, { campus: 'SEOUL', department: '경영학과' })).toBeNull();
    // 국제캠퍼스 예·체능(태권도학과)은 금지 대상 아님
    expect(multiBlockReason(findDepartment(departments, '태권도학과')!, student)).toBeNull();
  });

  it('이미 들은 과목이 겹치면 필요한 학점이 줄고 맨 위로 온다', () => {
    const taken = ['CSE103', 'CSE204', 'AMTH1009', 'SWCON104'].map((c) => t(c));
    const list = recommendMulti(departments, all, courseMap, taken, student, 60);
    const ce = list.find((c) => c.dept.name === '컴퓨터공학과')!;
    // 다전공 [표2]: 미분적분학(기초3) + 객체지향·자료구조(필수6) + 웹/파이선(선택3)
    expect(ce.overlap).toMatchObject({ 기초: 3, 필수: 6, 선택: 3, 계: 12 });
    expect(ce.needed).toBe(51 - 12);
    expect(list[0].dept.name).toBe('컴퓨터공학과');
    expect(list.some((c) => c.dept.name === '산업경영공학과')).toBe(false);
  });

  it('남은 여유 학점보다 많이 필요하면 빠듯 표시', () => {
    const list = recommendMulti(departments, all, courseMap, [], student, 20);
    expect(list.find((c) => c.dept.name === '경영학과')?.feasible).toBe(false);
  });

  it('다전공을 하면 내 전공 기준이 79 → 51로 줄어든다', () => {
    expect(ownMajorShift(departments, student)).toEqual({ single: 79, multi: 51 });
  });

  it('마이크로디그리: 들은 과목만큼 남은 학점이 준다', () => {
    const md = recommendMd(all, courseMap, [t('MGMT1003'), t('MGMT2014')], 'SEOUL');
    const esg = md.find((m) => m.program.programId === 'MD-ESG')!;
    expect(esg.earned).toBe(6);
    expect(esg.needed).toBe(3);
  });

  it('가운뎃점 문자가 달라도 같은 학과로 찾는다', () => {
    expect(findDepartment(departments, '융합바이오·신소재공학과')).toBeDefined();
    expect(findDepartment(departments, '회계·세무학과')).toBeDefined();
  });
});
