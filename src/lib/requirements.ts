// 학점 밖 졸업요건 (2026 학사제도안내 97쪽 「졸업요건」).
// 사정표 상단 표의 기준/취득 행을 읽어 충족 여부만 판정한다.
// 졸업평점은 성적이므로 값을 보관·표시하지 않고 충족 여부만 남긴다.
import type { TextItem } from './pdfText';

export type CheckStatus = 'met' | 'unmet' | 'exempt' | 'na' | 'unknown';

export interface RequirementCheck {
  key: string;
  name: string;
  status: CheckStatus;
  detail?: string;   // 숫자 진행도 (예: '2/3과목'). 성적은 넣지 않는다
  hint?: string;     // 미충족일 때 할 일
}

interface ColumnSpec {
  key: string;
  name: string;
  header: string;           // 상단 표 머리글
  group?: string;           // 상위 머리글 아래 '판정' 열을 쓸 때
  unit?: string;            // 진행도 단위
  sensitive?: boolean;      // 값 숨김 (성적)
  hint: string;
}

const COLUMNS: ColumnSpec[] = [
  { key: 'gpa', name: '졸업평점 (1.70 이상)', header: '졸업평점', sensitive: true, hint: '전 학년 평점평균 1.70 이상이 필요합니다.' },
  { key: 'english', name: '영어강의', header: '영어강의', unit: '과목', hint: '전공 영어강좌 3과목 이상(편입생 1과목)이 필요합니다.' },
  { key: 'thesis', name: '졸업논문', header: '논문', hint: '학과에 따라 졸업시험으로 대신합니다. 보통 4학년에 학과 일정에 맞춰 진행합니다.' },
  { key: 'topik', name: '한국어능력인증 (TOPIK)', header: 'TOPIK', hint: '외국인 학생은 학과 기준 등급이 필요합니다.' },
  { key: 'exit', name: '졸업능력인증', header: '판정', group: '졸업능력인증', hint: '학과(단과대학)별 인증 기준을 확인하세요.' },
  { key: 'sw', name: 'SW 기초교육', header: '판정', group: 'SW인증', hint: '2018학번 이후 소프트웨어 기초교육 이수요건이 있습니다.' },
];

const MET = /^(충족|통과|합격|이수|인증|완료|취득|Pass|P|Y|O)$/i;
const UNMET = /^(미충족|미통과|불합격|미이수|미인증|미완료|미취득|Fail|F|N|X)$/i;

const num = (s: string | undefined) => {
  const m = s?.match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** 기준·취득 칸 글자로 판정 */
export function judge(required: string | undefined, earned: string | undefined, spec: Pick<ColumnSpec, 'unit' | 'sensitive'>): Pick<RequirementCheck, 'status' | 'detail'> {
  const r = (required ?? '').trim();
  const e = (earned ?? '').trim();
  const words = `${r} ${e}`;
  if (/해당\s*없음|비대상/.test(words)) return { status: 'na' };
  if (/면제/.test(e) || (/면제/.test(r) && !e)) return { status: 'exempt' };
  const eWord = e.replace(/\(.*\)/, '').trim();
  if (UNMET.test(eWord)) return { status: 'unmet' };
  if (MET.test(eWord)) return { status: 'met' };
  const rn = num(r), en = num(e);
  if (rn !== null && en !== null) {
    const status = en >= rn ? 'met' : 'unmet';
    if (spec.sensitive) return { status };
    return { status, detail: `${Math.min(en, 999)}/${rn}${spec.unit ?? ''}` };
  }
  if (rn !== null && !e) return { status: 'unmet', detail: spec.sensitive ? undefined : `0/${rn}${spec.unit ?? ''}` };
  if (!r && !e) return { status: 'unknown' };
  return { status: 'unknown' };
}

/** 사정표 상단 표(좌표)에서 학점 밖 요건을 읽는다 */
export function checksFromItems(items: TextItem[]): RequirementCheck[] {
  const s = (i: TextItem) => i.str.trim();
  const baseRow = items.find((i) => s(i) === '기준' && items.some((h) => s(h) === '취득학점' && h.y > i.y && h.y - i.y < 30));
  if (!baseRow) return [];
  const earnRow = items.find((i) => s(i) === '취득' && i.y < baseRow.y && baseRow.y - i.y < 25 && Math.abs(i.x - baseRow.x) < 20);
  const headerY = items.find((h) => s(h) === '취득학점')!.y;
  const cellAt = (rowY: number | undefined, x: number) => {
    if (rowY === undefined) return undefined;
    const c = items
      .filter((i) => Math.abs(i.y - rowY) <= 2 && Math.abs(i.x - x) <= 28 && i.x > baseRow.x + 20)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    return c ? s(c) : undefined;
  };

  const out: RequirementCheck[] = [];
  for (const spec of COLUMNS) {
    let col: TextItem | undefined;
    if (spec.group) {
      const g = items.find((i) => s(i) === spec.group && i.y > headerY && i.y - headerY < 20);
      if (!g) continue;
      col = items
        .filter((i) => s(i) === spec.header && Math.abs(i.y - headerY) <= 2 && i.x > g.x - 10)
        .sort((a, b) => a.x - b.x)[0];
    } else {
      col = items.find((i) => s(i) === spec.header && Math.abs(i.y - headerY) <= 2);
    }
    if (!col) continue;
    const verdict = judge(cellAt(baseRow.y, col.x), cellAt(earnRow?.y, col.x), spec);
    if (verdict.status === 'na') continue;
    out.push({ key: spec.key, name: spec.name, ...verdict, hint: verdict.status === 'unmet' || verdict.status === 'unknown' ? spec.hint : undefined });
  }
  return out;
}

/** 글자 줄만 있을 때(가상 사정표): '영어강의 1 / 3', 'SW인증 면제' 형식 */
export function checksFromLines(lines: string[]): RequirementCheck[] {
  const out: RequirementCheck[] = [];
  const labels: Record<string, string> = { 졸업평점: 'gpa', 영어강의: 'english', 논문: 'thesis', TOPIK: 'topik', 졸업능력인증: 'exit', SW인증: 'sw' };
  for (const l of lines) {
    const m = l.match(/^(졸업평점|영어강의|논문|TOPIK|졸업능력인증|SW인증)\s+(.+)$/);
    if (!m) continue;
    const spec = COLUMNS.find((c) => c.key === labels[m[1]])!;
    const pair = m[2].match(/^(\S+)\s*\/\s*(\S+)$/);
    const verdict = pair ? judge(pair[2], pair[1], spec) : judge('', m[2], spec);
    if (verdict.status === 'na') continue;
    out.push({ key: spec.key, name: spec.name, ...verdict, hint: verdict.status === 'unmet' || verdict.status === 'unknown' ? spec.hint : undefined });
  }
  return out;
}

/** 사정표로 확인할 수 없어 직접 확인해야 하는 요건 */
export function manualChecks(admissionYear: number | null): { name: string; detail: string }[] {
  const list = [
    { name: '등록 학기 8학기 이상', detail: '건축학과 10학기, 6년제 의약학계열 12학기. 편입생은 인정학기 포함' },
  ];
  if (admissionYear !== null && admissionYear >= 2026) {
    list.push({ name: '다전공·마이크로디그리·부전공 중 1개 이상', detail: '2026학년도 입학생부터 적용 (의학·간호학·약학계열 제외)' });
  }
  list.push({ name: '트랙·공학교육인증 신청자', detail: '신청한 경우 해당 이수요건도 충족해야 합니다' });
  return list;
}
