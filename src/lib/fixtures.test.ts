// 가상 졸업사정표 PDF 5종으로 전체 분석을 검증하는 회귀 테스트.
// PDF는 scripts/fixtures/make_reports.py로 만든다 (실제 사정표와 같은 배치·한글 인코딩, 값은 모두 가상).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { makeEmbeddedFactory } from './embeddedCMaps';
import { groupIntoLines, type TextItem } from './pdfText';
import { analyzeReport } from './parseReport';
import { matchWithSchool } from './reportLayout';

const FIX = 'src/test-fixtures/';
const CMAPS = 'node_modules/pdfjs-dist/cmaps/';
const cmapFiles = new Map(
  readdirSync(CMAPS).filter((f) => /^(UniKS-|KSC|Adobe-Korea1-)/.test(f)).map((f) => [f, new Uint8Array(readFileSync(CMAPS + f))]),
);

/** 브라우저의 extractPdfText와 같은 방식 (쪽마다 y를 아래로 이어 붙임) */
async function extract(path: string) {
  const task = getDocument({
    data: new Uint8Array(readFileSync(path)), cMapUrl: 'embedded:/', cMapPacked: true, useWorkerFetch: false,
    BinaryDataFactory: makeEmbeddedFactory(cmapFiles), verbosity: 0,
  } as Parameters<typeof getDocument>[0]);
  const doc = await task.promise;
  const lines: string[] = [];
  const all: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    const items = (c.items as { str?: string; transform?: number[] }[])
      .filter((i) => i.str?.trim())
      .map((i) => ({ str: i.str!, x: i.transform![4], y: i.transform![5] }));
    lines.push(...groupIntoLines(items));
    all.push(...items.map((i) => ({ ...i, y: i.y - (p - 1) * 10000 })));
  }
  await task.destroy();
  return { lines, items: all };
}

const names = readdirSync(FIX).filter((f) => f.endsWith('.pdf')).map((f) => f.replace(/\.pdf$/, ''));

describe.each(names)('가상 사정표 %s', (name) => {
  const expected = JSON.parse(readFileSync(`${FIX}${name}.expected.json`, 'utf8'));
  const analysis = extract(`${FIX}${name}.pdf`).then(({ lines, items }) => analyzeReport(lines, items, new Map(), '2026-2'));

  it('학과·입학연도', async () => {
    const r = await analysis;
    expect(r.departmentHint).toBe(expected.department);
    expect(r.admissionYearHint).toBe(expected.admissionYear);
  });

  it('과목 수와 수강 중 과목', async () => {
    const r = await analysis;
    expect(r.rows).toHaveLength(expected.courseCount);
    expect(r.rows.filter((x) => x.status === 'IN_PROGRESS')).toHaveLength(expected.inProgress);
  });

  it('과목별 학교 이수구분', async () => {
    const r = await analysis;
    expect(Object.fromEntries(r.rows.map((x) => [x.code, x.category]))).toEqual(expected.categories);
  });

  it('영역별 취득/기준', async () => {
    const r = await analysis;
    expect(Object.fromEntries(r.areas.map((a) => [a.name, [a.earned, a.required]]))).toEqual(expected.areas);
  });

  it('학점 밖 졸업요건', async () => {
    const r = await analysis;
    expect(Object.fromEntries(r.checks.map((c) => [c.key, c.status]))).toEqual(expected.checks);
    expect(r.checks.find((c) => c.key === 'gpa')?.detail).toBeUndefined(); // 평점 값은 남기지 않음
  });

  it('학교 집계와 일치', async () => {
    const r = await analysis;
    expect(matchWithSchool(r.rows, r.areas).mismatches).toEqual([]);
  });

  it('개인정보가 결과에 남지 않음', async () => {
    const r = await analysis;
    expect(JSON.stringify(r)).not.toMatch(/000123|가상학생|031-000-0000/);
  });
});
