// 기기 안 자동 저장. 과목(학수번호·과목명·학점·학기·이수구분)·영역별 학점·설정만 담고 이름·학번·성적·원본 파일은 저장하지 않는다.
// 브라우저 저장소가 막힌 환경(비공개 창 등)에서도 앱은 그대로 동작한다.
import type { Course, TakenCourse } from './types';
import type { ReportData } from './reportLayout';
import type { PlannedItem } from './whatif';

const KEY = 'khu-grad-calc:v1';

/** 기기·서버에 저장하는 사용자 데이터. 여기 없는 필드는 어디에도 저장되지 않는다. */
export interface UserData {
  programId: string;
  taken: TakenCourse[];
  custom: Course[];
  excluded: string[];
  maxCreditsPerSemester: number;
  report?: ReportData | null;       // 졸업사정표 분석 결과 (학교 기준 영역별 학점·과목 분류)
  plans?: PlannedItem[];            // 만약에 시뮬레이터의 계획 과목
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
    plans: (s.plans ?? []).slice(0, 40).map(({ id, name, category, credit }) => ({
      id: String(id), name: String(name ?? '').slice(0, 40), category, credit: Math.max(0, Math.min(6, Number(credit) || 0)),
    })),
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
  return s.taken.length === 0 && s.custom.length === 0 && s.excluded.length === 0 && !s.report && !(s.plans?.length);
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

// 공용 PC 모드: 켜면 이 기기에 아무것도 저장하지 않는다 (설정 표시 1글자만 남김)
const NOSAVE_KEY = 'khu-grad-calc:nosave';
export function getNoSave(): boolean {
  try { return localStorage.getItem(NOSAVE_KEY) === '1'; } catch { return false; }
}
export function setNoSave(v: boolean): void {
  try {
    if (v) { localStorage.setItem(NOSAVE_KEY, '1'); localStorage.removeItem(KEY); }
    else localStorage.removeItem(NOSAVE_KEY);
  } catch { /* 무시 */ }
}
