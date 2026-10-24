// 졸업사정표 파서 (개발가이드 8.3, 9.3 기준)
// 원칙: 필요한 필드(학수번호·학점·학기)만 꺼내고 나머지 텍스트는 결과에 담지 않는다.
// 한글이 추출되지 않아도 동작하도록 학수번호·숫자 패턴만 사용한다.
import type { CourseStatus } from './types';

export interface ParsedRow {
  code: string;
  credit: number | null;
  term: string | null;     // "2025-1"
  status: CourseStatus;
  known: boolean;          // courses.json에 있는 학수번호인가
  lowConfidence: boolean;  // 학점·학기를 못 읽었거나 미등록 → 확인 필요
}

export interface ParseResult {
  rows: ParsedRow[];
  admissionYearHint: number | null; // 학번 앞 4자리. 학번 자체는 보관하지 않음
  piiLinesRemoved: number;          // 개인정보로 보여 지운 항목 수
  duplicatesRemoved: number;
  subtotalCount: number;            // 취득 / 기준 형태로 읽힌 소계 줄 수
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
      if (termMatch) segment = segment.replace(termMatch[0], ' ');

      const creditMatch = segment.match(CREDIT);
      const known = creditOf.has(code);
      const credit = creditMatch ? Number(creditMatch[1]) : (creditOf.get(code) ?? null);

      raw.push({
        code,
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
  };
}

/** 데모용 가상 사정표 텍스트. 실제 학생 정보가 아니며, 개인정보 제거 과정을 보여주려고 가짜 학번·전화번호를 넣었다. */
export const SAMPLE_REPORT_LINES = [
  '출력일시 2026-10-25 01:30:00',
  '학번 2025123456 성명 홍길동 학과 [샘플] 가상학과',
  '01 SAMP1001 3 2025 / 1',
  '01 SAMP1002 3 2025 / 2',
  '02 SAMP2001 3 2026 / 1',
  '02 SAMP2002 3 2026 / 2',
  '03 SAMP3002 3 2026 / 1',
  '04 ZZZ1234 2 2025 / 2',
  '전기 6 / 6   전필 6 / 9   전선 3 / 9',
  'SAMP1001 SAMP1002 SAMP2001',
  '문의 031-000-0000 sample@example.com',
];
