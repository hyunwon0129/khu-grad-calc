// 화면 흐름: 시작(교육과정·입력 방식 선택) → 사정표 가져오기 | 직접 입력 → 결과
import { useEffect, useMemo, useState } from 'react';
import coursesData from './data/courses.json';
import programsData from './data/programs.json';
import type { Course, Program, TakenCourse } from './lib/types';
import { clearState, loadState, saveState } from './lib/storage';
import StartScreen from './components/StartScreen';
import ImportScreen from './components/ImportScreen';
import ManualScreen from './components/ManualScreen';
import ResultScreen from './components/ResultScreen';
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

  useEffect(() => {
    if (taken.length === 0 && custom.length === 0 && excluded.length === 0) { clearState(); return; }
    saveState({ programId, taken, custom, excluded, maxCreditsPerSemester: maxCredits });
    setSavedAt(new Date().toISOString().slice(0, 10));
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
    setTaken([]); setCustom([]); setExcluded([]); setMaxCredits(DEFAULT_MAX_CREDITS); setSavedAt(null);
    setStep('start');
  };

  return (
    <main>
      <header>
        <h1>졸업요건 계산기</h1>
        <p className="muted">비공식 서비스 · 입력한 정보와 파일은 이 브라우저 밖으로 전송되지 않습니다</p>
      </header>

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
          onProgram={(id) => { setProgramId(id); setTaken([]); setCustom([]); setExcluded([]); }}
          onChoose={setStep}
          onClear={resetAll}
        />
      )}
      {step === 'import' && (
        <ImportScreen
          program={program}
          courseMap={courseMap}
          onApply={(rows, newCustom) => {
            newCustom.forEach(addCustom);
            setTaken(rows);
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
