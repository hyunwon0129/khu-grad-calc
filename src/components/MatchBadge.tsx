// 과목별 학점 합이 사정표의 학교 집계와 맞는지 보여준다
import type { MatchResult } from '../lib/reportLayout';

export default function MatchBadge({ result, compact = false }: { result: MatchResult; compact?: boolean }) {
  if (result.compared === 0) return null;
  if (result.ok) {
    return (
      <p className="match match-ok" role="status">
        <span className="match-mark" aria-hidden="true">✓</span>
        학교 집계와 일치 <span className="muted">· {result.compared}개 영역의 과목 학점 합이 사정표 숫자와 같습니다</span>
      </p>
    );
  }
  return (
    <div className="match match-warn" role="status">
      <p><span className="match-mark" aria-hidden="true">!</span> 학교 집계와 다른 영역 {result.mismatches.length}개</p>
      {!compact && (
        <ul>
          {result.mismatches.map((m) => (
            <li key={m.name}>{m.name}: 읽은 과목 합 {m.counted}학점 · 사정표 {m.school}학점</li>
          ))}
        </ul>
      )}
      <p className="muted">
        {compact
          ? '남은 학점은 사정표 숫자를 기준으로 보여줍니다. 과목 목록에서 빠지거나 잘못 분류된 과목이 있는지 확인하세요.'
          : '빠진 과목이 있거나 이수구분이 다르게 읽혔을 수 있습니다. 노란 줄과 이수구분 칸을 확인하세요. 남은 학점은 사정표 숫자를 기준으로 계산합니다.'}
      </p>
    </div>
  );
}
