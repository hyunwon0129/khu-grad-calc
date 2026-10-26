// 만약에 시뮬레이터: 다음에 들을 과목을 영역·학점으로 넣어 보면 위 막대와 결론이 바로 바뀐다.
import { useState } from 'react';
import { SCHOOL_CATEGORIES, type SchoolCategory } from '../lib/reportLayout';
import { newPlanId, quickAdds, type PlannedItem } from '../lib/whatif';
import type { AreaView } from './SchoolProgress';

interface Props {
  views: AreaView[];
  plans: PlannedItem[];
  onPlans: (p: PlannedItem[]) => void;
}

export default function WhatIfPanel({ views, plans, onPlans }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SchoolCategory>('전공선택');
  const [credit, setCredit] = useState(3);
  const total = plans.reduce((s, p) => s + p.credit, 0);
  const suggestions = quickAdds(views, plans);

  const add = (item: Omit<PlannedItem, 'id'>) => onPlans([...plans, { ...item, id: newPlanId() }]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (credit < 1 || credit > 6) return;
    add({ name: name.trim(), category, credit });
    setName('');
  };

  return (
    <section className="whatif" aria-label="만약에 시뮬레이터">
      <div className="whatif-head">
        <h2>만약에 이 과목들을 들으면?</h2>
        {plans.length > 0 && <span className="chip">{plans.length}과목 · {total}학점 계획</span>}
      </div>
      <p className="muted">다음 학기에 들을 과목을 영역과 학점으로 넣어 보세요. 위 막대에 테두리로 표시되고 결론이 바로 바뀝니다.</p>

      {suggestions.length > 0 && (
        <div className="quick-adds">
          <span className="muted">부족한 영역에 바로 추가</span>
          {suggestions.map((q) => (
            <button key={q.category} type="button" className="chip-btn" onClick={() => add({ name: '', category: q.category, credit: q.credit })}>
              + {q.category} {q.credit}학점
            </button>
          ))}
        </div>
      )}

      <form className="whatif-form" onSubmit={submit}>
        <input id="plan-name" placeholder="과목명 (선택)" value={name} onChange={(e) => setName(e.target.value)} aria-label="과목명" maxLength={40} />
        <select id="plan-category" value={category} onChange={(e) => setCategory(e.target.value as SchoolCategory)} aria-label="이수구분">
          {SCHOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input id="plan-credit" type="number" min={1} max={6} value={credit} className="num" onChange={(e) => setCredit(Number(e.target.value))} aria-label="학점" />
        <button type="submit">추가</button>
      </form>

      {plans.length > 0 && (
        <>
          <ul className="plan-list">
            {plans.map((p) => (
              <li key={p.id}>
                <span className="chip">{p.category}</span>
                <span className="plan-name">{p.name || `${p.category} 과목`}</span>
                <span className="muted">{p.credit}학점</span>
                <button type="button" className="link small" onClick={() => onPlans(plans.filter((x) => x.id !== p.id))} aria-label={`${p.name || p.category} 계획 삭제`}>삭제</button>
              </li>
            ))}
          </ul>
          <button type="button" className="link small" onClick={() => onPlans([])}>계획 모두 지우기</button>
        </>
      )}
    </section>
  );
}
