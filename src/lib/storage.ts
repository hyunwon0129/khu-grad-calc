// 기기 안 자동 저장. 학수번호·학기·설정만 담고 이름·학번·원본 파일은 저장하지 않는다.
// 브라우저 저장소가 막힌 환경(비공개 창 등)에서도 앱은 그대로 동작한다.
import type { Course, TakenCourse } from './types';

const KEY = 'khu-grad-calc:v1';

/** 기기·서버에 저장하는 사용자 데이터. 여기 없는 필드는 어디에도 저장되지 않는다. */
export interface UserData {
  programId: string;
  taken: TakenCourse[];
  custom: Course[];
  excluded: string[];
  maxCreditsPerSemester: number;
}

export interface SavedState extends UserData {
  savedAt: string; // 날짜만
}

/** 허용 필드만 남긴다 (추가 필드가 섞여 들어와도 저장되지 않게) */
export function sanitize(s: UserData): UserData {
  return {
    programId: String(s.programId),
    taken: (s.taken ?? []).map(({ code, term, status }) => ({ code, term, status })),
    custom: (s.custom ?? []).map(({ code, name, credit, typeByProgram }) => ({ code, name, credit, typeByProgram })),
    excluded: (s.excluded ?? []).map(String),
    maxCreditsPerSemester: Number(s.maxCreditsPerSemester) || 9,
  };
}

export function sameData(a: UserData, b: UserData): boolean {
  return JSON.stringify(sanitize(a)) === JSON.stringify(sanitize(b));
}

export function isEmpty(s: UserData): boolean {
  return s.taken.length === 0 && s.custom.length === 0 && s.excluded.length === 0;
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
