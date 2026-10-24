// 기기 안 자동 저장. 학수번호·학기·설정만 담고 이름·학번·원본 파일은 저장하지 않는다.
// 브라우저 저장소가 막힌 환경(비공개 창 등)에서도 앱은 그대로 동작한다.
import type { Course, TakenCourse } from './types';

const KEY = 'khu-grad-calc:v1';

export interface SavedState {
  programId: string;
  taken: TakenCourse[];
  custom: Course[];
  excluded: string[];
  maxCreditsPerSemester: number;
  savedAt: string; // 날짜만
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedState;
    return Array.isArray(s.taken) ? s : null;
  } catch {
    return null;
  }
}

export function saveState(s: Omit<SavedState, 'savedAt'>): void {
  try {
    const clean: SavedState = {
      programId: s.programId,
      taken: s.taken.map(({ code, term, status }) => ({ code, term, status })),
      custom: s.custom.map(({ code, name, credit, typeByProgram }) => ({ code, name, credit, typeByProgram })),
      excluded: s.excluded,
      maxCreditsPerSemester: s.maxCreditsPerSemester,
      savedAt: new Date().toISOString().slice(0, 10),
    };
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
