// 데이터 스키마 (개발가이드 v2 5장 기준)

export type Campus = 'INTL' | 'SEOUL';
export type ProgramKind = 'MAJOR' | 'MULTI_MAJOR' | 'MICRO_DEGREE' | 'MINOR';
export type Category = '전기' | '전필' | '전선' | string;
export type CourseStatus = 'TAKEN' | 'IN_PROGRESS';

/** courses.json 한 항목. 이수구분은 과목이 아니라 (과정, 과목) 관계에 둔다 */
export interface Course {
  code: string;            // 학수번호 (모든 매칭의 기준 키)
  name: string;
  credit: number;
  typeByProgram: Record<string, Category>; // programId → 이수구분
  source?: 'import' | 'manual';            // 사정표에서 불러옴 / 직접 추가 (새 사정표를 불러오면 'import'는 교체)
}

export interface Requirement {
  category: Category;
  minCredits: number;
}

export interface DiagramNode {
  code: string;
  year: number;      // 권장 학년
  semester: 1 | 2;   // 권장 학기
}

export interface Track {
  name: string;
  courses: string[];
  minCredits: number;
}

export interface Program {
  programId: string;
  campus: Campus;
  college: string;
  department: string;
  kind: ProgramKind;
  admissionYearRange: [number, number];
  requirements: Requirement[];
  totalMin: number;
  courses: string[];
  overlapPolicy?: { withMajor: 'NONE' | 'FULL' | { limit: number } };
  source: { doc: string; year: number; url?: string };
  verified: boolean;  // 원문 대조 검증 여부 (false면 화면에 '검증 중')
  diagram?: {
    nodes: DiagramNode[];
    edges: [string, string][]; // [선수과목, 후수과목]
    tracks: Track[];
  };
}

export interface TakenCourse {
  code: string;
  term: string;            // 예: "2025-1"
  status: CourseStatus;
}

export interface Profile {
  admissionYear: number;   // 학번 전체가 아니라 입학연도만
  campus: Campus;
  department: string;
}
