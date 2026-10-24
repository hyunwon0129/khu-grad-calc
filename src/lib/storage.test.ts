import { describe, expect, it } from 'vitest';
import { isEmpty, sameData, sanitize, type UserData } from './storage';

describe('저장·동기화 데이터', () => {
  it('허용 필드 외의 값은 저장 데이터에서 빠진다', () => {
    const dirty = {
      programId: 'P', name: '홍길동', studentId: '2025123456',
      taken: [{ code: 'AB123', term: '2025-1', status: 'TAKEN', grade: 'A+' }],
      custom: [], excluded: [], maxCreditsPerSemester: 9,
    } as unknown as UserData;
    const s = JSON.stringify(sanitize(dirty));
    expect(s).not.toMatch(/홍길동|2025123456|A\+|grade|studentId/);
    expect(s).toContain('AB123');
  });

  it('같은 내용이면 같다고 판단', () => {
    const a: UserData = { programId: 'P', taken: [], custom: [], excluded: [], maxCreditsPerSemester: 9 };
    expect(sameData(a, { ...a })).toBe(true);
    expect(isEmpty(a)).toBe(true);
  });
});
