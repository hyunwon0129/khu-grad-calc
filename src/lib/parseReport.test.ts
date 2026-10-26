import { describe, expect, it } from 'vitest';
import { currentTerm, parseReportLines, SAMPLE_REPORT_LINES } from './parseReport';

const creditOf = new Map([
  ['SAMP1001', 3], ['SAMP1002', 3], ['SAMP2001', 3], ['SAMP2002', 3], ['SAMP3002', 3],
]);

describe('사정표 파서', () => {
  const r = parseReportLines(SAMPLE_REPORT_LINES, creditOf, '2026-2');

  it('학수번호·학점·학기를 읽는다', () => {
    expect(r.rows.find((x) => x.code === 'SAMP1002')).toMatchObject({ credit: 3, term: '2025-2', status: 'TAKEN' });
  });

  it('현재 학기 과목은 수강 중으로 분류', () => {
    expect(r.rows.find((x) => x.code === 'SAMP2002')?.status).toBe('IN_PROGRESS');
  });

  it('하단 목록의 중복 행을 제거', () => {
    expect(r.rows.filter((x) => x.code === 'SAMP1001')).toHaveLength(1);
    expect(r.duplicatesRemoved).toBe(3);
  });

  it('미등록 학수번호는 확인 필요로 표시', () => {
    expect(r.rows.find((x) => x.code === 'GEC1002')).toMatchObject({ known: false, lowConfidence: true, credit: 2 });
  });

  it('학번은 입학연도만 남기고 개인정보 줄을 지운다', () => {
    expect(r.admissionYearHint).toBe(2025);
    expect(r.piiLinesRemoved).toBe(3);
    expect(JSON.stringify(r)).not.toMatch(/2025123456|031-000-0000|example\.com|홍길동/);
  });

  it('출력일시의 날짜를 학기로 오인하지 않는다', () => {
    expect(r.rows.some((x) => x.code.startsWith('20'))).toBe(false);
  });

  it('과목명이 숫자로 끝나도 학기 바로 앞 숫자를 학점으로 읽는다', () => {
    const lines = [
      '02 ABC101 설계1 3 2025 / 1 IE202 프로그래밍실습2 1 2025 / 2',
      'SWCON111 컴퓨터구조/실습3 2026 / 1',
    ];
    const rows = parseReportLines(lines, new Map(), '2026-2').rows;
    expect(rows.find((x) => x.code === 'ABC101')?.credit).toBe(3);
    expect(rows.find((x) => x.code === 'IE202')).toMatchObject({ credit: 1, term: '2025-2' });
    expect(rows.find((x) => x.code === 'SWCON111')).toMatchObject({ credit: 3, term: '2026-1' });
  });

  it('사정표 머리 부분에서 학과명만 찾는다', () => {
    expect(r.departmentHint).toBe('가상학과');
    expect(parseReportLines(['소속 체육대학 태권도학과 주전공 홍길동', 'TKD101 3 2025 / 1'], new Map(), '2026-2').departmentHint).toBe('태권도학과');
    expect(parseReportLines(['주전공 다전공', 'AB101 3 2025 / 1', '전공탐색학과'], new Map(), '2026-2').departmentHint).toBeNull();
  });

  it('현재 학기 계산', () => {
    expect(currentTerm(new Date('2026-10-25'))).toBe('2026-2');
    expect(currentTerm(new Date('2026-03-02'))).toBe('2026-1');
    expect(currentTerm(new Date('2027-01-10'))).toBe('2026-2');
  });
});
