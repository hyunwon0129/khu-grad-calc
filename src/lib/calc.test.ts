import { describe, expect, it } from 'vitest';
import courses from '../data/courses.json';
import programs from '../data/programs.json';
import type { Course, Program, TakenCourse } from './types';
import { calculate, findProgram } from './calc';
import { recommendNext, recommendPrograms } from './recommend';

const courseMap = new Map((courses as Course[]).map((c) => [c.code, c]));
const all = programs as Program[];
const major = all[0];
const profile = { admissionYear: 2025, campus: 'INTL' as const, department: '[샘플] 가상학과' };

describe('계산', () => {
  it('체크 없음 → 잔여 = 기준 학점', () => {
    const r = calculate(major, courseMap, []);
    expect(r.areas.map((a) => a.remaining)).toEqual([6, 9, 9]);
  });

  it('영역별 취득·잔여 계산', () => {
    const taken: TakenCourse[] = [
      { code: 'SAMP1001', term: '2025-1', status: 'TAKEN' },
      { code: 'SAMP1002', term: '2025-2', status: 'TAKEN' },
      { code: 'SAMP2001', term: '2026-1', status: 'TAKEN' },
    ];
    const r = calculate(major, courseMap, taken);
    expect(r.areas.find((a) => a.category === '전기')?.remaining).toBe(0);
    expect(r.areas.find((a) => a.category === '전필')?.remaining).toBe(6);
    expect(r.totalRemaining).toBe(15);
  });

  it('중복 행은 한 번만 계산', () => {
    const row: TakenCourse = { code: 'SAMP1001', term: '2025-1', status: 'TAKEN' };
    expect(calculate(major, courseMap, [row, row]).totalEarned).toBe(3);
  });

  it('수강 중 과목은 기본적으로 미확정으로 분리', () => {
    const r = calculate(major, courseMap, [{ code: 'SAMP2001', term: '2026-2', status: 'IN_PROGRESS' }]);
    expect(r.totalEarned).toBe(0);
    expect(r.areas.find((a) => a.category === '전필')?.pending).toBe(3);
  });

  it('해당 연도 과정이 없으면 이전 연도 과정을 제안', () => {
    const r = findProgram(all, { ...profile, admissionYear: 2026 });
    expect(r.program?.programId).toBe('SAMPLE-2025-MAJOR');
    expect(r.exact).toBe(false);
  });
});

describe('추천', () => {
  it('선수과목 미이수 과목은 수강 불가로 분류', () => {
    const recs = recommendNext(major, courseMap, []);
    expect(recs.find((c) => c.code === 'SAMP3001')?.available).toBe(false);
    expect(recs.find((c) => c.code === 'SAMP1001')?.available).toBe(true);
  });

  it('겹치는 과목이 많은 과정의 추가 필요 학점이 줄어든다', () => {
    const taken: TakenCourse[] = [
      { code: 'SAMP1002', term: '2025-2', status: 'TAKEN' },
      { code: 'SAMP3002', term: '2026-1', status: 'TAKEN' },
    ];
    const [md] = recommendPrograms([all[1]], courseMap, taken, 18, 4);
    expect(md.overlapCredits).toBe(6);
    expect(md.neededCredits).toBe(6);
    expect(md.policyUnknown).toBe(true);
  });
});
