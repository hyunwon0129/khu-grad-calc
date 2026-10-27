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

describe('교양 면제·대체 기준', () => {
  const nameMap = (extra: Course[]) => new Map<string, Course>([...map, ...extra.map((c) => [c.code, c] as [string, Course])]);
  const ie = { name: '산업경영공학과', college: '공과대학' };
  it('영어 점수 기준 (별표5)', async () => {
    const { meetsEnglishScore } = await import('./liberal');
    expect(meetsEnglishScore(data, 'TOEIC', 875)).toBe(true);
    expect(meetsEnglishScore(data, 'TOEIC', 870)).toBe(false);
    expect(meetsEnglishScore(data, 'TOEFL iBT', 99)).toBe(true);
    expect(meetsEnglishScore(data, 'TEPS', 351)).toBe(false);
  });
  it('대학영어 면제를 고르면 남은 필수교과에서 빠진다', () => {
    const st = analyzeLiberal(data, [], map, { nextSemester: 1, options: { studentType: '일반', englishExempt: true } });
    expect(st.required.find((r) => r.name === '대학영어')!.state).toBe('exempt');
  });
  it('산업경영공학과 학생이 미분적분학을 들으면 빅뱅에서문명까지 대체 인정 (별표4)', () => {
    const calc: Course = { code: 'AMTH1009', name: '미분적분학', credit: 3, typeByProgram: {} };
    const st = analyzeLiberal(data, [t('AMTH1009')], nameMap([calc]), { nextSemester: 1, dept: ie, admissionYear: 2025 });
    expect(st.required.find((r) => r.name === '빅뱅에서문명까지')!.state).toBe('subst');
  });
  it('대체 과목을 안 들었으면 들을 과목을 안내', () => {
    const st = analyzeLiberal(data, [], map, { nextSemester: 1, dept: ie, admissionYear: 2025 });
    expect(st.notes.some((n) => n.includes('미분적분학'))).toBe(true);
  });
  it('외국인 학생: 한국어 과목으로 대학영어 대체, 전공탐색세미나 면제', () => {
    const k: Course = { code: 'KOR101', name: '한국어1', credit: 2, typeByProgram: {} };
    const st = analyzeLiberal(data, [t('KOR101')], nameMap([k]), { nextSemester: 1, options: { studentType: '외국인', englishExempt: false } });
    expect(st.required.find((r) => r.name === '대학영어')!.state).toBe('subst');
    expect(st.freeSeminar).toBe('exempt');
  });
  it('편입생·2019~2023학번은 배분 영역 구분이 없다', () => {
    expect(analyzeLiberal(data, [], map, { nextSemester: 1, options: { studentType: '편입생', englishExempt: false } }).areaRule).toBe(false);
    const old = analyzeLiberal(data, [], map, { nextSemester: 1, admissionYear: 2021 });
    expect(old.areaRule).toBe(false);
    expect(old.rules.배분).toBe(12);
    expect(old.rules.총).toBe(32);
  });
  it('2019~2023학번 중국어학과: 한자와한자어로 배분이수 3학점 대체', () => {
    const c: Course = { code: 'CHN101', name: '한자와한자어', credit: 3, typeByProgram: {} };
    const st = analyzeLiberal(data, [t('CHN101')], nameMap([c]), { nextSemester: 1, dept: { name: '중국어학과', college: '외국어대학' }, admissionYear: 2021 });
    expect(st.substBaebun?.credit).toBe(3);
    expect(st.credits.배분).toBe(3);
  });
});
