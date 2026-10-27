import { describe, expect, it } from 'vitest';
import liberal from '../data/liberal.json';
import type { Course, TakenCourse } from './types';
import { analyzeLiberal, type LiberalData } from './liberal';

const data = liberal as unknown as LiberalData;
const map = new Map<string, Course>(data.courses.map((c) => [c.code, { code: c.code, name: c.name, credit: c.credit, typeByProgram: {} }]));
const t = (code: string, status: TakenCourse['status'] = 'TAKEN'): TakenCourse => ({ code, term: '2025-1', status });

describe('교양(후마니타스) 분석', () => {
  it('편성표: 필수교과 6과목 17학점, 배분·자유 과목 수백 개', () => {
    expect(data.required.reduce((s, r) => s + r.credit, 0)).toBe(17);
    expect(data.courses.filter((c) => c.kind === '배분').length).toBeGreaterThan(200);
  });
  it('들은 필수교과는 이수, 안 들은 것은 남음', () => {
    const st = analyzeLiberal(data, [t('GEC1102'), t('GEC1105', 'IN_PROGRESS')], map, { nextSemester: 1 });
    const s = Object.fromEntries(st.required.map((r) => [r.name, r.state]));
    expect(s['인간의가치탐색']).toBe('done');
    expect(s['성찰과표현']).toBe('ongoing');
    expect(s['주제연구']).toBe('todo');
  });
  it('배분 영역: 들은 영역은 표시되고 안 들은 영역에서 과목을 추천', () => {
    const area3 = data.courses.find((c) => c.kind === '배분' && c.area === 3)!;
    const st = analyzeLiberal(data, [t(area3.code)], map, { nextSemester: 1 });
    expect(st.areaCovered).toBe(1);
    expect(st.suggestions.some((s) => s.area === 3)).toBe(false);
    expect(st.suggestions.length).toBe(4);
    expect(st.suggestions.flatMap((s) => s.courses).every((c) => c.s1)).toBe(true);
  });
  it('전공탐색및기업가정신세미나를 안 들었으면 자유이수 필수로 알려줌', () => {
    expect(analyzeLiberal(data, [], map, { nextSemester: 1 }).freeSeminar).toBe('todo');
    expect(analyzeLiberal(data, [t('GEE1952')], map, { nextSemester: 1 }).freeSeminar).toBe('done');
  });
});
