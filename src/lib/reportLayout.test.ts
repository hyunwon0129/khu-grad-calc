import { describe, expect, it } from 'vitest';
import type { TextItem } from './pdfText';
import { categorizeItems, graduationFromItems, reconcile, summarizeLines } from './reportLayout';

// 실제 사정표와 같은 배치의 가상 좌표 (값은 모두 가상)
const it_ = (str: string, x: number, y: number): TextItem => ({ str, x, y });
const items: TextItem[] = [
  // 상단 표
  it_('수강학점', 62, 745), it_('취득학점', 103, 745), it_('전공', 151, 745),
  it_('기준', 30, 734), it_('0', 73, 734), it_('130', 110, 734),
  it_('취득', 30, 723), it_('18', 71, 723), it_('61(79)', 106, 723),
  // 왼쪽: 교양
  it_('필수교과', 10, 573),
  it_('01', 22, 565), it_('GEC1001', 54, 565), it_('3', 200, 565),
  it_('02', 22, 557), it_('GEC1002', 58, 557),
  it_('배분이수', 10, 514),
  it_('02', 22, 506), it_('GED1001', 58, 506),
  it_('자유이수', 10, 463),
  it_('01', 22, 455), it_('GEE1001', 55, 455),
  it_('일반선택', 10, 404),
  it_('KHCU1001', 62, 396),
  it_('[금학기수강학점]', 10, 368),
  it_('05', 25, 357), it_('IE301', 70, 357),
  it_('11', 25, 324), it_('AMTH1001', 70, 324),
  it_('16', 25, 302), it_('GEC1003', 57, 302),
  // 오른쪽: 전공 (코드는 묶음 첫 행에만)
  it_('05', 251, 564), it_('IE201', 297, 564),
  it_('IE202', 297, 556),
  it_('11', 251, 516), it_('AMTH1002', 283, 516),
  it_('APHY1001', 297, 508),
];

describe('사정표 레이아웃', () => {
  const cats = categorizeItems(items);

  it('교양은 머리글로 분류 (01·02 영역 번호는 무시)', () => {
    expect(cats.get('GEC1001')).toBe('교양필수');
    expect(cats.get('GEC1002')).toBe('교양필수');
    expect(cats.get('GED1001')).toBe('배분이수');
    expect(cats.get('GEE1001')).toBe('자유이수');
    expect(cats.get('KHCU1001')).toBe('일반선택');
  });

  it('전공은 묶음 첫 행 코드를 아래 행이 이어받음', () => {
    expect(cats.get('IE201')).toBe('전공선택');
    expect(cats.get('IE202')).toBe('전공선택');
    expect(cats.get('AMTH1002')).toBe('전공기초');
    expect(cats.get('APHY1001')).toBe('전공기초');
  });

  it('이번 학기 수강 구역은 행마다 코드', () => {
    expect(cats.get('IE301')).toBe('전공선택');
    expect(cats.get('AMTH1001')).toBe('전공기초');
    expect(cats.get('GEC1003')).toBe('교양필수');
  });

  it("'기타' 묶음은 앞 머리글을 이어받지 않음", () => {
    const withEtc = [...items, it_('기타', 10, 430), it_('02', 22, 420), it_('AMTH2001', 54, 420)];
    expect(categorizeItems(withEtc).get('AMTH2001')).toBeUndefined();
  });

  it('미분류 과목은 소계와 딱 맞는 영역이 하나일 때만 채움', () => {
    const areas = [
      { group: '전공' as const, name: '전공기초', earned: 6, required: 12 },
      { group: '교양' as const, name: '자유이수', earned: 3, required: 3 },
    ];
    const rows = [
      { code: 'A101', credit: 3, status: 'TAKEN' as const, category: '전공기초' as const },
      { code: 'A102', credit: 3, status: 'TAKEN' as const, category: '자유이수' as const },
      { code: 'X999', credit: 3, status: 'TAKEN' as const },
    ];
    expect(reconcile(rows, areas).find((r) => r.code === 'X999')?.category).toBe('전공기초');
    // 맞는 영역이 둘이면 배정하지 않음
    const two = [...areas, { group: '전공' as const, name: '전공선택', earned: 3, required: 30 }];
    expect(reconcile(rows, two).find((r) => r.code === 'X999')?.category).toBeUndefined();
  });

  it('졸업학점 기준·취득', () => {
    expect(graduationFromItems(items)).toEqual({ group: '졸업', name: '졸업학점', earned: 61, required: 130 });
  });

  it('소계 줄에서 전공·교양 취득/기준', () => {
    const areas = summarizeLines([
      '필수교과 3 / 4 11 / 17 충족',
      '배분이수교과(2024~) 2 / 3 6 / 9 미충족 자유이수 1 / 1 4 / 3 충족',
      '전공계: 33 ( 전필: 6/21 전선: 15/30 전기: 12/12 )',
      'IE201 경영과학 3 2025 / 1',
    ]);
    expect(areas).toEqual([
      { group: '전공', name: '전공기초', earned: 12, required: 12 },
      { group: '전공', name: '전공필수', earned: 6, required: 21 },
      { group: '전공', name: '전공선택', earned: 15, required: 30 },
      { group: '교양', name: '교양필수', earned: 11, required: 17 },
      { group: '교양', name: '배분이수', earned: 6, required: 9 },
      { group: '교양', name: '자유이수', earned: 4, required: 3 },
    ]);
  });
});
