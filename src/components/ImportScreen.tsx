// 졸업사정표 가져오기: 파일 선택 → 기기 안에서 추출 → 확인·수정 → 적용
// 이수구분은 학교가 사정표에 판정해 둔 값(학사제도 이수구분 코드)을 그대로 쓴다. 학과 교육과정 데이터가 없어도 된다.
import { useEffect, useState } from 'react';
import type { Course, Program, TakenCourse, CourseStatus } from '../lib/types';
import { analyzeReport, SAMPLE_REPORT_LINES, type ParseResult } from '../lib/parseReport';
import { extractPdfText, type TextItem } from '../lib/pdfText';
import { SCHOOL_CATEGORIES, SHORT_NAME, matchWithSchool, type ReportData, type SchoolCategory } from '../lib/reportLayout';
import MatchBadge from './MatchBadge';

interface Props {
  startWithSample?: boolean;
  program: Program;
  courseMap: Map<string, Course>;
  onApply: (taken: TakenCourse[], custom: Course[], report: ReportData) => void;
}

interface EditRow {
  code: string;
  name: string;
  credit: number;
  term: string;
  status: CourseStatus;
  include: boolean;
  category: SchoolCategory | '';
  needsCheck: boolean;
}

/** 학교 이수구분 → 선택한 학과 교육과정의 이수구분 (전기·전필·전선). 교육과정에 없는 구분이면 빈 값 */
export function toProgramCategory(program: Program, cat: SchoolCategory | ''): string {
  if (!cat) return '';
  const short = SHORT_NAME[cat] ?? cat;
  return program.requirements.some((r) => r.category === short) ? short : '';
}

export default function ImportScreen({ startWithSample = false, program, courseMap, onApply }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [source, setSource] = useState<'PDF' | 'SAMPLE'>('PDF');

  // 직전에 불러온 사정표의 과목은 '알려진 과목'으로 취급하지 않는다 (새 파일에 이전 파일 정보가 섞이지 않게)
  const knownCourses = [...courseMap.values()].filter((c) => c.source !== 'import');
  const knownMap = new Map(knownCourses.map((c) => [c.code, c]));
  const creditOf = new Map(knownCourses.map((c) => [c.code, c.credit]));

  const load = (lines: string[], items: TextItem[] | null, src: 'PDF' | 'SAMPLE') => {
    const r = analyzeReport(lines, items, creditOf);
    lines.length = 0; // 추출한 원문은 분석 직후 버린다
    if (items) items.length = 0;
    if (r.rows.length === 0) {
      setError('이 파일에서 과목을 찾지 못했습니다. 학사정보시스템에서 내려받은 졸업사정표 PDF인지 확인해 주세요. 스캔·사진을 PDF로 만든 파일은 아직 읽을 수 없습니다.');
      return;
    }
    setResult(r);
    setSource(src);
    setRows(
      r.rows.map((x) => ({
        code: x.code,
        name: knownMap.get(x.code)?.name ?? x.name,
        credit: x.credit ?? 3,
        term: x.term ?? '',
        status: x.status,
        include: true,
        category: x.category ?? '',
        needsCheck: !x.category || !x.term || (!x.creditRead && !x.known),
      })),
    );
  };

  useEffect(() => {
    if (startWithSample) load([...SAMPLE_REPORT_LINES], null, 'SAMPLE');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용 + 참조 해제
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('지금은 PDF 파일만 읽을 수 있습니다. 사진·스크린샷 인식은 준비 중입니다.');
      return;
    }
    setBusy(true);
    try {
      const { lines, items } = await extractPdfText(file);
      load(lines, items, 'PDF');
    } catch (err) {
      console.error('[사정표 PDF]', err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`PDF를 읽지 못했습니다. 암호가 걸려 있거나 손상된 파일인지 확인해 주세요. (오류: ${detail.slice(0, 120)})`);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const apply = () => {
    if (!result) return;
    const picked = rows.filter((r) => r.include);
    // 교육과정 목록에 없는 과목은 사정표 값(과목명·학점·학교 이수구분)으로 보관한다.
    const custom: Course[] = picked
      .filter((r) => !knownMap.has(r.code))
      .map((r) => {
        const programCat = toProgramCategory(program, r.category);
        return {
          code: r.code,
          name: r.name || '사정표 과목',
          credit: r.credit,
          typeByProgram: programCat ? { [program.programId]: programCat } : {},
          source: 'import' as const,
        };
      });
    const report: ReportData = {
      source,
      importedAt: new Date().toISOString(),
      department: result.departmentHint,
      admissionYear: result.admissionYearHint,
      areas: result.areas,
      categories: Object.fromEntries(picked.filter((r) => r.category).map((r) => [r.code, r.category as SchoolCategory])),
      checks: result.checks,
    };
    onApply(picked.map((r) => ({ code: r.code, term: r.term || '-', status: r.status })), custom, report);
  };

  const uncategorized = rows.filter((r) => r.include && !r.category).length;
  const areaCount = result?.areas.length ?? 0;

  return (
    <section>
      <h2>졸업사정표로 자동 입력</h2>

      {!result && (
        <div className="stack">
          <div className="notice">
            <strong>파일은 이 브라우저 안에서만 읽습니다.</strong>
            <span>서버로 보내지 않습니다. 과목(학수번호·과목명·학점·학기·이수구분)과 영역별 학점만 꺼내고, 이름·학번·연락처·성적은 버립니다.</span>
          </div>
          <label htmlFor="report-file" className="file-drop">
            <strong>{busy ? '읽는 중…' : '졸업사정표 PDF 선택'}</strong>
            <span className="muted">학사정보시스템 → 졸업사정표 → PDF로 저장한 파일 · 모든 학과 가능</span>
            <input id="report-file" type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} />
          </label>
          <p>
            <button type="button" className="link" onClick={() => load([...SAMPLE_REPORT_LINES], null, 'SAMPLE')}>
              가상 사정표로 먼저 체험해 보기
            </button>
          </p>
          {error && <p className="warn" role="alert">{error}</p>}
        </div>
      )}

      {result && (
        <div className="stack">
          <ul className="facts">
            <li>읽은 과목 <strong>{rows.length}</strong>개{source === 'SAMPLE' && ' (가상 사정표)'}</li>
            {result.departmentHint && <li>학과 <strong>{result.departmentHint}</strong></li>}
            {result.admissionYearHint && <li>{result.admissionYearHint}학번</li>}
            <li>영역별 학점 {areaCount}개 영역</li>
            {result.checks.length > 0 && <li>학점 밖 요건 {result.checks.length}개</li>}
            <li>중복 제거 {result.duplicatesRemoved}건</li>
            <li>개인정보 {result.piiLinesRemoved}건 삭제</li>
          </ul>
          {result.areas.length > 0 && (
            <MatchBadge result={matchWithSchool(rows.filter((r) => r.include).map((r) => ({ credit: r.credit, status: r.status, category: r.category })), result.areas)} />
          )}
          <p className="muted">
            이수구분은 학교가 사정표에 표시한 값입니다(학사제도안내의 이수구분 코드 기준). 노란 줄만 확인하고, 빼야 할 과목은 체크를 해제하세요.
          </p>

          <div className="table-wrap">
            <table className="review-table">
              <thead>
                <tr><th>반영</th><th>이수구분</th><th>학수번호</th><th>과목명</th><th>학점</th><th>학기</th><th>상태</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.code}-${r.term}`} className={r.needsCheck ? 'row-check' : undefined}>
                    <td className="c-include"><input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} aria-label={`${r.code} 반영`} /></td>
                    <td className="c-cat">
                      <select value={r.category} aria-label={`${r.code} 이수구분`}
                        onChange={(e) => update(i, { category: e.target.value as SchoolCategory | '' })}>
                        <option value="">확인 필요</option>
                        {SCHOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="code c-code">{r.code}</td>
                    <td className="c-name">{r.name || <span className="muted">—</span>}</td>
                    <td className="c-credit">
                      <input type="number" min={0} max={6} value={r.credit} className="num" aria-label={`${r.code} 학점`}
                        onChange={(e) => update(i, { credit: Number(e.target.value) })} />
                      <span className="unit">학점</span>
                    </td>
                    <td className="c-term">{r.term || <span className="muted">못 읽음</span>}</td>
                    <td className="c-status">
                      <select value={r.status} aria-label={`${r.code} 상태`} onChange={(e) => update(i, { status: e.target.value as CourseStatus })}>
                        <option value="TAKEN">이수</option>
                        <option value="IN_PROGRESS">수강 중</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uncategorized > 0 && (
            <p className="warn">이수구분을 확인하지 못한 과목이 {uncategorized}개 있습니다. 위 표에서 골라 주세요.</p>
          )}
          <div className="actions">
            <button type="button" className="primary" onClick={apply}>이 내용으로 계산하기</button>
            <button type="button" className="link" onClick={() => { setResult(null); setRows([]); }}>다른 파일 선택</button>
          </div>
        </div>
      )}
    </section>
  );
}
