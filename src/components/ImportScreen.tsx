// 졸업사정표 가져오기: 파일 선택 → 기기 안에서 추출 → 확인·수정 → 적용
// 이수구분은 학교가 사정표에 판정해 둔 값(학사제도 이수구분 코드)을 그대로 쓴다. 학과 교육과정 데이터가 없어도 된다.
import { useEffect, useState } from 'react';
import type { Course, Program, TakenCourse, CourseStatus } from '../lib/types';
import { analyzeReport, SAMPLE_REPORT_LINES, type ParseResult } from '../lib/parseReport';
import { extractPdfText, type TextItem } from '../lib/pdfText';
import { SCHOOL_CATEGORIES, SHORT_NAME, matchWithSchool, type ReportData, type SchoolCategory } from '../lib/reportLayout';
import MatchBadge from './MatchBadge';
import { matchProgram } from '../lib/dept';
import { buildDiagnosis, type Diagnosis } from '../lib/diagnose';
import { APP_VERSION } from './AboutScreen';
import { FEEDBACK_URL } from './FeedbackLink';

interface Props {
  startWithSample?: boolean;
  noSave?: boolean;
  onNoSave?: (v: boolean) => void;
  program: Program;
  majors?: Program[];
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

export default function ImportScreen({ startWithSample = false, noSave = false, onNoSave, program: current, majors = [], courseMap, onApply }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [source, setSource] = useState<'PDF' | 'SAMPLE'>('PDF');
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [diagCopied, setDiagCopied] = useState<'idle' | 'ok' | 'manual'>('idle');

  // 직전에 불러온 사정표의 과목은 '알려진 과목'으로 취급하지 않는다 (새 파일에 이전 파일 정보가 섞이지 않게)
  const knownCourses = [...courseMap.values()].filter((c) => c.source !== 'import');
  const knownMap = new Map(knownCourses.map((c) => [c.code, c]));
  const creditOf = new Map(knownCourses.map((c) => [c.code, c.credit]));

  const load = (lines: string[], items: TextItem[] | null, src: 'PDF' | 'SAMPLE') => {
    const r = analyzeReport(lines, items, creditOf);
    // 제보용으로 내용을 가린 '모양'만 남긴다 (원문은 아래에서 바로 버림)
    setDiag(src === 'PDF' ? buildDiagnosis(lines, { items: items?.length ?? 0, courses: r.rows.length, areas: r.areas.length, version: APP_VERSION }) : null);
    setDiagCopied('idle');
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
      setDiag(buildDiagnosis([], { items: 0, courses: 0, areas: 0, error: detail, version: APP_VERSION }));
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const apply = () => {
    if (!result) return;
    // 사정표 학과에 맞는 교육과정이 있으면 그 기준으로 이수구분을 붙인다
    const program = (result.departmentHint && matchProgram(majors, result.departmentHint, result.admissionYearHint)) || current;
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

  const copyDiag = async () => {
    if (!diag) return;
    try { await navigator.clipboard.writeText(diag.text); setDiagCopied('ok'); } catch { setDiagCopied('manual'); }
  };
  const diagBox = diag && (
    <details className="diag">
      <summary>{error ? '읽기 문제 제보하기' : '읽은 결과가 이상한가요? 제보하기'}</summary>
      <p className="muted small">
        사정표의 글자를 모두 가린 <strong>표 모양</strong>만 복사합니다(한글→가, 영문→A, 숫자→0). 이름·학번·과목·성적은 들어가지 않습니다.
        복사한 내용을 {FEEDBACK_URL ? '의견 보내기 창' : '개발자에게 보내는 메시지'}에 붙여 넣어 주세요.
      </p>
      <textarea readOnly className="summary" rows={6} value={diag.text} onFocus={(e) => e.currentTarget.select()} aria-label="제보 내용 미리보기" />
      <div className="actions">
        <button type="button" onClick={copyDiag}>가린 내용 복사</button>
        {FEEDBACK_URL && <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">의견 보내기 열기</a>}
        {diagCopied === 'ok' && <span className="ok" role="status">복사했습니다</span>}
        {diagCopied === 'manual' && <span className="muted" role="status">자동 복사가 막혀 있습니다. 위 칸을 눌러 선택한 뒤 복사하세요.</span>}
      </div>
    </details>
  );

  const uncategorized = rows.filter((r) => r.include && !r.category).length;
  const areaCount = result?.areas.length ?? 0;

  return (
    <section>
      <h2>졸업사정표로 자동 입력</h2>
      <ol className="stepper" aria-label="진행 단계">
        {['파일 선택', '내용 확인', '결과 보기'].map((label, i) => {
          const cur = result ? 1 : 0;
          return (
            <li key={label} className={i < cur ? 'done' : i === cur ? 'current' : ''} aria-current={i === cur ? 'step' : undefined}>
              <span className="stepper-num">{i < cur ? '✓' : i + 1}</span><span>{label}</span>
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="stack">
          <div className="notice">
            <strong>파일은 내 브라우저 안에서만 읽어요.</strong>
            <span>과목과 영역별 학점만 꺼내고, 이름·학번·연락처·성적은 버려요.</span>
          </div>
          {onNoSave && (
            <label className="consent" htmlFor="no-save">
              <input id="no-save" type="checkbox" checked={noSave} onChange={(e) => onNoSave(e.target.checked)} />
              <span><strong>공용 PC예요</strong> · 저장하지 않고, 창을 닫으면 지워져요</span>
            </label>
          )}
          {busy ? (
            <div className="reading" role="status" aria-live="polite" aria-busy="true">
              <strong>이 기기 안에서 사정표를 읽고 있어요</strong>
              <span className="muted">보통 2~3초 걸려요</span>
              <div className="skeleton" aria-hidden="true">
                {[90, 70, 82, 60, 76].map((w, i) => <span key={i} style={{ width: `${w}%` }} />)}
              </div>
            </div>
          ) : (
            <label htmlFor="report-file" className="file-drop">
              <strong>졸업사정표 PDF 선택</strong>
              <span className="muted">인포21에서 저장한 졸업사정표 PDF</span>
              <input id="report-file" type="file" accept="application/pdf,.pdf" onChange={onFile} />
            </label>
          )}
          <p>
            <button type="button" className="link" onClick={() => load([...SAMPLE_REPORT_LINES], null, 'SAMPLE')}>
              예시 사정표로 체험하기
            </button>
          </p>
          {error && <p className="warn" role="alert">{error}</p>}
          {error && diagBox}
        </div>
      )}

      {result && (
        <div className="stack">
          <ul className="facts facts-grid">
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
            이수구분은 사정표에 적힌 값이에요. 노란 줄만 확인하고, 뺄 과목은 체크를 풀어 주세요.
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

          {diagBox}
          {uncategorized > 0 && (
            <p className="warn">이수구분 미지정 {uncategorized}개 · 표에서 골라야 학점에 반영돼요</p>
          )}
          <div className="sticky-actions">
            <span className="sticky-count"><strong>{rows.filter((r) => r.include).length}</strong>과목 반영{uncategorized > 0 && <span className="warn"> · 확인 필요 {uncategorized}</span>}</span>
            <button type="button" className="link" onClick={() => { setResult(null); setRows([]); setDiag(null); }}>다른 파일</button>
            <button type="button" className="primary" onClick={apply}>계산하기</button>
          </div>
        </div>
      )}
    </section>
  );
}
