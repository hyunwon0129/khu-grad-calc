// 데이터 검증 스크립트: npm run validate
// 학과 데이터를 추가할 때마다 실행해서 입력 오류를 잡는다.
import { readFileSync } from 'node:fs';

const courses = JSON.parse(readFileSync(new URL('../src/data/courses.json', import.meta.url)));
const programs = JSON.parse(readFileSync(new URL('../src/data/programs.json', import.meta.url)));

const errors = [];
const warnings = [];
const codeRe = /^[A-Z]{2,6}\d{3,6}$/;
const byCode = new Map();

for (const c of courses) {
  if (!codeRe.test(c.code)) errors.push(`학수번호 형식 오류: ${c.code}`);
  if (byCode.has(c.code)) errors.push(`학수번호 중복: ${c.code}`);
  if (!Number.isInteger(c.credit) || c.credit < 0 || c.credit > 6) errors.push(`학점 범위 오류: ${c.code} (${c.credit})`);
  byCode.set(c.code, c);
}

const ids = new Set();
for (const p of programs) {
  if (ids.has(p.programId)) errors.push(`programId 중복: ${p.programId}`);
  ids.add(p.programId);
  if (!p.source?.doc) errors.push(`${p.programId}: source.doc 누락`);

  for (const code of p.courses) {
    const c = byCode.get(code);
    if (!c) errors.push(`${p.programId}: courses.json에 없는 학수번호 ${code}`);
    else if (!c.typeByProgram?.[p.programId]) errors.push(`${p.programId}: ${code}의 이수구분 누락`);
  }

  const reqSum = p.requirements.reduce((s, r) => s + r.minCredits, 0);
  if (reqSum > p.totalMin) warnings.push(`${p.programId}: 영역 합(${reqSum}) > 총학점(${p.totalMin})`);

  for (const r of p.requirements) {
    const available = p.courses
      .filter((code) => byCode.get(code)?.typeByProgram?.[p.programId] === r.category)
      .reduce((s, code) => s + byCode.get(code).credit, 0);
    if (available < r.minCredits) warnings.push(`${p.programId}: ${r.category} 과목 학점 합(${available}) < 기준(${r.minCredits})`);
  }

  for (const [a, b] of p.diagram?.edges ?? []) {
    // 'A|B'는 둘 중 하나만 들으면 되는 선수과목
    if (!a.split('|').every((x) => p.courses.includes(x)) || !p.courses.includes(b)) errors.push(`${p.programId}: 선수관계 ${a}→${b}에 과정 밖 과목`);
  }
  for (const g of p.choiceGroups ?? []) {
    if (g.length < 2 || !g.every((x) => p.courses.includes(x))) errors.push(`${p.programId}: 택1 묶음 오류 ${g.join('|')}`);
  }
  for (const n of p.diagram?.nodes ?? []) {
    if (!p.courses.includes(n.code)) errors.push(`${p.programId}: 로드맵 노드 ${n.code}가 과정 밖`);
    if (n.year < 1 || n.year > 6) errors.push(`${p.programId}: ${n.code} 학년 범위 오류`);
  }
  if (!p.verified) warnings.push(`${p.programId}: 원문 대조 미검증`);
}

// 학과 기본구조표: 영역 합 = 계
const { departments } = JSON.parse(readFileSync(new URL('../src/data/departments.json', import.meta.url)));
const seen = new Set();
for (const d of departments) {
  const key = `${d.campus}:${d.name}`;
  if (seen.has(key)) errors.push(`학과 중복: ${key}`);
  seen.add(key);
  for (const k of ['single', 'multi', 'minor']) {
    const b = d[k];
    if (b && b.기초 + b.필수 + b.선택 !== b.계 && !(d.name.includes('발광') || d.name.includes('구동'))) errors.push(`${key} ${k}: 영역 합 ≠ 계 (${b.기초}+${b.필수}+${b.선택}≠${b.계})`);
  }
}
for (const p of programs.filter((x) => x.kind === 'MAJOR' && !x.programId.startsWith('SAMPLE'))) {
  const d = departments.find((x) => x.campus === p.campus && x.name === p.department);
  if (!d) warnings.push(`${p.programId}: 기본구조표에 학과 없음`);
}

warnings.forEach((w) => console.warn('⚠', w));
errors.forEach((e) => console.error('✖', e));
console.log(`\n과목 ${courses.length}개, 과정 ${programs.length}개, 학과 ${departments.length}개 / 오류 ${errors.length}, 경고 ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
