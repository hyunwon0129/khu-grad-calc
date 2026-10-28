// 졸업사정표 파서 (개발가이드 8.3, 9.3 기준)
// 원칙: 필요한 필드(학수번호·학점·학기)만 꺼내고 나머지 텍스트는 결과에 담지 않는다.
// 한글이 추출되지 않아도 동작하도록 학수번호·숫자 패턴만 사용한다.
import type { CourseStatus } from './types';
import type { TextItem } from './pdfText';
import {
  categorizeItems, categorizeLines, graduationFromItems, reconcile, summarizeLines,
  type ReportArea, type SchoolCategory,
} from './reportLayout';
import { checksFromItems, checksFromLines, type RequirementCheck } from './requirements';

export interface ParsedRow {
  code: string;
  credit: number | null;
  term: string | null;     // "2025-1"
  status: CourseStatus;
  known: boolean;          // courses.json에 있는 학수번호인가
  lowConfidence: boolean;  // 학점·학기를 못 읽었거나 미등록 → 확인 필요
  category?: SchoolCategory; // 학교가 판정한 이수구분 (사정표의 이수구분 코드·묶음 기준)
  name: string;             // 과목명 (학수번호와 학점 사이 글자)
  creditRead: boolean;      // 학점을 사정표에서 직접 읽었는가
}

export interface ParseResult {
  rows: ParsedRow[];
  admissionYearHint: number | null; // 학번 앞 4자리. 학번 자체는 보관하지 않음
  piiLinesRemoved: number;          // 개인정보로 보여 지운 항목 수
  duplicatesRemoved: number;
  subtotalCount: number;            // 취득 / 기준 형태로 읽힌 소계 줄 수
  departmentHint: string | null;    // 사정표 머리 부분의 학과명 (…학과/학부/전공 단어만)
  areas: ReportArea[];              // 사정표 기준 영역별 취득/기준 (영역 취득에는 이번 학기 수강분 포함)
  checks: RequirementCheck[];       // 학점 밖 졸업요건
}

// 학과명: 과목 목록이 시작되기 전(학생 정보 영역)에서 '…학과/…학부/…전공'으로 끝나는 단어만 꺼낸다.
// 이름 등 다른 단어는 이 형태가 아니므로 꺼내지지 않는다.
// 학과명 안의 가운뎃점·&(회계･세무학과, 조리&푸드디자인학과)와 '(야간)'까지 포함
const DEPT = /[가-힣A-Za-z](?:[가-힣A-Za-z·･ㆍ‧&]){1,24}(?:학과|학부|전공)(?:\(야간\))?(?![가-힣])/g;
const DEPT_LABELS = new Set(['주전공', '다전공', '부전공', '복수전공', '연계전공', '융합전공', '소속학과', '학과', '학부', '전공', '제1전공', '제2전공']);

export function findDepartment(headerLines: string[]): string | null {
  // '학과 작곡과'처럼 '학과' 칸 바로 뒤의 값을 먼저 본다 (작곡과·성악과·기악과는 '…학과'로 끝나지 않음)
  for (const l of headerLines) {
    const m = l.match(/(?:학과|소속|학부\(과\))\s*[:：]?\s+([가-힣A-Za-z][가-힣A-Za-z·･ㆍ‧&]{0,24}(?:과|학부|전공)(?:\(야간\))?)(?![가-힣])/);
    if (m && !DEPT_LABELS.has(m[1])) return m[1];
  }
  const found = headerLines.flatMap((l) => [...l.matchAll(DEPT)].map((m) => m[0])).filter((w) => !DEPT_LABELS.has(w));
  return found.find((w) => w.endsWith('학과')) ?? found.find((w) => w.endsWith('학부')) ?? found[0] ?? null;
}

// 부록 A 마스킹 정규식 (보조 안전장치)
const STUDENT_ID = /\b((?:19|20)\d{2})\d{6}\b/g;
const PHONE = /\b0\d{1,2}[- .]?\d{3,4}[- .]?\d{4}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const RRN = /\b\d{6}[- ]?[1-4]\d{6}\b/g;
const PRINTED_AT = /\b20\d{2}[/.-]\d{1,2}[/.-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\b/g;

// 허용 필드 패턴
const COURSE_CODE = /\b[A-Z]{2,6}\d{3,6}\b/g;
const TERM = /(20\d{2})\s*[-/.]?\s*([12])(?!\d)/;
const CREDIT = /(?<![\d.])([0-6])(?:\.0)?(?![\d.])/;
const SUBTOTAL = /(?<!\d)(\d{1,3})\s*\/\s*(\d{1,3})(?!\d)/;

/** 오늘 날짜 기준 현재 학기. 8월 이후 2학기, 2~7월 1학기, 1월은 전년도 2학기 */
export function currentTerm(today = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (m >= 8) return `${y}-2`;
  if (m >= 2) return `${y}-1`;
  return `${y - 1}-2`;
}

export function parseReportLines(
  lines: string[],
  creditOf: Map<string, number>,
  nowTerm = currentTerm(),
): ParseResult {
  let admissionYearHint: number | null = null;
  let piiLinesRemoved = 0;
  let subtotalCount = 0;
  const raw: ParsedRow[] = [];
  const headerLines: string[] = [];
  let seenCourse = false;

  for (const original of lines) {
    // 1) 개인정보 패턴을 먼저 지운다. 학번은 앞 4자리만 힌트로 남긴다.
    let line = original;
    const before = line;
    line = line.replace(STUDENT_ID, (_m, year: string) => {
      admissionYearHint ??= Number(year);
      return ' ';
    });
    line = line.replace(PRINTED_AT, ' ').replace(PHONE, ' ').replace(EMAIL, ' ').replace(RRN, ' ');
    if (line !== before) piiLinesRemoved++;

    // 2) 학수번호가 있는 줄만 과목 행으로 본다.
    const codes = [...line.matchAll(COURSE_CODE)];
    if (codes.length > 0) seenCourse = true;
    else if (!seenCourse) headerLines.push(line);
    if (codes.length === 0) {
      const sub = line.match(SUBTOTAL);
      if (sub && !/^(19|20)\d{2}$/.test(sub[1])) subtotalCount++;
      continue;
    }

    codes.forEach((m, i) => {
      const code = m[0];
      const start = m.index! + code.length;
      const end = i + 1 < codes.length ? codes[i + 1].index! : line.length;
      let segment = line.slice(start, end);

      const termMatch = segment.match(TERM);
      const term = termMatch ? `${termMatch[1]}-${termMatch[2]}` : null;
      // 학점은 학기 바로 앞의 마지막 숫자. 과목명이 숫자로 끝나는 경우(예: "설계1")를 피한다.
      if (termMatch) segment = segment.slice(0, termMatch.index);

      const creditCandidates = [...segment.matchAll(new RegExp(CREDIT.source, 'g'))];
      const creditMatch = creditCandidates[creditCandidates.length - 1];
      const known = creditOf.has(code);
      const credit = creditMatch ? Number(creditMatch[1]) : (creditOf.get(code) ?? null);

      const name = segment
        .slice(0, creditMatch ? creditMatch.index : undefined)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
      raw.push({
        code,
        name,
        creditRead: !!creditMatch,
        credit,
        term,
        status: term === nowTerm ? 'IN_PROGRESS' : 'TAKEN',
        known,
        lowConfidence: !known || !term || !creditMatch,
      });
    });
  }

  // 3) (학수번호, 학기) 기준 중복 제거. 학기를 못 읽은 행은 같은 코드의 다른 행이 있으면 버린다.
  const seen = new Set<string>();
  const codesWithTerm = new Set(raw.filter((r) => r.term).map((r) => r.code));
  const rows = raw.filter((r) => {
    if (!r.term && codesWithTerm.has(r.code)) return false;
    const key = `${r.code}|${r.term ?? '?'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    rows,
    admissionYearHint,
    piiLinesRemoved,
    duplicatesRemoved: raw.length - rows.length,
    subtotalCount,
    departmentHint: findDepartment(headerLines),
    areas: summarizeLines(lines),
    checks: [],
  };
}

/**
 * 사정표 전체 분석: 과목 행 + 학교 이수구분 + 영역별 취득/기준.
 * items(좌표)가 있으면 표 배치로 분류하고, 없으면 줄 앞 코드로만 분류한다.
 */
export function analyzeReport(
  lines: string[],
  items: TextItem[] | null,
  creditOf: Map<string, number>,
  nowTerm = currentTerm(),
): ParseResult {
  const base = parseReportLines(lines, creditOf, nowTerm);
  const cats = items ? categorizeItems(items) : categorizeLines(lines);
  const grad = items ? graduationFromItems(items) : null;
  const areas = grad ? [grad, ...base.areas.filter((a) => a.group !== '졸업')] : base.areas;
  const rows = reconcile(base.rows.map((r) => ({ ...r, category: cats.get(r.code) })), areas);
  const checks = items ? checksFromItems(items) : checksFromLines(lines);
  return { ...base, rows, areas, checks };
}

/** 데모용 가상 사정표 텍스트. 실제 학생 정보가 아니며, 개인정보 제거 과정을 보여주려고 가짜 학번·전화번호를 넣었다. */
export const SAMPLE_REPORT_LINES = [
  '출력일시 2026-10-25 01:30:00',
  '학번 2025123456 성명 홍길동 학과 [샘플] 가상학과',
  '졸업학점 55 / 130',
  '필수교과 6 / 6 17 / 17',
  '배분이수교과 3 / 3 9 / 9',
  '자유이수 2 / 1 2 / 3',
  '16 GEC1001 성찰과표현 3 2025 / 1',
  '16 GEC1002 대학영어 2 2025 / 1',
  '16 GEC1003 인간의가치탐색 3 2025 / 1',
  '16 GEC1004 세계와시민 3 2025 / 2',
  '16 GEC1005 빅뱅에서문명까지 3 2025 / 2',
  '16 GEC1006 주제연구 3 2026 / 1',
  '15 GED1001 생명과우주 3 2025 / 2',
  '15 GED1002 사회와공동체 3 2026 / 1',
  '15 GED1003 지능과정보 3 2026 / 1',
  '17 GEE1001 전공탐색세미나 1 2025 / 1',
  '17 GEE1002 진로설계 1 2025 / 2',
  '11 SAMP1001 [샘플] 공학수학 3 2025 / 1',
  '11 SAMP1002 [샘플] 확률통계 3 2025 / 2',
  '04 SAMP2001 [샘플] 경영과학 3 2026 / 1',
  '04 SAMP2002 [샘플] 생산관리 3 2026 / 2',
  '05 SAMP3002 [샘플] 데이터마이닝 3 2026 / 1',
  '08 KHCU1001 온라인교양1 3 2025 / 1',
  '08 KHCU1002 온라인교양2 3 2025 / 2',
  '08 KHCU1003 온라인교양3 3 2025 / 2',
  '08 KHCU1004 온라인교양4 3 2026 / 1',
  '08 KHCU1005 온라인교양5 3 2026 / 1',
  '전공계: 15 ( 전필: 6/9 전선: 3/9 전기: 6/6 )',
  '졸업평점 충족',
  '영어강의 1 / 3',
  '논문 0 / 1',
  '졸업능력인증 면제',
  'SW인증 6 / 6',
  'SAMP1001 SAMP1002 SAMP2001',
  '문의 031-000-0000 sample@example.com',
];
