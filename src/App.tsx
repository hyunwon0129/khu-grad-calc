// 화면 흐름: 시작(교육과정·입력 방식 선택) → 사정표 가져오기 | 직접 입력 → 결과
import { useMemo, useState } from 'react';
import coursesData from './data/courses.json';
import programsData from './data/programs.json';
import type { Course, Program, TakenCourse } from './lib/types';
import StartScreen from './components/StartScreen';
import ImportScreen from './components/ImportScreen';
import ManualScreen from './components/ManualScreen';
import ResultScreen from './components/ResultScreen';
import './App.css';

const baseCourses = coursesData as Course[];
const programs = programsData as Program[];

export type Step = 'start' | 'import' | 'manual' | 'result';

export default function App() {
  const majors = programs.filter((p) => p.kind === 'MAJOR');
  const [step, setStep] = useState<Step>('start');
  const [programId, setProgramId] = useState(majors[0]?.programId ?? '');
  const [taken, setTaken] = useState<TakenCourse[]>([]);
  const [custom, setCustom] = useState<Course[]>([]); // 목록에 없어 사용자가 직접 지정한 과목

  const program = majors.find((p) => p.programId === programId);
  const courseMap = useMemo(
    () => new Map([...baseCourses, ...custom].map((c) => [c.code, c])),
    [custom],
  );

  if (!program) return <main><p>교육과정 데이터가 없습니다.</p></main>;

  const addCustom = (c: Course) =>
    setCustom((prev) => [...prev.filter((x) => x.code !== c.code), c]);

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
          hasData={taken.length > 0}
          onProgram={(id) => { setProgramId(id); setTaken([]); setCustom([]); }}
          onChoose={setStep}
        />
      )}
      {step === 'import' && (
        <ImportScreen
          program={program}
          courseMap={courseMap}
          onApply={(rows, newCustom) => {
            newCustom.forEach(addCustom);
            setTaken(rows);
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
          onEdit={() => setStep('manual')}
          onReimport={() => setStep('import')}
        />
      )}

      <footer className="muted">참고용이며 최종 졸업 여부는 학교 학사 시스템 기준입니다.</footer>
    </main>
  );
}
