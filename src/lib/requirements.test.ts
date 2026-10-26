import { describe, expect, it } from 'vitest';
import type { TextItem } from './pdfText';
import { checksFromItems, checksFromLines, judge, manualChecks } from './requirements';

const t = (str: string, x: number, y: number): TextItem => ({ str, x, y });
// 실제 사정표 상단 표와 같은 배치 (값은 가상)
const items: TextItem[] = [
  t('졸업판정', 22, 757), t('한국어능력인증', 350, 757), t('졸업능력인증', 412, 757), t('SW인증', 490, 757),
  t('구분', 31, 745), t('수강학점', 62, 745), t('취득학점', 103, 745), t('전공', 151, 745), t('교양', 193, 745),
  t('졸업평점', 228, 745), t('영어강의', 270, 745), t('논문', 319, 745), t('TOPIK', 369, 745),
  t('구분', 424, 745), t('판정', 463, 745), t('구분', 500, 745), t('판정', 539, 745),
  t('기준', 31, 734), t('0', 73, 734), t('130', 110, 734), t('0', 156, 734), t('0', 198, 734), t('1.7', 237, 734),
  t('3', 282, 734), t('1', 324, 734), t('해당없음', 365, 734), t('토익', 420, 734), t('면제', 463, 734), t('필수+선택', 490, 734), t('6', 544, 734),
  t('취득', 31, 723), t('18', 71, 723), t('61(79)', 106, 723), t('0', 156, 723), t('0', 198, 723), t('3.512', 233, 723),
  t('2', 282, 723), t('0', 324, 723), t('토익(면제)', 414, 723), t('면제', 463, 723), t('필수', 500, 723), t('12', 542, 723),
];

describe('학점 밖 졸업요건', () => {
  const checks = checksFromItems(items);
  const by = (k: string) => checks.find((c) => c.key === k);

  it('표에서 요건별 판정', () => {
    expect(by('english')).toMatchObject({ status: 'unmet', detail: '2/3과목' });
    expect(by('thesis')).toMatchObject({ status: 'unmet' });
    expect(by('exit')).toMatchObject({ status: 'exempt' });
    expect(by('sw')).toMatchObject({ status: 'met' });
    expect(by('topik')).toBeUndefined(); // 해당없음은 숨김
  });

  it('평점은 충족 여부만, 값은 남기지 않음', () => {
    expect(by('gpa')).toEqual({ key: 'gpa', name: '졸업평점 (1.70 이상)', status: 'met', hint: undefined });
    expect(JSON.stringify(checks)).not.toMatch(/3\.512|3\.5/);
  });

  it('글자 판정', () => {
    expect(judge('', '충족', {}).status).toBe('met');
    expect(judge('', '미이수', {}).status).toBe('unmet');
    expect(judge('3', '', { unit: '과목' })).toEqual({ status: 'unmet', detail: '0/3과목' });
  });

  it('가상 사정표 줄 형식', () => {
    const c = checksFromLines(['영어강의 1 / 3', 'SW인증 면제', '졸업평점 충족', 'TOPIK 해당없음']);
    expect(c.map((x) => [x.key, x.status])).toEqual([['english', 'unmet'], ['sw', 'exempt'], ['gpa', 'met']]);
  });

  it('2026학번은 다전공·MD·부전공 요건 추가', () => {
    expect(manualChecks(2025).some((m) => m.name.includes('다전공'))).toBe(false);
    expect(manualChecks(2026).some((m) => m.name.includes('다전공'))).toBe(true);
  });
});
