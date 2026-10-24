// 졸업사정표 가져오기: 파일 선택 → 기기 안에서 추출 → 확인·수정 → 적용
import { useState } from 'react';
import type { Course, Program, TakenCourse, CourseStatus } from '../lib/types';
import { parseReportLines, SAMPLE_REPORT_LINES, type ParseResult } from '../lib/parseReport';
import { extractPdfLines } from '../lib/pdfText';

/** 사정표에서 불러와 만든 과목 표식. 새 사정표를 불러오면 이 표식의 과목은 모두 교체된다. */
export const IMPORTED_NAME = '사정표에서 불러온 과목';

interface Props {
  program: Program;
  courseMap: Map<string, Course>;
  onApply: (taken: TakenCourse[], custom: Course[], info: { count: number; source: 'PDF' | 'SAMPLE' }) => void;
}

interface EditRow {
  code: string;
  credit: number;
  term: string;
  status: CourseStatus;
  include: boolean;
  known: boolean;
  lowConfidence: boolean;
  category: string; // 미등록 과목의 이수구분 (사용자가 지정)
}

export default function ImportScreen({ program, courseMap, onApply }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [source, setSource] = useState<'PDF' | 'SAMPLE' | null>(null);

  // 직전에 불러온 사정표의 과목은 '알려진 과목'으로 취급하지 않는다 (새 파일에 이전 파일 정보가 섞이지 않게)
  const knownCourses = [...courseMap.values()].filter((c) => c.name !== IMPORTED_NAME);
  const knownMap = new Map(knownCourses.map((c) => [c.code, c]));
  const creditOf = new Map(knownCourses.map((c) => [c.code, c.credit]));
  const categories = program.requirements.map((r) => r.category);

  const load = (lines: string[], src: 'PDF' | 'SAMPLE') => {
    const r = parseReportLines(lines, creditOf);
    lines.length = 0; // 추출한 원문은 파싱 직후 버린다
    if (r.rows.length === 0) {
      setError('이 파일에서 과목을 찾지 못했습니다. 학사정보시스템에서 내려받은 졸업사정표 PDF인지 확인해 주세요. 스캔·사진을 PDF로 만든 파일은 아직 읽을 수 없습니다.');
      return;
    }
    setResult(r);
    setSource(src);
    setRows(
      r.rows.map((x) => ({
        code: x.code,
        credit: x.credit ?? 3,
        term: x.term ?? '',
        status: x.status,
        include: true,
        known: x.known,
        lowConfidence: x.lowConfidence,
        category: knownMap.get(x.code)?.typeByProgram[program.programId] ?? '',
      })),
    );
  };

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
      const lines = await extractPdfLines(file);
      load(lines, 'PDF');
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
    const picked = rows.filter((r) => r.include);
    // 목록에 없는 과목은 학점과 함께 모두 보관한다. 이수구분을 안 골랐으면 나중에 '과목 직접 수정'에서 지정할 수 있다.
    const custom: Course[] = picked
      .filter((r) => !r.known)
      .map((r) => ({
        code: r.code,
        name: IMPORTED_NAME,
        credit: r.credit,
        typeByProgram: r.category ? { [program.programId]: r.category } : {},
      }));
    onApply(
      picked.map((r) => ({ code: r.code, term: r.term || '-', status: r.status })),
      custom,
      { count: picked.length, source: source ?? 'PDF' },
    );
  };

  const unknownWithoutCategory = rows.filter((r) => r.include && !r.known && !r.category).length;

  return (
    <section>
      <h2>졸업사정표로 자동 입력</h2>

      {!result && (
        <div className="stack">
          <div className="notice">
            <strong>파일은 이 브라우저 안에서만 읽습니다.</strong>
            <span>서버로 보내거나 저장하지 않으며, 학수번호·학점·학기만 꺼내고 이름·학번·연락처 등 나머지 내용은 바로 버립니다.</span>
          </div>
          <label htmlFor="report-file" className="file-drop">
            <strong>{busy ? '읽는 중…' : '졸업사정표 PDF 선택'}</strong>
            <span className="muted">학사정보시스템 → 졸업사정표 → PDF로 저장한 파일</span>
            <input id="report-file" type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} />
          </label>
          <p>
            <button type="button" className="link" onClick={() => load([...SAMPLE_REPORT_LINES], 'SAMPLE')}>
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
            <li>중복 제거 {result.duplicatesRemoved}건</li>
            <li>개인정보로 보이는 항목 {result.piiLinesRemoved}건 삭제</li>
            {result.admissionYearHint && <li>입학연도 {result.admissionYearHint}년으로 확인됨</li>}
          </ul>
          <p className="muted">노란 줄은 확인이 필요한 과목입니다. 틀린 값은 고치고, 빼야 할 과목은 체크를 해제하세요.</p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>반영</th><th>학수번호</th><th>과목명</th><th>학점</th><th>학기</th><th>상태</th><th>이수구분</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.code}-${r.term}`} className={r.lowConfidence ? 'row-check' : undefined}>
                    <td><input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} aria-label={`${r.code} 반영`} /></td>
                    <td className="code">{r.code}</td>
                    <td>{knownMap.get(r.code)?.name ?? <span className="muted">목록에 없음</span>}</td>
                    <td>
                      {r.known ? r.credit : (
                        <input type="number" min={0} max={6} value={r.credit} className="num" aria-label="학점"
                          onChange={(e) => update(i, { credit: Number(e.target.value) })} />
                      )}
                    </td>
                    <td>{r.term || <span className="muted">못 읽음</span>}</td>
                    <td>
                      <select value={r.status} aria-label="상태" onChange={(e) => update(i, { status: e.target.value as CourseStatus })}>
                        <option value="TAKEN">이수</option>
                        <option value="IN_PROGRESS">수강 중</option>
                      </select>
                    </td>
                    <td>
                      {r.known ? (r.category || <span className="muted">과정 외</span>) : (
                        <select value={r.category} aria-label="이수구분" onChange={(e) => update(i, { category: e.target.value })}>
                          <option value="">선택</option>
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unknownWithoutCategory > 0 && (
            <p className="warn">목록에 없는 과목 {unknownWithoutCategory}개는 이수구분을 고르지 않으면 학점 계산에서 빠집니다.</p>
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
