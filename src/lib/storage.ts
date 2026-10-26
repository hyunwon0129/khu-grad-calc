// 기기 안 자동 저장. 과목(학수번호·과목명·학점·학기·이수구분)·영역별 학점·설정만 담고 이름·학번·성적·원본 파일은 저장하지 않는다.
// 브라우저 저장소가 막힌 환경(비공개 창 등)에서도 앱은 그대로 동작한다.
import type { Course, TakenCourse } from './types';
import type { ReportData } from './reportLayout';

const KEY = 'khu-grad-calc:v1';

/** 기기·서버에 저장하는 사용자 데이터. 여기 없는 필드는 어디에도 저장되지 않는다. */
export interface UserData {
  programId: string;
  taken: TakenCourse[];
  custom: Course[];
  excluded: string[];
  maxCreditsPerSemester: number;
  report?: ReportData | null;       // 졸업사정표 분석 결과 (학교 기준 영역별 학점·과목 분류)
}

export interface SavedState extends UserData {
  savedAt: string; // 날짜만
}

/** 허용 필드만 남긴다 (추가 필드가 섞여 들어와도 저장되지 않게) */
export function sanitize(s: UserData): UserData {
  return {
    programId: String(s.programId),
    taken: (s.taken ?? []).map(({ code, term, status }) => ({ code, term, status })),
    custom: (s.custom ?? []).map(({ code, name, credit, typeByProgram, source }) => ({ code, name, credit, typeByProgram, ...(source ? { source } : {}) })),
    excluded: (s.excluded ?? []).map(String),
    maxCreditsPerSemester: Number(s.maxCreditsPerSemester) || 9,
    report: s.report
      ? {
          source: s.report.source === 'SAMPLE' ? 'SAMPLE' : 'PDF',
          importedAt: String(s.report.importedAt),
          department: s.report.department ? String(s.report.department).slice(0, 40) : null,
          admissionYear: Number(s.report.admissionYear) || null,
          areas: (s.report.areas ?? []).map(({ group, name, earned, required }) => ({ group, name, earned: Number(earned), required: Number(required) })),
          categories: Object.fromEntries(Object.entries(s.report.categories ?? {}).map(([k, v]) => [String(k), v])),
          checks: (s.report.checks ?? []).map(({ key, name, status, detail, hint }) => ({
            key: String(key), name: String(name), status,
            ...(detail && key !== 'gpa' ? { detail: String(detail).slice(0, 20) } : {}),
            ...(hint ? { hint: String(hint) } : {}),
          })),
        }
      : null,
  };
}

export function sameData(a: UserData, b: UserData): boolean {
  return JSON.stringify(sanitize(a)) === JSON.stringify(sanitize(b));
}

export function isEmpty(s: UserData): boolean {
  return s.taken.length === 0 && s.custom.length === 0 && s.excluded.length === 0 && !s.report;
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedState;
    return Array.isArray(s.taken) ? { ...sanitize(s), savedAt: s.savedAt } : null;
  } catch {
    return null;
  }
}

export function saveState(s: UserData): void {
  try {
    const clean: SavedState = { ...sanitize(s), savedAt: new Date().toISOString().slice(0, 10) };
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* 저장 불가 환경: 무시 */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
