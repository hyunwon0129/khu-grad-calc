import { describe, expect, it } from 'vitest';
import { mailboxFor } from './AccountPanel';

describe('로그인 메일함 바로가기', () => {
  it('Gmail은 최근 메일 검색(스팸 포함)으로 연다', () => {
    expect(mailboxFor('a@gmail.com')?.url).toContain('mail.google.com');
    expect(mailboxFor('a@GMAIL.com')?.name).toBe('Gmail');
  });
  it('네이버·다음·Outlook도 연결, 모르는 도메인은 없음', () => {
    expect(mailboxFor('a@naver.com')?.name).toBe('네이버 메일');
    expect(mailboxFor('a@hanmail.net')?.name).toBe('다음 메일');
    expect(mailboxFor('a@outlook.com')?.name).toBe('Outlook');
    expect(mailboxFor('a@khu.ac.kr')).toBeNull();
  });
});
