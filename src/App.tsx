// 화면 흐름: 시작(교육과정·입력 방식 선택) → 사정표 가져오기 | 직접 입력 → 결과
// 로그인(선택): 서버가 설정돼 있으면 학수번호·학기·설정을 계정에 동기화
import { useCallback, useEffect, useMemo, useState } from 'react';
import coursesData from './data/courses.json';
import programsData from './data/programs.json';
import departmentsData from './data/departments.json';
import type { Course, DepartmentInfo, Program, TakenCourse } from './lib/types';
import { clearState, getNoSave, isEmpty, loadState, saveState, setNoSave, type UserData } from './lib/storage';
import { cloudEnabled, setLocalOwner, signOut } from './lib/cloud';
import { useCloudSync } from './lib/useCloudSync';
import StartScreen from './components/StartScreen';
import ImportScreen from './components/ImportScreen';
import type { ReportData } from './lib/reportLayout';
import type { PlannedItem } from './lib/whatif';
import { DEFAULT_LIB_OPTIONS, type LiberalOptions } from './lib/liberal';
import { matchProgram } from './lib/dept';
import ManualScreen from './components/ManualScreen';
import ResultScreen from './components/ResultScreen';
import AccountPanel from './components/AccountPanel';
import WelcomeScreen from './components/WelcomeScreen';
import AboutScreen, { APP_VERSION, DATA_BASIS } from './components/AboutScreen';
import FeedbackLink from './components/FeedbackLink';
import emblemUrl from './assets/brand/emblem.png?inline';
import './App.css';

const baseCourses = coursesData as unknown as Course[];
const programs = programsData as unknown as Program[];
const majors = programs.filter((p) => p.kind === 'MAJOR');
const departments = departmentsData.departments as unknown as DepartmentInfo[];
const DEFAULT_MAX_CREDITS = 9;

const GUEST_KEY = 'khu-grad-calc:guest';
const readGuest = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } };
const writeGuest = (v: boolean) => { try { if (v) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); } catch { /* 무시 */ } };

export type Step = 'start' | 'import' | 'manual' | 'result' | 'about';

export default function App() {
  const [noSave, setNoSaveState] = useState(getNoSave);
  const saved = useMemo(() => (getNoSave() ? null : loadState()), []);
  const validSaved = saved && majors.some((p) => p.programId === saved.programId) ? saved : null;

  const [step, setStep] = useState<Step>('start');
  const [programId, setProgramId] = useState(validSaved?.programId ?? majors[0]?.programId ?? '');
  const [taken, setTaken] = useState<TakenCourse[]>(validSaved?.taken ?? []);
  const [custom, setCustom] = useState<Course[]>(validSaved?.custom ?? []); // 목록에 없어 사용자가 지정한 과목
  const [excluded, setExcluded] = useState<string[]>(validSaved?.excluded ?? []);
  const [maxCredits, setMaxCredits] = useState(validSaved?.maxCreditsPerSemester ?? DEFAULT_MAX_CREDITS);
  const [savedAt, setSavedAt] = useState(validSaved?.savedAt ?? null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sampleOnOpen, setSampleOnOpen] = useState(false);
  const [report, setReport] = useState<ReportData | null>(validSaved?.report ?? null); // 졸업사정표 분석 결과
  const [plans, setPlans] = useState<PlannedItem[]>(validSaved?.plans ?? []); // 만약에 계획
  const [libOptions, setLibOptions] = useState<LiberalOptions>(validSaved?.libOptions ?? DEFAULT_LIB_OPTIONS); // 교양 면제·학생 구분

  const data: UserData = { programId, taken, custom, excluded, maxCreditsPerSemester: maxCredits, report, plans, libOptions };

  const apply = useCallback((d: UserData) => {
    if (majors.some((p) => p.programId === d.programId)) setProgramId(d.programId);
    setTaken(d.taken); setCustom(d.custom); setExcluded(d.excluded); setMaxCredits(d.maxCreditsPerSemester); setReport(d.report ?? null); setPlans(d.plans ?? []); setLibOptions(d.libOptions ?? DEFAULT_LIB_OPTIONS);
  }, []);
  const sync = useCloudSync(data, apply);
  // 소셜 로그인에서 돌아왔는데 실패한 경우: 주소의 오류를 읽어 안내하고 주소는 깨끗이
  const [authError] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const e = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
      if (!e) return '';
      window.history.replaceState(null, '', window.location.pathname);
      return /exchange external code/i.test(e) ? 'Google 로그인을 마치지 못했어요. 잠시 후 다시 시도해 주세요. (서버 설정 확인 필요)'
        : /access_denied|denied/i.test(e) ? '로그인을 취소했어요.'
        : '로그인을 마치지 못했어요. 다시 시도해 주세요.';
    } catch { return ''; }
  });
  const [guest, setGuestState] = useState(readGuest);
  const setGuest = (v: boolean) => { setGuestState(v); writeGuest(v); };
  // 로그아웃하면 다시 첫 화면(로그인/게스트)으로
  const [wasLoggedIn, setWasLoggedIn] = useState(false);
  useEffect(() => {
    if (sync.session) { setWasLoggedIn(true); writeGuest(false); }
    else if (wasLoggedIn) { setWasLoggedIn(false); setGuestState(false); setStep('start'); }
  }, [sync.session, wasLoggedIn]);

  useEffect(() => {
    if (noSave || isEmpty(data)) { clearState(); return; }
    saveState(data);
    setSavedAt(new Date().toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, taken, custom, excluded, maxCredits, report, plans, libOptions, noSave]);

  // 화면이 바뀌면 맨 위부터 보이게
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

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
    setTaken([]); setCustom([]); setExcluded([]); setMaxCredits(DEFAULT_MAX_CREDITS); setSavedAt(null); setReport(null); setPlans([]); setLibOptions(DEFAULT_LIB_OPTIONS);
    setStep('start');
  };

  const loggedIn = !!sync.session;
  // 로그인 서버가 있으면 첫 화면에서 로그인/게스트를 고른다
  const gate: 'app' | 'welcome' | 'loading' = !cloudEnabled || loggedIn || guest ? 'app' : sync.checked ? 'welcome' : 'loading';

  return (
    <main>
      <header>
        <div className="header-row">
          {/* 휘장·서비스명 = 홈: 어느 화면에서든 시작 화면으로 (입력한 기록은 그대로) */}
          <div className="brand-row">
          <h1 className="brand-h1"><a className="brand" href="./" aria-label="졸업요건 계산기 처음 화면으로"
            onClick={(e) => { e.preventDefault(); setAccountOpen(false); setStep('start'); window.scrollTo({ top: 0 }); }}>
            <img className="brand-emblem" src={emblemUrl} alt="" width={60} height={40} />
            <span className="brand-text">
              <span className="brand-univ">경희대학교</span>
              <span className="brand-title">졸업요건 계산기</span>
            </span>
          </a></h1>
          <span className="chip unofficial">비공식 참고용</span>
          </div>
          {cloudEnabled && gate === 'app' && (loggedIn ? (
            <div className="account-actions">
              <button type="button" className="link small account-name" onClick={() => setAccountOpen((v) => !v)} aria-expanded={accountOpen} title="계정·데이터 관리">
                {sync.session?.user.email?.split('@')[0] ?? '내 계정'}
              </button>
              <button type="button" className="account-btn" onClick={async () => { setAccountOpen(false); setLocalOwner(null); await signOut(); }}>로그아웃</button>
            </div>
          ) : (
            <button type="button" className="account-btn" onClick={() => setAccountOpen((v) => !v)} aria-expanded={accountOpen}>로그인</button>
          ))}
        </div>
        <p className="muted header-badge">
          <span className="lock" aria-hidden="true">●</span> 사정표는 내 기기 안에서만 처리돼요
          {loggedIn ? ' · 과목·학점 기록만 계정에 동기화돼요' : ''}
        </p>
        <span className="motif" aria-hidden="true" />
      </header>

      {cloudEnabled && gate === 'app' && accountOpen && (
        <AccountPanel session={sync.session} status={sync.status} lastSynced={sync.lastSynced} onClose={() => setAccountOpen(false)} onClearLocal={resetAll} />
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

      {sync.askUpload && (
        <section className="resume" role="alertdialog" aria-label="이 기기 기록 올리기">
          <strong>{sync.askUpload === 'other' ? '이 기기 기록은 다른 계정에서 쓰던 것입니다' : '이 기기에 있는 기록을 계정에 저장할까요?'}</strong>
          <span className="muted">과목 {taken.length}개{report ? ' · 사정표 분석 결과' : ''}. 본인 기록이 아니면 비우고 시작하세요.</span>
          <div className="actions">
            <button type="button" className="primary" onClick={() => sync.resolveUpload(true, resetAll)}>내 기록이 맞아요, 저장</button>
            <button type="button" onClick={() => sync.resolveUpload(false, resetAll)}>비우고 시작</button>
          </div>
        </section>
      )}

      {authError && !loggedIn && <p className="notice notice-warn" role="alert"><span>{authError}</span></p>}

      {gate === 'welcome' && step !== 'about' && (
        <WelcomeScreen
          hasLocal={!isEmpty(data)}
          onGuest={() => setGuest(true)}
          login={<AccountPanel variant="welcome" session={null} status={sync.status} lastSynced={null} onClose={() => {}} onClearLocal={resetAll} />}
        />
      )}
      {gate === 'loading' && <p className="muted" role="status">불러오는 중…</p>}

      {gate === 'app' && step !== 'start' && step !== 'about' && (
        <nav className="steps" aria-label="단계">
          <button type="button" className="link" onClick={() => setStep('start')}>← 처음으로</button>
          <span className="muted">{program.department} · {program.admissionYearRange[0]}학번 교육과정</span>
        </nav>
      )}

      {gate === 'app' && step === 'start' && (
        <StartScreen
          majors={majors}
          programId={programId}
          savedCount={taken.length}
          savedAt={savedAt}
          synced={loggedIn}
          onProgram={(id) => { setProgramId(id); setTaken([]); setCustom([]); setExcluded([]); setReport(null); }}
          onChoose={(st) => { setSampleOnOpen(false); setStep(st); }}
          onSample={() => { setSampleOnOpen(true); setStep('import'); }}
          onClear={resetAll}
        />
      )}
      {gate === 'app' && step === 'import' && (
        <ImportScreen
          key={sampleOnOpen ? 'sample' : 'file'}
          startWithSample={sampleOnOpen}
          noSave={noSave}
          onNoSave={(v) => { setNoSave(v); setNoSaveState(v); }}
          program={program}
          majors={majors}
          courseMap={courseMap}
          onApply={(rows, newCustom, newReport) => {
            // 이전 사정표에서 만든 과목은 버리고 이번 파일 것으로 교체 (직접 추가한 과목은 유지)
            setCustom((prev) => [
              ...prev.filter((c) => c.source !== 'import' && c.name !== '사정표에서 불러온 과목' && !newCustom.some((n) => n.code === c.code)),
              ...newCustom,
            ]);
            setTaken(rows);
            setReport(newReport);
            setExcluded([]);
            // 사정표의 학과·입학연도에 맞는 교육과정이 있으면 자동으로 바꾼다
            const matched = newReport.department ? matchProgram(majors, newReport.department, newReport.admissionYear) : undefined;
            if (matched) setProgramId(matched.programId);
            setStep('result');
          }}
        />
      )}
      {gate === 'app' && step === 'manual' && (
        <ManualScreen
          program={program}
          majors={majors}
          onProgram={setProgramId}
          courseMap={courseMap}
          taken={taken}
          onChange={setTaken}
          onAddCustom={addCustom}
          onDone={() => setStep('result')}
        />
      )}
      {gate === 'app' && step === 'result' && (
        <ResultScreen
          program={program}
          programs={programs}
          departments={departments}
          courseMap={courseMap}
          taken={taken}
          report={report}
          plans={plans}
          onPlans={setPlans}
          libOptions={libOptions}
          onLibOptions={setLibOptions}
          excluded={excluded}
          maxCredits={maxCredits}
          onExcluded={setExcluded}
          onMaxCredits={setMaxCredits}
          onEdit={() => setStep('manual')}
          onReimport={() => setStep('import')}
        />
      )}

      {step === 'about' && <AboutScreen onBack={() => setStep('start')} />}

      <footer className="muted app-footer">
        <span>비공식 참고용 · 최종 판정은 학사정보시스템 기준</span>
        <span>
          <button type="button" className="link" onClick={() => setStep('about')}>이용 안내</button>
          {' '}· <FeedbackLink />
          {' '}· v{APP_VERSION} · {DATA_BASIS} 기준
        </span>
      </footer>
    </main>
  );
}
