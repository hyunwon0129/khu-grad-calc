// 결과 화면 맨 위 한 줄 결론과 학기당 필요 학점
import type { RequirementCheck } from './requirements';
import type { AreaView } from '../components/SchoolProgress';

export interface Verdict {
  headline: string;            // 한 문장 결론
  remainingCredits: number;    // 이번 학기를 마친 뒤 남는 졸업학점
  lackingAreas: { name: string; remaining: number }[];
  unmetChecks: string[];
  allDone: boolean;
}

export function buildVerdict(views: AreaView[], checks: RequirementCheck[]): Verdict {
  const grad = views.find((v) => v.group === '졸업');
  const remainingCredits = grad?.remaining ?? 0;
  const lackingAreas = views.filter((v) => v.group !== '졸업' && v.remaining > 0).map((v) => ({ name: v.name, remaining: v.remaining }));
  const unmetChecks = checks.filter((c) => c.status === 'unmet').map((c) => c.name.replace(/\s*\(.*\)$/, ''));
  const allDone = remainingCredits === 0 && lackingAreas.length === 0 && unmetChecks.length === 0;

  const parts: string[] = [];
  if (remainingCredits > 0) parts.push(`${remainingCredits}학점`);
  // 졸업학점은 채웠어도 영역 기준이 모자라면 그 영역 이름을 먼저 말한다
  if (remainingCredits === 0 && lackingAreas.length) parts.push(lackingAreas.map((a) => a.name).join('·'));
  if (unmetChecks.length) parts.push(unmetChecks.join('·'));
  const headline = allDone
    ? '이번 학기까지 마치면 사정표의 학점·요건을 모두 채웁니다'
    : remainingCredits === 0 && lackingAreas.length > 0 && unmetChecks.length === 0
      ? `졸업학점은 채웠지만 ${lackingAreas.map((a) => a.name).join('·')} 기준이 남았습니다`
      : `졸업까지 ${parts.join(', ')}이 남았습니다`.replace(/([가-힣])이 남았습니다$/, (_m, last: string) => `${last}${hasBatchim(last) ? '이' : '가'} 남았습니다`);
  return { headline, remainingCredits, lackingAreas, unmetChecks, allDone };
}

function hasBatchim(ch: string): boolean {
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 입학연도 기준으로 이번 학기 다음부터 남은 정규 학기 수 (휴학 없이 8학기 가정) */
export function estimateSemestersLeft(admissionYear: number | null, nowTerm: string, total = 8): number | null {
  if (!admissionYear) return null;
  const [y, s] = nowTerm.split('-').map(Number);
  const current = (y - admissionYear) * 2 + s; // 이번 학기가 몇 번째 학기인지
  if (current < 1) return null;
  return Math.max(0, total - current);
}

export function perSemester(remaining: number, semesters: number): number | null {
  if (semesters <= 0) return null;
  return Math.ceil(remaining / semesters);
}
