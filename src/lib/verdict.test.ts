import { describe, expect, it } from 'vitest';
import { buildVerdict, estimateSemestersLeft, perSemester } from './verdict';
import type { AreaView } from '../components/SchoolProgress';

const v = (group: AreaView['group'], name: string, remaining: number): AreaView =>
  ({ group, name, earned: 0, required: 0, done: 0, pending: 0, remaining });

describe('한 줄 결론', () => {
  it('학점과 미충족 요건', () => {
    const r = buildVerdict([v('졸업', '졸업학점', 23), v('전공', '전공필수', 9)], [
      { key: 'thesis', name: '졸업논문·졸업시험', status: 'unmet' },
      { key: 'gpa', name: '졸업평점 (1.70 이상)', status: 'met' },
    ]);
    expect(r.headline).toBe('졸업까지 23학점, 졸업논문·졸업시험이 남았습니다');
  });

  it('받침 없는 끝 글자는 "가"', () => {
    expect(buildVerdict([v('졸업', '졸업학점', 0)], [{ key: 'english', name: '영어강의', status: 'unmet' }]).headline)
      .toBe('졸업까지 영어강의가 남았습니다');
  });

  it('학점만 남음', () => {
    expect(buildVerdict([v('졸업', '졸업학점', 12)], []).headline).toBe('졸업까지 12학점이 남았습니다');
  });

  it('모두 충족', () => {
    expect(buildVerdict([v('졸업', '졸업학점', 0)], []).allDone).toBe(true);
  });

  it('졸업학점은 채웠지만 영역이 남음', () => {
    expect(buildVerdict([v('졸업', '졸업학점', 0), v('교양', '배분이수', 3)], []).headline)
      .toBe('졸업학점은 채웠지만 배분이수 기준이 남았습니다');
  });
});

describe('학기당 필요 학점', () => {
  it('남은 학기 추정 (8학기 가정)', () => {
    expect(estimateSemestersLeft(2025, '2026-2')).toBe(4);
    expect(estimateSemestersLeft(2023, '2026-2')).toBe(0);
    expect(estimateSemestersLeft(null, '2026-2')).toBeNull();
  });
  it('학기당 학점', () => {
    expect(perSemester(23, 4)).toBe(6);
    expect(perSemester(23, 0)).toBeNull();
  });
});
