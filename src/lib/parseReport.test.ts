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
    expect(r.rows.find((x) => x.code === 'ZZZ1234')).toMatchObject({ known: false, lowConfidence: true, credit: 2 });
  });

  it('학번은 입학연도만 남기고 개인정보 줄을 지운다', () => {
    expect(r.admissionYearHint).toBe(2025);
    expect(r.piiLinesRemoved).toBe(3);
    expect(JSON.stringify(r)).not.toMatch(/2025123456|031-000-0000|example\.com|홍길동/);
  });

  it('출력일시의 날짜를 학기로 오인하지 않는다', () => {
    expect(r.rows.some((x) => x.code.startsWith('20'))).toBe(false);
  });

  it('현재 학기 계산', () => {
    expect(currentTerm(new Date('2026-10-25'))).toBe('2026-2');
    expect(currentTerm(new Date('2026-03-02'))).toBe('2026-1');
    expect(currentTerm(new Date('2027-01-10'))).toBe('2026-2');
  });
});
