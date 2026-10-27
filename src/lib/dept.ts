// 학과명 비교: "[샘플] 가상학과", "가상 학과" 같은 표기 차이를 무시하고 비교한다.
import type { Program } from './types';

// 가운뎃점은 PDF·글꼴마다 문자가 달라(･ · ・ · ‧) 하나로 맞춘다
export const normDept = (s: string) =>
  s.replace(/\[[^\]]*\]/g, '').replace(/[\u00B7\u0387\u2027\u30FB\uFF65\u318D]/g, '·').replace(/\s+/g, '').trim();

export function sameDept(a: string, b: string): boolean {
  return normDept(a) === normDept(b);
}

/** 사정표의 학과·입학연도에 맞는 주전공 과정을 찾는다. 연도가 안 맞으면 같은 학과의 가장 가까운 이전 연도 과정. */
export function matchProgram(majors: Program[], department: string, year: number | null): Program | undefined {
  const same = majors.filter((p) => sameDept(p.department, department));
  if (same.length === 0) return undefined;
  if (year) {
    const exact = same.find((p) => p.admissionYearRange[0] <= year && year <= p.admissionYearRange[1]);
    if (exact) return exact;
    const earlier = same.filter((p) => p.admissionYearRange[1] < year).sort((a, b) => b.admissionYearRange[1] - a.admissionYearRange[1]);
    if (earlier[0]) return earlier[0];
  }
  return same[0];
}
