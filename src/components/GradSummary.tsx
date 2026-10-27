// 결과 화면 맨 위: 한 줄 결론 + 졸업까지 남은 요건 체크리스트. 각 줄의 버튼을 누르면 아래에 세부 탭이 열린다.
import { Bar, BarLegend } from './ProgressChart';

export type RowStatus = 'ok' | 'todo' | 'ongoing' | 'check';
/** 체크리스트 줄 안의 작은 진행 막대 (학점) 또는 점 (과목 수) */
export interface Meter { name?: string; done: number; pending?: number; required: number; unit: '학점' | '과목' }
export interface SummaryRow {
  key: string;
  label: string;
  status: RowStatus;
  detail?: string;
  meters?: Meter[];
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

function MeterView({ m, wide }: { m: Meter; wide: boolean }) {
  const left = Math.max(0, m.required - m.done - (m.pending ?? 0));
  const label = `${m.name ? `${m.name} ` : ''}${m.done}/${m.required}${m.unit}`;
  const dots = m.unit === '과목' && m.required <= 12;
  return (
    <span className={`meter${wide ? ' meter-wide' : ''}${left ? '' : ' meter-full'}`}>
      {m.name && <span className="meter-name">{m.name}</span>}
      {dots ? (
        <span className="dots" role="img" aria-label={label}>
          {Array.from({ length: m.required }, (_, i) => (
            <i key={i} className={i < m.done ? 'dot dot-done' : i < m.done + (m.pending ?? 0) ? 'dot dot-ip' : 'dot'} />
          ))}
        </span>
      ) : (
        <Bar earned={m.done} pending={m.pending ?? 0} planned={0} required={m.required} label={m.name ?? '진행'} />
      )}
      <span className="meter-num">{m.done}<span className="muted">/{m.required}</span></span>
    </span>
  );
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
      {r.meters && r.meters.length > 0 && (
        <span className="meters">{r.meters.map((m, i) => <MeterView key={m.name ?? i} m={m} wide={r.meters!.length === 1} />)}</span>
      )}
      {(r.detail || !r.meters?.length) && <span className="check-status">{r.detail ?? STATUS[r.status]}</span>}
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
      <BarLegend pending={rows.some((r) => r.meters?.some((m) => (m.pending ?? 0) > 0))} planned={false} />
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
