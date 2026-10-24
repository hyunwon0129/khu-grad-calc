// 화면 흐름: 시작(교육과정·입력 방식 선택) → 사정표 가져오기 | 직접 입력 → 결과
// 로그인(선택): 서버가 설정돼 있으면 학수번호·학기·설정을 계정에 동기화
import { useCallback, useEffect, useMemo, useState } from 'react';
import coursesData from './data/courses.json';
import programsData from './data/programs.json';
import type { Course, Program, TakenCourse } from './lib/types';
import { clearState, isEmpty, loadState, saveState, type UserData } from './lib/storage';
import { cloudEnabled } from './lib/cloud';
import { useCloudSync } from './lib/useCloudSync';
import StartScreen from './components/StartScreen';
import ImportScreen, { IMPORTED_NAME } from './components/ImportScreen';
import ManualScreen from './components/ManualScreen';
import ResultScreen from './components/ResultScreen';
import AccountPanel from './components/AccountPanel';
import './App.css';

const baseCourses = coursesData as Course[];
const programs = programsData as Program[];
const majors = programs.filter((p) => p.kind === 'MAJOR');
const DEFAULT_MAX_CREDITS = 9;

export type Step = 'start' | 'import' | 'manual' | 'result';

export default function App() {
  const saved = useMemo(() => loadState(), []);
  const validSaved = saved && majors.some((p) => p.programId === saved.programId) ? saved : null;

  const [step, setStep] = useState<Step>('start');
  const [programId, setProgramId] = useState(validSaved?.programId ?? majors[0]?.programId ?? '');
  const [taken, setTaken] = useState<TakenCourse[]>(validSaved?.taken ?? []);
  const [custom, setCustom] = useState<Course[]>(validSaved?.custom ?? []); // 목록에 없어 사용자가 지정한 과목
  const [excluded, setExcluded] = useState<string[]>(validSaved?.excluded ?? []);
  const [maxCredits, setMaxCredits] = useState(validSaved?.maxCreditsPerSemester ?? DEFAULT_MAX_CREDITS);
  const [savedAt, setSavedAt] = useState(validSaved?.savedAt ?? null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [importInfo, setImportInfo] = useState<{ count: number; source: 'PDF' | 'SAMPLE'; at: Date } | null>(null);

  const data: UserData = { programId, taken, custom, excluded, maxCreditsPerSemester: maxCredits };

  const apply = useCallback((d: UserData) => {
    if (majors.some((p) => p.programId === d.programId)) setProgramId(d.programId);
    setTaken(d.taken); setCustom(d.custom); setExcluded(d.excluded); setMaxCredits(d.maxCreditsPerSemester);
  }, []);
  const sync = useCloudSync(data, apply);

  useEffect(() => {
    if (isEmpty(data)) { clearState(); return; }
    saveState(data);
    setSavedAt(new Date().toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, taken, custom, excluded, maxCredits]);

  const program = majors.find((p) => p.programId === programId);
  const courseMap = useMemo(
    () => new Map([...baseCourses, ...custom].map((c) => [c.code, c])),
    [custom],
  );

  if (!program) return <main><p>교육과정 데이터가 없습니다.</p></main>;

  const addCustom = (c: Course) =>
    setCustom((prev) => [...prev.filter((x) => x.code !== c.code), c]);

  const resetAll = () => {
    clearState();
    setTaken([]); setCustom([]); setExcluded([]); setMaxCredits(DEFAULT_MAX_CREDITS); setSavedAt(null); setImportInfo(null);
    setStep('start');
  };

  const loggedIn = !!sync.session;

  return (
    <main>
      <header>
        <div className="header-row">
          <h1>졸업요건 계산기</h1>
          {cloudEnabled && (
            <button type="button" className="account-btn" onClick={() => setAccountOpen((v) => !v)} aria-expanded={accountOpen}>
              {loggedIn ? (sync.session?.user.email?.split('@')[0] ?? '내 계정') : '로그인'}
            </button>
          )}
        </div>
        <p className="muted">
          비공식 서비스 · 사정표 파일은 이 브라우저 안에서만 읽습니다
          {loggedIn ? ' · 학수번호·학기만 계정에 동기화됩니다' : ''}
        </p>
      </header>

      {cloudEnabled && accountOpen && (
        <AccountPanel session={sync.session} status={sync.status} lastSynced={sync.lastSynced} onClose={() => setAccountOpen(false)} />
      )}

      {sync.conflict && (
        <section className="resume" role="alertdialog" aria-label="동기화 선택">
          <strong>계정에 저장된 기록과 이 기기의 기록이 다릅니다</strong>
          <span className="muted">
            계정: 과목 {sync.conflict.taken.length}개 · 이 기기: 과목 {taken.length}개
          </span>
          <div className="actions">
            <button type="button" className="primary" onClick={() => sync.resolveConflict('cloud')}>계정 기록 불러오기</button>
            <button type="button" onClick={() => sync.resolveConflict('local')}>이 기기 기록으로 계정 덮어쓰기</button>
          </div>
        </section>
      )}

      {step !== 'start' && (
        <nav className="steps" aria-label="단계">
          <button type="button" className="link" onClick={() => setStep('start')}>← 처음으로</button>
          <span className="muted">{program.department} · {program.admissionYearRange[0]}학번 교육과정</span>
        </nav>
      )}

      {step === 'start' && (
        <StartScreen
          majors={majors}
          programId={programId}
          savedCount={taken.length}
          savedAt={savedAt}
          synced={loggedIn}
          onProgram={(id) => { setProgramId(id); setTaken([]); setCustom([]); setExcluded([]); }}
          onChoose={setStep}
          onClear={resetAll}
        />
      )}
      {step === 'import' && (
        <ImportScreen
          program={program}
          courseMap={courseMap}
          onApply={(rows, newCustom, info) => {
            // 이전 사정표에서 만든 과목은 버리고 이번 파일 것으로 교체 (직접 추가한 과목은 유지)
            setCustom((prev) => [
              ...prev.filter((c) => c.name !== IMPORTED_NAME && !newCustom.some((n) => n.code === c.code)),
              ...newCustom,
            ]);
            setTaken(rows);
            setImportInfo({ ...info, at: new Date() });
            setExcluded([]);
            setStep('result');
          }}
        />
      )}
      {step === 'manual' && (
        <ManualScreen
          program={program}
          courseMap={courseMap}
          taken={taken}
          onChange={setTaken}
          onAddCustom={addCustom}
          onDone={() => setStep('result')}
        />
      )}
      {step === 'result' && (
        <ResultScreen
          program={program}
          programs={programs}
          courseMap={courseMap}
          taken={taken}
          importInfo={importInfo}
          excluded={excluded}
          maxCredits={maxCredits}
          onExcluded={setExcluded}
          onMaxCredits={setMaxCredits}
          onEdit={() => setStep('manual')}
          onReimport={() => setStep('import')}
        />
      )}

      <footer className="muted">참고용이며 최종 졸업 여부는 학교 학사 시스템 기준입니다.</footer>
    </main>
  );
}
