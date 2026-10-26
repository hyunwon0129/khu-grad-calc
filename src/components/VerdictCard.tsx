// 결과 화면 맨 위: 한 줄 결론 + 학기당 필요 학점 + 학점 밖 졸업요건
import { useState } from 'react';
import type { ReportData } from '../lib/reportLayout';
import { manualChecks, type CheckStatus } from '../lib/requirements';
import { buildVerdict, estimateSemestersLeft, perSemester } from '../lib/verdict';
import { currentTerm } from '../lib/parseReport';
import type { AreaView } from './SchoolProgress';

interface Props {
  report: ReportData;
  views: AreaView[];
}

const STATUS_LABEL: Record<CheckStatus, string> = {
  met: '충족', unmet: '미충족', exempt: '면제', na: '해당 없음', unknown: '확인 필요',
};

export default function VerdictCard({ report, views }: Props) {
  const checks = report.checks ?? [];
  const verdict = buildVerdict(views, checks);
  const estimated = estimateSemestersLeft(report.admissionYear, currentTerm());
  const [semesters, setSemesters] = useState<number>(estimated ?? 4);
  const [limit, setLimit] = useState(18);
  const need = perSemester(verdict.remainingCredits, semesters);
  const manual = manualChecks(report.admissionYear);

  return (
    <section className="verdict" aria-label="졸업까지 남은 것">
      <p className={verdict.allDone ? 'verdict-headline ok' : 'verdict-headline'}>{verdict.headline}</p>

      {verdict.remainingCredits > 0 && (
        <div className="verdict-plan">
          <div className="toolbar">
            <label htmlFor="sem-remaining">남은 정규 학기</label>
            <input id="sem-remaining" type="number" min={0} max={12} value={semesters} className="num"
              onChange={(e) => setSemesters(Math.max(0, Number(e.target.value)))} />
            <label htmlFor="credit-limit">학기당 수강허용학점</label>
            <input id="credit-limit" type="number" min={9} max={24} value={limit} className="num"
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))} />
          </div>
          {need === null ? (
            <p className="warn">남은 정규 학기가 없습니다. 계절학기나 추가 학기(수업연한 초과)가 필요합니다.</p>
          ) : (
            <p>
              이번 학기 이후 <strong>학기당 {need}학점</strong>씩 들으면 됩니다
              {need > limit
                ? <span className="warn"> · 수강허용학점({limit})보다 많아 계절학기나 추가 학기가 필요할 수 있습니다</span>
                : <span className="muted"> · 수강허용학점 {limit}학점 안</span>}
            </p>
          )}
          <p className="muted">
            {estimated !== null ? `남은 학기는 ${report.admissionYear}학번이 휴학 없이 8학기에 졸업한다고 보고 계산했습니다. ` : ''}
            수강허용학점은 단과대학·학번마다 다릅니다(2026 학사제도안내 64쪽).
          </p>
        </div>
      )}

      {checks.length > 0 && (
        <div className="checks">
          <h3>학점 밖 졸업요건</h3>
          <ul>
            {checks.map((c) => (
              <li key={c.key} className={`check check-${c.status}`}>
                <span className="check-mark" aria-hidden="true">{c.status === 'met' || c.status === 'exempt' ? '✓' : c.status === 'unmet' ? '!' : '?'}</span>
                <span className="check-name">{c.name}</span>
                <span className="check-status">{STATUS_LABEL[c.status]}{c.detail ? ` · ${c.detail}` : ''}</span>
                {c.hint && <span className="check-hint muted">{c.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="manual-checks">
        <summary>사정표로 확인할 수 없는 요건 {manual.length}개</summary>
        <ul>
          {manual.map((m) => (
            <li key={m.name}><strong>{m.name}</strong> <span className="muted">· {m.detail}</span></li>
          ))}
        </ul>
        <p className="muted">근거: 2026 학사제도안내 97쪽 「졸업요건」</p>
      </details>
    </section>
  );
}
