// 읽기 실패 제보용: 사정표 내용을 모두 가리고 '모양'만 남긴다.
// 한글 → 가, 영문 → A, 숫자 → 0 으로 바꾸고, 표 머리말에 쓰이는 일반 단어만 그대로 둔다.
// 이름·학번·과목명·성적은 남지 않는다. 제보는 사용자가 직접 복사해서 보낼 때만 나간다.

const KEEP = new Set([
  '학번', '성명', '학과', '전공', '교양', '졸업', '학점', '취득', '기준', '이수구분', '구분', '학기', '년도',
  '전공기초', '전공필수', '전공선택', '배분이수', '자유이수', '일반선택', '교직', '금학기', '기타', '계', '합계',
  '판정', '영어강의', '논문', '졸업논문', '평점', '졸업평점', '필수', '선택', '기초', '이수', '미이수', '충족', '합격',
  '주전공', '다전공', '부전공', '전공계', '교양계', '졸업학점', '과목명', '교과목명', '학수번호',
]);

export function maskToken(tok: string): string {
  if (KEEP.has(tok)) return tok;
  return tok.replace(/[가-힣]/g, '가').replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '0');
}

export function maskLine(line: string): string {
  return line.split(/(\s+)/).map((t) => (/^\s+$/.test(t) ? ' ' : maskToken(t))).join('').trim();
}

export interface Diagnosis {
  text: string;      // 복사할 내용
  lineCount: number;
}

export function buildDiagnosis(lines: string[], info: { items: number; courses: number; areas: number; error?: string; version?: string }): Diagnosis {
  const masked = lines.slice(0, 150).map(maskLine).filter(Boolean);
  const head = [
    '[졸업요건 계산기 읽기 문제 제보]',
    `앱 버전 ${info.version ?? '-'}`,
    `줄 ${lines.length} · 글자 조각 ${info.items} · 찾은 과목 ${info.courses} · 영역 ${info.areas}`,
    ...(info.error ? [`오류: ${info.error.slice(0, 120)}`] : []),
    '아래는 내용을 가린 표 모양입니다 (한글=가, 영문=A, 숫자=0).',
    '---',
  ];
  return { text: [...head, ...masked].join('\n'), lineCount: lines.length };
}
