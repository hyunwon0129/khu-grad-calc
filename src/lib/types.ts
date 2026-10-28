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
  both?: boolean;    // 1·2학기 모두 개설
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
  note?: string;      // 화면에 보여 줄 데이터 안내 (기준 연도 차이 등)
  choiceGroups?: string[][]; // 택1 과목 묶음 (하나만 들으면 됨)
  diagram?: {
    nodes: DiagramNode[];
    edges: [string, string][]; // [선수과목, 후수과목]. 선수과목 'A|B'는 둘 중 하나
    tracks: Track[];
  };
  anyCampus?: boolean;      // 두 캠퍼스 학생 모두 신청 가능한 과정(마이크로디그리)
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

/** 2026 학사제도안내 전공별 교육과정 기본구조 한 줄 */
export interface CreditBlock { 기초: number; 필수: number; 선택: number; 계: number }
export interface DepartmentInfo {
  campus: Campus;
  college: string;
  name: string;
  grad: number | null;
  single: CreditBlock | null;
  multi: CreditBlock | null;
  minor: CreditBlock | null;
  otherMulti?: number;
  multiBannedFor?: Campus[];
  unreadable?: boolean;
  mergedBasic?: boolean; // 다전공 기준이 '전공기초+전공필수 합산'으로 정해진 학과 (전기 과목도 필수 학점으로 셈)
}
