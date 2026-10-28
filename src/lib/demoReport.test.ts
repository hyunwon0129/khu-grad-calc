import { describe, expect, it } from 'vitest';
import courses from '../data/courses.json';
import programs from '../data/programs.json';
import departmentsData from '../data/departments.json';
import type { Course, DepartmentInfo, Program } from './types';
import { DEMO_STAGES, demoAdmissionYear, demoPrograms, makeDemoReport } from './demoReport';
import { analyzeReport } from './parseReport';
import { findDepartment } from './multi';
import { matchWithSchool } from './reportLayout';

const courseMap = new Map((courses as unknown as Course[]).map((c) => [c.code, c]));
const creditOf = new Map([...courseMap].map(([k, c]) => [k, c.credit]));
const all = programs as unknown as Program[];
const departments = departmentsData.departments as unknown as DepartmentInfo[];

describe('체험용 가상 사정표', () => {
  const list = demoPrograms(all);
  it('과목 목록이 있는 학과 대부분을 고를 수 있다', () => {
    expect(list.length).toBeGreaterThan(80);
  });
  it('모든 학과·단계에서 분석이 되고 과목 학점 합이 사정표 숫자와 맞는다', () => {
    let bad = 0;
    for (const p of list) {
      for (const st of DEMO_STAGES) {
        const d = makeDemoReport(p, courseMap, findDepartment(departments, p.department, p.campus) ?? null, st.id, '2026-2');
        const r = analyzeReport(d.lines, null, creditOf, '2026-2');
        expect(r.rows.length, p.department).toBeGreaterThan(3);
        expect(r.admissionYearHint).toBe(demoAdmissionYear(st.id, '2026-2'));
        expect(r.areas.some((a) => a.group === '졸업')).toBe(true);
        const m = matchWithSchool(r.rows.map((x) => ({ credit: x.credit, status: x.status, category: x.category })), r.areas);
        if (!m.ok) bad++;
      }
    }
    expect(bad).toBe(0);
  });
  it('같은 학과·단계면 늘 같은 결과', () => {
    const p = list.find((x) => x.department === '산업경영공학과')!;
    const a = makeDemoReport(p, courseMap, null, 'y3', '2026-2').lines.join('\n');
    const b = makeDemoReport(p, courseMap, null, 'y3', '2026-2').lines.join('\n');
    expect(a).toBe(b);
  });
});

import { findDepartment as deptFromHeader } from './parseReport';
describe('사정표 머리의 학과명', () => {
  it('가운뎃점·&·(야간)이 있는 학과명도 그대로 읽는다', () => {
    expect(deptFromHeader(['학번 2023000000 성명 체험학생 학과 회계･세무학과'])).toBe('회계･세무학과');
    expect(deptFromHeader(['학과 조리&푸드디자인학과'])).toBe('조리&푸드디자인학과');
    expect(deptFromHeader(['학과 간호학과(야간)'])).toBe('간호학과(야간)');
    expect(deptFromHeader(['학과 산업경영공학과'])).toBe('산업경영공학과');
  });
});

describe('학과명이 …과로 끝나는 경우', () => {
  it('작곡과·성악과·기악과도 읽는다', () => {
    expect(deptFromHeader(['학번 2024000000 성명 체험학생 학과 작곡과'])).toBe('작곡과');
    expect(deptFromHeader(['학과: 기악과'])).toBe('기악과');
  });
});
