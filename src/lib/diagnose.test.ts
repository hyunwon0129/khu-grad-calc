import { describe, expect, it } from 'vitest';
import { buildDiagnosis, maskLine } from './diagnose';
import { SAMPLE_REPORT_LINES } from './parseReport';

describe('읽기 실패 제보 (내용 가리기)', () => {
  it('이름·학번·과목명·학수번호는 남지 않고 머리말 단어만 남는다', () => {
    const m = maskLine('학번 2025123456 성명 홍길동 학과 산업경영공학과');
    expect(m).toBe('학번 0000000000 성명 가가가 학과 가가가가가가가');
    expect(maskLine('04 IE301 경영과학1 3 2026 / 1')).toBe('00 AA000 가가가가0 0 0000 / 0');
  });
  it('가상 사정표 전체를 가려도 원래 글자가 새지 않는다', () => {
    const d = buildDiagnosis([...SAMPLE_REPORT_LINES], { items: 0, courses: 21, areas: 9 });
    expect(d.text).not.toMatch(/홍길동|2025123456|SAMP\d/);
    expect(d.text).toContain('찾은 과목 21');
  });
});
