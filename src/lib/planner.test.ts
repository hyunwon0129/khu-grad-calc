import { describe, expect, it } from 'vitest';
import courses from '../data/courses.json';
import programs from '../data/programs.json';
import type { Course, Program, TakenCourse } from './types';
import { nextTerm, planRoadmap } from './planner';

const courseMap = new Map((courses as Course[]).map((c) => [c.code, c]));
const major = (programs as Program[])[0];

describe('로드맵', () => {
  it('학기 넘김', () => {
    expect(nextTerm('2026-2')).toBe('2027-1');
    expect(nextTerm('2027-1')).toBe('2027-2');
  });

  it('선수과목보다 뒤 학기에 배치하고 요건을 모두 채운다', () => {
    const plan = planRoadmap(major, courseMap, [], { fromTerm: '2027-1', maxCreditsPerSemester: 9 });
    const termOf = new Map(plan.semesters.flatMap((s) => s.courses.map((c) => [c.code, s.term])));
    expect(termOf.get('SAMP2001')! > termOf.get('SAMP1001')!).toBe(true);
    expect(termOf.get('SAMP3001')! > termOf.get('SAMP2001')!).toBe(true);
    expect(plan.shortfall).toEqual([]);
    expect(plan.graduationTerm).not.toBeNull();
  });

  it('학기당 학점 상한을 지킨다', () => {
    const plan = planRoadmap(major, courseMap, [], { fromTerm: '2027-1', maxCreditsPerSemester: 6 });
    expect(plan.semesters.every((s) => s.credits <= 6)).toBe(true);
  });

  it('필요한 만큼만 배치한다 (전기 충족 시 전기 과목 미배치)', () => {
    const taken: TakenCourse[] = [
      { code: 'SAMP1001', term: '2025-1', status: 'TAKEN' },
      { code: 'SAMP1002', term: '2025-2', status: 'TAKEN' },
    ];
    const plan = planRoadmap(major, courseMap, taken, { fromTerm: '2027-1', maxCreditsPerSemester: 9 });
    expect(plan.plannedByCategory.get('전기') ?? 0).toBe(0);
    expect(plan.plannedByCategory.get('전필')).toBe(9);
  });

  it('빼기로 한 과목 때문에 모자라면 부족 학점을 알려준다', () => {
    const plan = planRoadmap(major, courseMap, [], {
      fromTerm: '2027-1', maxCreditsPerSemester: 9, excluded: new Set(['SAMP3003']),
    });
    expect(plan.shortfall).toEqual([{ category: '전선', credits: 3 }]);
    expect(plan.graduationTerm).toBeNull();
  });

  it('이미 다 채웠으면 충족', () => {
    const all: TakenCourse[] = major.courses.map((code) => ({ code, term: '2025-1', status: 'TAKEN' }));
    expect(planRoadmap(major, courseMap, all, { fromTerm: '2027-1', maxCreditsPerSemester: 9 }).graduationTerm).toBe('충족');
  });
});
