import { describe, expect, it } from 'vitest';
import courses from '../data/courses.json';
import programs from '../data/programs.json';
import type { Course, Program, TakenCourse } from './types';
import { recommendCourses, studentYearAt } from './recommendCourses';

const courseMap = new Map((courses as unknown as Course[]).map((c) => [c.code, c]));
const all = programs as unknown as Program[];
const ie = all.find((p) => p.programId === 'IE-2025-MAJOR')!;
const t = (code: string): TakenCourse => ({ code, term: '2025-1', status: 'TAKEN' });

describe('다음 학기 추천 (점수 방식)', () => {
  it('학년 계산: 2025학번의 2027-1학기는 3학년', () => {
    expect(studentYearAt(2025, '2027-1')).toBe(3);
    expect(studentYearAt(2025, '2025-2')).toBe(1);
  });

  it('들은 과목·수강 중 과목은 추천하지 않고, 선수과목 미이수 과목은 따로 모은다', () => {
    const r = recommendCourses(ie, courseMap, [t('IE207')], { nowTerm: '2026-2', admissionYear: 2025 });
    expect(r.ranked.some((c) => c.code === 'IE207')).toBe(false);
    expect(r.ranked.some((c) => c.code === 'IE208')).toBe(true);   // 실험통계학 → 응용통계학 가능
    expect(r.blocked.some((c) => c.code === 'IE312')).toBe(true);  // 품질공학은 응용통계학 먼저
  });

  it('전공필수·전부 들어야 하는 전공기초가 위로 오고 이유가 붙는다', () => {
    const r = recommendCourses(ie, courseMap, [], { nowTerm: '2025-2', admissionYear: 2025 });
    const top = r.ranked[0];
    expect(top.reasons.some((x) => x.kind === 'must')).toBe(true);
  });

  it('다음 학기 미개설 과목은 묶음에 넣지 않고, 묶음은 학점 상한을 지킨다', () => {
    const r = recommendCourses(ie, courseMap, [], { nowTerm: '2025-2', admissionYear: 2025, maxCredits: 9 });
    expect(r.bundleCredits).toBeLessThanOrEqual(9);
    expect(r.bundle.every((c) => c.offeredNext !== false)).toBe(true);
  });

  it('택1 과목은 하나만 묶음에 들어간다', () => {
    const r = recommendCourses(ie, courseMap, [], { nowTerm: '2025-2', admissionYear: 2025, maxCredits: 30 });
    const codes = r.bundle.map((c) => c.code);
    expect(codes.filter((c) => c === 'IE104' || c === 'SWCON104').length).toBeLessThanOrEqual(1);
  });

  it('관심 다전공에서도 인정되는 과목에 가산점', () => {
    const ce = all.find((p) => p.programId === 'CE-2024-MULTI')!;
    const base = recommendCourses(ie, courseMap, [], { nowTerm: '2025-2', admissionYear: 2025 });
    const withMulti = recommendCourses(ie, courseMap, [], { nowTerm: '2025-2', admissionYear: 2025, multiProgram: ce });
    const s0 = base.ranked.concat(base.blocked).find((c) => c.code === 'AMTH1009')!.score;
    const s1 = withMulti.ranked.concat(withMulti.blocked).find((c) => c.code === 'AMTH1009')!;
    expect(s1.score).toBe(s0 + 8);
    expect(s1.reasons.some((x) => x.kind === 'multi')).toBe(true);
  });

  it('국제·서울 모든 과정에서 오류 없이 추천이 나온다', () => {
    for (const p of all.filter((x) => x.kind === 'MAJOR')) {
      const r = recommendCourses(p, courseMap, [], { nowTerm: '2026-2', admissionYear: 2026 });
      expect(r.ranked.length + r.blocked.length, p.department).toBeGreaterThan(0);
    }
  });
});
