// 학과 원본 표(data-src/*.tsv, structure-2026.raw.json) → 앱 데이터(src/data/*.json)
// 실행: npm run build:data  (이후 npm run validate)
// 원본 출처는 각 tsv 첫 줄과 아래 SOURCES에 적는다. 표를 고치면 이 스크립트를 다시 돌린다.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

/** tsv → { rows, pre: [pre, post][], choice: string[][] } */
function readTsv(path) {
  const rows = [], pre = [], choice = [];
  for (const line of read(path).split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols[0] === '#PRE') { pre.push([cols[2], cols[1]]); continue; } // #PRE 후수 선수 → [선수, 후수]
    if (cols[0] === '#CHOICE') { choice.push(cols[1].split('|')); continue; }
    if (line.startsWith('#')) continue;
    const [cat, name, code, credit, year, s1, s2] = cols;
    rows.push({ cat, name, code, credit: Number(credit), year: Number(year), s1: s1 === '1', s2: s2 === '1' });
  }
  return { rows, pre, choice };
}

const courses = new Map(); // code → Course
function addCourse(code, name, credit, programId, cat) {
  const c = courses.get(code) ?? { code, name, credit, typeByProgram: {} };
  if (c.credit !== credit) throw new Error(`${code} 학점 불일치 ${c.credit} vs ${credit}`);
  c.typeByProgram[programId] = cat;
  courses.set(code, c);
}

function nodesOf(rows) {
  return rows.filter((r) => r.year > 0).map((r) => ({
    code: r.code,
    year: r.year,
    semester: r.s1 || !r.s2 ? 1 : 2,
    ...(r.s1 && r.s2 ? { both: true } : {}),
  }));
}

const programs = [];

// ── 산업경영공학과 (국제캠퍼스 공과대학) ─────────────────────────────
{
  const ie = readTsv('data-src/ie-2025.tsv');
  const id = 'IE-2025-MAJOR';
  ie.rows.forEach((r) => addCourse(r.code, r.name, r.credit, id, r.cat));
  programs.push({
    programId: id,
    campus: 'INTL',
    college: '공과대학',
    department: '산업경영공학과',
    kind: 'MAJOR',
    admissionYearRange: [2025, 2025],
    requirements: [
      { category: '전기', minCredits: 24 },
      { category: '전필', minCredits: 6 },
      { category: '전선', minCredits: 49 },
    ],
    totalMin: 79,
    courses: ie.rows.map((r) => r.code),
    choiceGroups: ie.choice,
    source: {
      doc: '2025 산업경영공학과 교육과정 및 졸업요건 (학과 홈페이지 교육과정 게시판)',
      year: 2025,
      url: 'https://ie.khu.ac.kr/ie/user/bbs/BMSR00040/list.do?menuNo=17400010',
    },
    verified: true,
    note: '2025학년도 교육과정 기준입니다. 2026학번은 2026 교육과정 책자 기준 과정을 씁니다.',
    diagram: { nodes: nodesOf(ie.rows), edges: ie.pre, tracks: [] },
  });
}

// ── 컴퓨터공학과 (국제캠퍼스 소프트웨어융합대학) ───────────────────
{
  const ce = readTsv('data-src/ce-2024.tsv');
  const id = 'CE-2024-MAJOR';
  ce.rows.forEach((r) => addCourse(r.code, r.name, r.credit, id, r.cat));
  const industry = ['CSE330', 'CSE334', 'CSE434', 'CSE436', 'CSE335', 'CSE437', 'CSE450', 'CSE451', 'CSE442', 'CSE438', 'SWCON302', 'CSE496', 'CSE497'];
  const source = {
    doc: '2024학년도 교육과정 – 소프트웨어융합대학 컴퓨터공학과 시행세칙 (378~386쪽)',
    year: 2024,
    url: 'https://ce.khu.ac.kr/ce25/user/bbs/BMSR00048/list.do?menuNo=21600025',
  };
  programs.push({
    programId: id,
    campus: 'INTL',
    college: '소프트웨어융합대학',
    department: '컴퓨터공학과',
    kind: 'MAJOR',
    admissionYearRange: [2024, 2024],
    // 전선 27 = 산학필수 12 + 전공선택 15
    requirements: [
      { category: '전기', minCredits: 15 },
      { category: '전필', minCredits: 45 },
      { category: '전선', minCredits: 27 },
    ],
    totalMin: 87,
    courses: ce.rows.map((r) => r.code),
    source,
    verified: true,
    note: '전공선택 27학점 안에 산학필수 12학점(현장실습 포함)이 들어 있어야 합니다. 현장실습 학점은 과목 목록에 없어 사정표 값으로만 반영됩니다.',
    diagram: {
      nodes: nodesOf(ce.rows),
      edges: ce.pre,
      tracks: [{ name: '산학필수', courses: industry, minCredits: 12 }],
    },
  });

  // 다전공 [표2]: 전공기초·전공필수가 단일전공과 다르다
  const mid = 'CE-2024-MULTI';
  const basic = ['AMTH1004', 'AMTH1009', 'EE211', 'CSE201'];
  const req = ['CSE103', 'CSE203', 'CSE204', 'CSE301', 'CSE302', 'CSE304', 'CSE305', 'CSE327', 'CSE405', 'CSE403'];
  const multiCourses = [];
  for (const r of ce.rows) {
    const cat = basic.includes(r.code) ? '전기' : req.includes(r.code) ? '전필' : r.cat === '전기' ? null : '전선';
    if (!cat) continue;
    addCourse(r.code, r.name, r.credit, mid, cat);
    multiCourses.push(r.code);
  }
  programs.push({
    programId: mid,
    campus: 'INTL',
    college: '소프트웨어융합대학',
    department: '컴퓨터공학과',
    kind: 'MULTI_MAJOR',
    admissionYearRange: [2024, 2024],
    requirements: [
      { category: '전기', minCredits: 12 },
      { category: '전필', minCredits: 27 },
      { category: '전선', minCredits: 15 },
    ],
    totalMin: 54,
    courses: multiCourses,
    overlapPolicy: { withMajor: 'FULL' },
    source: { ...source, doc: `${source.doc} [표2] 다전공 전공과목 편성표` },
    verified: true,
  });
}

// ── 경영학과 (서울캠퍼스 경영대학) ────────────────────────────────
{
  const biz = readTsv('data-src/biz-2026.tsv');
  const id = 'BIZ-2026-MAJOR';
  biz.rows.forEach((r) => addCourse(r.code, r.name, r.credit, id, r.cat));
  programs.push({
    programId: id,
    campus: 'SEOUL',
    college: '경영대학',
    department: '경영학과',
    kind: 'MAJOR',
    admissionYearRange: [2026, 2026],
    requirements: [
      { category: '전기', minCredits: 12 },
      { category: '전필', minCredits: 18 },
      { category: '전선', minCredits: 33 },
    ],
    totalMin: 63,
    courses: biz.rows.map((r) => r.code),
    source: {
      doc: '경영학과 교육과정 시행세칙(2026) [별표1] 교육과정 편성표',
      year: 2026,
      url: 'https://com.khu.ac.kr/biz_kor/user/contents/view.do?menuNo=14500237',
    },
    verified: true,
    diagram: { nodes: nodesOf(biz.rows), edges: [], tracks: [] },
  });

  // 마이크로디그리 ([별표7]) — MD 과목은 전공·교양과 중복 인정
  const mdSource = {
    doc: '경영학과 교육과정 시행세칙(2026) [별표7] 마이크로디그리 이수체계도',
    year: 2026,
    url: 'https://com.khu.ac.kr/biz_kor/user/contents/view.do?menuNo=14500237',
  };
  const mds = [
    {
      id: 'MD-ESG', name: 'ESG 경영 MD', min: 9,
      list: [['MGMT1003', '책임경영', 3], ['MGMT2014', 'ESG경영', 3], ['ACCT4010', 'ESG경영과재무보고', 3], ['IS3537', 'ESG의이론과사례', 3]],
      rule: '4과목 중 3과목(9학점)',
    },
    {
      id: 'MD-CULTURE', name: '문화산업경영 MD', min: 9,
      list: [['MGMT3339', '경영세미나', 3], ['MGMT1005', '경영커뮤니케이션', 3], ['CUENT4002', '엔터테인먼트산업과정책', 3]],
      rule: '3과목 모두(9학점)',
    },
    {
      id: 'MD-BIOHEALTH', name: '바이오헬스산업경영 MD', min: 9,
      list: [['MGMT3022', '미래산업과경영혁신', 3], ['MGMT4004', '경영특강', 3], ['PHRM1003', '약학개론', 2], ['OPS4227', '생물의약품개발론', 2], ['PHS4222', '의약품개발', 2]],
      rule: '5과목 중 9학점 이상',
    },
  ];
  for (const md of mds) {
    md.list.forEach(([code, name, credit]) => addCourse(code, courses.get(code)?.name ?? name, credit, md.id, 'MD'));
    programs.push({
      programId: md.id,
      campus: 'SEOUL',
      college: '경영대학',
      department: md.name,
      kind: 'MICRO_DEGREE',
      admissionYearRange: [2020, 2026],
      requirements: [{ category: 'MD', minCredits: md.min }],
      totalMin: md.min,
      courses: md.list.map(([c]) => c),
      overlapPolicy: { withMajor: 'FULL' },
      source: mdSource,
      verified: true,
      note: md.rule,
    });
  }
}


// ── 2026학년도 교육과정(국제캠퍼스) 책자 → 국제캠퍼스 전 학과 ─────────────────
// data-src/intl-2026.json 은 scripts/book/ 의 파서로 책자 [별표1] 교육과정 편성표·선수과목 지정표에서 뽑은 것
{
  const book = JSON.parse(read('data-src/intl-2026.json'));
  const rawStruct = JSON.parse(read('data-src/structure-2026.raw.json'));
  const dot = (x) => x.replace(/[\u00B7\u0387\u2027\u30FB\uFF65\u318D]/g, '·').replace(/\s+/g, '');
  const structOf = (name) => rawStruct.find((r) => r.campus === 'INTL' && dot(r.name) === dot(name));
  const slug = (name) => [...name].map((ch) => ch.charCodeAt(0).toString(36)).join('').slice(0, 24).toUpperCase();
  const KEY = { 전기: 0, 전필: 1, 전선: 2 };
  let n = 0;
  for (const dep of book.departments) {
    for (const appName of dep.app) {
      const st = structOf(appName);
      if (!st) { console.warn('기본구조표에 없음:', appName); continue; }
      const isMajor = !!st.single;
      const block = isMajor ? st.single : st.multi;
      if (!block) continue;
      const id = `INTL26-${slug(appName)}`;
      const college = st.campus === 'INTL' ? null : null;
      const rows = dep.courses.filter((r) => Number.isInteger(r.credit));
      const used = [];
      for (const r of rows) {
        const c = courses.get(r.code);
        if (c && c.credit !== r.credit) continue; // 다른 과정과 학점이 다르게 적힌 과목은 건너뜀
        addCourse(r.code, r.name, r.credit, id, r.cat);
        used.push(r);
      }
      const reqs = ['전기', '전필', '전선']
        .map((cat) => ({ category: cat, minCredits: block[KEY[cat]] ?? 0 }))
        .filter((r) => r.minCredits > 0);
      programs.push({
        programId: id,
        campus: 'INTL',
        college: '',
        department: st.name,
        kind: isMajor ? 'MAJOR' : 'MULTI_MAJOR',
        admissionYearRange: [2026, 2026],
        requirements: reqs,
        totalMin: block[3],
        courses: used.map((r) => r.code),
        source: {
          doc: `2026학년도 교육과정(국제캠퍼스) ${dep.book} [별표1] 교육과정 편성표 (${dep.pages[0]}쪽~)`,
          year: 2026,
        },
        verified: reqs.every((q) => used.filter((u) => u.cat === q.category).reduce((a, u) => a + u.credit, 0) >= q.minCredits),
        note: dep.app.length > 1 ? `${dep.book} 공통 편성표를 씁니다. 전공별 필수 과목은 학과 시행세칙을 확인하세요.` : undefined,
        diagram: {
          nodes: nodesOf(used),
          edges: dep.prereqs.filter(([a, b]) => used.some((u) => u.code === b) && a.split('|').every((x) => used.some((u) => u.code === x))),
          tracks: [],
        },
      });
      n++;
    }
  }
  console.log(`국제캠퍼스 2026 과정 ${n}개`);
}

// ── 시험용 샘플 (가상 사정표 체험용) ─────────────────────────────
{
  const oldCourses = JSON.parse(read('src/data/courses.json'));
  const oldPrograms = JSON.parse(read('src/data/programs.json'));
  for (const c of oldCourses.filter((c) => c.code.startsWith('SAMP'))) courses.set(c.code, { ...c, typeByProgram: { 'SAMPLE-2025-MAJOR': c.typeByProgram['SAMPLE-2025-MAJOR'] } });
  const sample = oldPrograms.find((p) => p.programId === 'SAMPLE-2025-MAJOR');
  if (sample) programs.push(sample);
}

// ── 2026 학사제도안내 전공별 교육과정 기본구조 (모든 학과) ──────────────
const COLLEGE = {
  SEOUL: {
    문과대학: ['국어국문학과', '영어영문학과', '응용영어통번역학과', '사학과', '철학과'],
    정경대학: ['정치외교학과', '행정학과', '사회학과', '미디어학과', '경제학과', '무역학과', '국제통상･금융투자학부'],
    경영대학: ['경영학과', '회계･세무학과', '빅데이터응용학과'],
    호텔관광대학: ['Hospitality경영학과', '조리&푸드디자인학과', '관광학과', '문화엔터테인먼트학과', '글로벌Hospitality･관광학과', '문화관광산업학과', '조리산업학과'],
    이과대학: ['수학과', '물리학과', '화학과', '생물학과', '지리학과', '정보디스플레이학과'],
    미래정보디스플레이학부: ['소재･발광소자학', '구동소자･시스템학'],
    생활과학대학: ['아동가족학과', '주거환경학과', '의상학과', '식품영양학과'],
    의과대학: ['의예과', '의학과'],
    치과대학: ['치의예과', '치의학과'],
    약학대학: ['약학과(6년제)', '한약학과', '약과학과'],
    간호과학대학: ['간호학과', '간호학과(야간)'],
    음악대학: ['작곡과', '성악과', '기악과'],
    미술대학: ['한국화', '회화', '조소'],
    무용학부: ['한국무용전공', '현대무용전공', '발레전공'],
    자율전공학부: ['글로벌리더전공', '글로벌비즈니스전공'],
    융합전공: ['사회과학융합전공', '과학지능정보융합전공', '차세대디스플레이소재융합전공', '차세대에코디스플레이융합전공', 'KA(Korean-Anglophone)컨텐츠비평', '지속가능미래학융합전공'],
  },
  INTL: {
    공과대학: ['기계공학', '지능로봇공학', '항공우주모빌리티', '산업경영공학과', '원자력공학과', '화학공학과', '신소재공학과', '사회기반시스템공학과', '건축공학과', '환경학', '환경공학', '건축학과'],
    전자정보대학: ['전자공학과', '반도체공학과', '생체의공학과'],
    소프트웨어융합대학: ['컴퓨터공학과', '인공지능학과', '소프트웨어융합학과'],
    응용과학대학: ['응용수학과', '응용물리학과', '응용화학과', '우주과학과'],
    생명과학대학: ['스마트팜과학과', '식물･환경신소재공학과', '식품생명공학과', '원예생명공학과', '유전생명공학과', '한방생명공학과', '융합바이오·신소재공학과'],
    국제대학: ['국제학과', '아시아학과'],
    외국어대학: ['프랑스어학과', '스페인어학과', '러시아어학과', '중국어학과', '일본어학과', '한국어학과', '영미어문전공', '영미문화전공'],
    '예술･디자인대학': ['산업디자인학과', '시각디자인학과', '환경조경디자인학과', '의류디자인학과', '디지털콘텐츠학과', '도예학과', '연극영화학과', '포스트모던음악학과'],
    체육대학: ['체육학과', '스포츠의학과', '골프산업학과', '스포츠지도학과', '태권도학과'],
    융합전공: ['글로벌엔지니어링', '글로벌문화기술', '4D아트', '아트&테크놀로지', 'K-퍼포밍아트', '실감미디어', '양자정보', '우주인공지능', '첨단바이오신소재', '첨단종자푸드테크', '인공지능반도체'],
  },
};
// 2026 학사제도안내 38쪽 [학생 캠퍼스 소속별 다전공 이수 금지 전공]
const BAN_SEOUL_INSTALLED = new Set([
  '의예과', '의학과', '치의예과', '치의학과', '약학과(6년제)', '한약학과', '약과학과', '간호학과', '간호학과(야간)',
  '작곡과', '성악과', '기악과', '한국화', '회화', '조소', '한국무용전공', '현대무용전공', '발레전공',
  '글로벌리더전공', '글로벌비즈니스전공', '국제통상･금융투자학부', '문화관광산업학과', '조리산업학과', '소재･발광소자학', '구동소자･시스템학',
]);
const BAN_FOR_INTL_STUDENTS_EXTRA = new Set(['영어영문학과', '응용영어통번역학과']);
const BAN_INTL_INSTALLED_FOR_SEOUL = new Set(['영미어문전공', '영미문화전공']);

const collegeOf = (campus, name) =>
  Object.entries(COLLEGE[campus]).find(([, list]) => list.includes(name))?.[0] ?? null;

const raw = JSON.parse(read('data-src/structure-2026.raw.json'));
const toBlock = (a) => (a ? { 기초: a[0] ?? 0, 필수: a[1] ?? 0, 선택: a[2] ?? 0, 계: a[3] ?? 0 } : null);
const departments = raw.map((r) => {
  const college = collegeOf(r.campus, r.name);
  if (!college) throw new Error(`단과대학 매핑 없음: ${r.campus} ${r.name}`);
  const banned = [];
  if (r.campus === 'SEOUL' && BAN_SEOUL_INSTALLED.has(r.name)) banned.push('SEOUL', 'INTL');
  if (r.campus === 'SEOUL' && BAN_FOR_INTL_STUDENTS_EXTRA.has(r.name)) banned.push('INTL');
  if (r.campus === 'INTL' && BAN_INTL_INSTALLED_FOR_SEOUL.has(r.name)) banned.push('SEOUL');
  return {
    campus: r.campus,
    college,
    name: r.name,
    grad: r.grad,
    single: toBlock(r.single),
    multi: toBlock(r.multi),
    minor: toBlock(r.minor),
    ...(r.otherMulti ? { otherMulti: r.otherMulti } : {}),
    ...(banned.length ? { multiBannedFor: [...new Set(banned)] } : {}),
    ...(r.mergedBasic ? { mergedBasic: true } : {}),
  };
});

const order = { MAJOR: 0, MULTI_MAJOR: 1, MICRO_DEGREE: 2, MINOR: 3 };
programs.sort((a, b) => Number(a.programId.startsWith('SAMPLE')) - Number(b.programId.startsWith('SAMPLE')) || order[a.kind] - order[b.kind]);

writeFileSync(new URL('src/data/courses.json', root), JSON.stringify([...courses.values()], null, 1) + '\n');
writeFileSync(new URL('src/data/programs.json', root), JSON.stringify(programs, null, 1) + '\n');
writeFileSync(new URL('src/data/departments.json', root), JSON.stringify({
  source: { doc: '2026학년도 학사제도안내 「2026학년도 전공별 교육과정 기본구조」 (40~43쪽)', year: 2026 },
  departments,
}, null, 1) + '\n');
console.log(`과목 ${courses.size}개, 과정 ${programs.length}개, 학과 기본구조 ${departments.length}개`);
