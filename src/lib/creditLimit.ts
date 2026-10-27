// 학기별 수강허용학점 — 2026 학사제도안내 64쪽 【대학별 수강허용학점】 (편입생은 학번 기준)
// 1학기 = 등록예정학기가 홀수인 학기, 2학기 = 짝수인 학기
import type { DepartmentInfo } from './types';
import { normDept } from './dept';

export interface CreditLimit {
  first: number;   // 홀수 학기(1학기)
  second: number;  // 짝수 학기(2학기)
  basis: string;   // 화면에 보여 줄 근거
}

const flat = (n: number) => ({ first: n, second: n });
const split = { first: 18, second: 15 };

/** 학과(단과대학)와 입학연도로 수강허용학점을 찾는다. 모르면 null */
export function creditLimit(dept: Pick<DepartmentInfo, 'college' | 'name'> | null | undefined, admissionYear: number | null): CreditLimit | null {
  if (!dept || !admissionYear) return null;
  const college = dept.college;
  const name = normDept(dept.name);
  const is = (...names: string[]) => names.some((n) => normDept(n) === name);
  const y = admissionYear;
  const mk = (v: { first: number; second: number }, rule: string): CreditLimit => ({ ...v, basis: `${rule} · ${y}학번` });

  // 학과 단위 예외 먼저
  if (is('컴퓨터공학과')) return mk(y <= 2023 ? { first: 21, second: 18 } : flat(18), '컴퓨터공학과');
  if (is('간호학과')) return mk(y <= 2015 ? { first: 19, second: 20 } : flat(18), '간호학과');
  if (is('식품영양학과')) return mk(flat(18), '생활과학대학 식품영양학과');
  if (is('약과학과')) return mk(flat(18), '약학대학 약과학과');
  if (is('약학과(6년제)')) return mk(flat(23), '약학과(6년제)');
  if (is('한약학과')) return mk(flat(21), '한약학과');
  if (is('Hospitality경영학과', '조리&푸드디자인학과', '글로벌Hospitality･관광학과')) return mk(y <= 2017 ? flat(18) : split, '호텔관광대학');
  if (is('관광학과', '문화엔터테인먼트학과', '문화관광산업학과', '조리산업학과')) return mk(y <= 2015 ? flat(18) : split, '호텔관광대학');
  if (is('글로벌문화기술')) return mk(y <= 2019 ? flat(18) : split, '글로벌문화기술');

  switch (college) {
    case '문과대학':
    case '체육대학':
      return mk(y <= 2023 ? flat(18) : split, college);
    case '생활과학대학': // 아동가족·주거환경·의상 (식품영양은 위에서)
      return mk(y <= 2023 ? flat(18) : split, college);
    case '이과대학':
    case '공과대학':
    case '전자정보대학':
    case '응용과학대학':
    case '생명과학대학':
    case '소프트웨어융합대학':
      return mk(flat(18), college);
    case '정경대학':
    case '경영대학':
    case '무용학부':
    case '음악대학':
      return mk(y <= 2017 ? flat(18) : split, college);
    case '미술대학':
      return mk(y <= 2015 ? flat(18) : split, college);
    case '의과대학':
    case '치과대학':
      return mk(flat(23), '의학계열');
    case '국제대학':
      return mk(split, college);
    case '예술･디자인대학':
      return mk(y <= 2019 ? flat(18) : split, college);
    case '외국어대학':
      return mk(y <= 2018 ? flat(18) : split, college);
    case '자율전공학부':
      return mk(y <= 2019 ? flat(18) : split, college);
    default:
      return null; // 미래정보디스플레이학부·융합전공 등: 표에 따로 없음
  }
}

/** 이번 학기 다음부터 n학기 동안 들을 수 있는 최대 학점 */
export function capacity(limit: Pick<CreditLimit, 'first' | 'second'>, nowTerm: string, semesters: number): number {
  const s = Number(nowTerm.split('-')[1]);
  let total = 0;
  for (let i = 1; i <= semesters; i++) total += (s + i) % 2 === 1 ? limit.first : limit.second;
  return total;
}
