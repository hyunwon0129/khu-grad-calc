// 결과 화면 맨 위: 한 줄 결론 + 졸업까지 남은 요건 체크리스트. 각 줄의 버튼을 누르면 아래에 세부 탭이 열린다.
export type RowStatus = 'ok' | 'todo' | 'ongoing' | 'check';
export interface SummaryRow {
  key: string;
  label: string;
  status: RowStatus;
  detail?: string;
  tab?: string;        // 눌렀을 때 열 탭
}

interface Props {
  headline: string;
  allDone: boolean;
  planLine?: string | null;
  rows: SummaryRow[];
  tabLabel: (tab: string) => string;
  onOpen: (tab: string) => void;
}

const MARK: Record<RowStatus, string> = { ok: '✓', todo: '!', ongoing: '…', check: '?' };
const STATUS: Record<RowStatus, string> = { ok: '충족', todo: '남음', ongoing: '수강 중', check: '확인 필요' };

export default function GradSummary({ headline, allDone, planLine, rows, tabLabel, onOpen }: Props) {
  const left = rows.filter((r) => r.status === 'todo').length;
  // 남은 것·확인할 것은 위에, 충족한 것은 한 줄로, 직접 확인할 일반 요건은 접어 둔다
  const manual = rows.filter((r) => r.status === 'check' && !r.tab);
  const open = rows.filter((r) => r.status !== 'ok' && !manual.includes(r));
  const done = rows.filter((r) => r.status === 'ok');
  const item = (r: SummaryRow) => (
    <li key={r.key} className={`check check-${r.status}`}>
      <span className="check-mark" aria-hidden="true">{MARK[r.status]}</span>
      <span className="check-name">{r.label}</span>
      <span className="check-status">{r.detail ?? STATUS[r.status]}</span>
      {r.tab && (
        <button type="button" className="link small check-open" onClick={() => onOpen(r.tab!)} aria-label={`${r.label} 자세히: ${tabLabel(r.tab)}`}>
          자세히 ›
        </button>
      )}
    </li>
  );
  return (
    <section className="verdict" aria-label="졸업까지 남은 요건">
      <p className={allDone ? 'verdict-headline ok' : 'verdict-headline'}>{headline}</p>
      {planLine && <p className="verdict-plan-line"><span className="chip">계획 반영</span>{planLine}</p>}
      <h3>졸업 요건 체크 <span className="muted small">{left ? `남은 항목 ${left}개` : '남은 항목 없음'}</span></h3>
      <ul className="grad-checklist">
        {open.map(item)}
      </ul>
      {done.length > 0 && (
        <p className="grad-done small">
          <span className="check-mark" aria-hidden="true">✓</span>
          <span>충족 {done.length}개: {done.map((r) => r.label).join(', ')}</span>
        </p>
      )}
      {manual.length > 0 && (
        <details className="manual-checks">
          <summary>사정표로 확인할 수 없는 요건 {manual.length}개</summary>
          <ul>{manual.map((r) => <li key={r.key}><strong>{r.label}</strong>{r.detail && <span className="muted"> · {r.detail}</span>}</li>)}</ul>
          <p className="muted small">근거: 2026 학사제도안내 97쪽 「졸업요건」</p>
        </details>
      )}
    </section>
  );
}
