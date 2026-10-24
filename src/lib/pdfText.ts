// PDF 텍스트를 브라우저 안에서만 추출한다(서버 전송 없음). 결과 줄은 파싱 직후 버린다.

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

/** 같은 높이(y)의 글자 조각을 한 줄로 묶고, 위→아래, 왼→오 순서로 정렬 */
export function groupIntoLines(items: TextItem[], tolerance = 2): string[] {
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows
    .sort((a, b) => b.y - a.y) // PDF 좌표는 아래가 0
    .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim());
}

export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const { default: PdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline');
  const worker = new PdfWorker();
  pdfjs.GlobalWorkerOptions.workerPort = worker;

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const lines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of content.items) {
        if ('str' in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
      }
      lines.push(...groupIntoLines(items));
    }
    return lines;
  } finally {
    data.fill(0);
    await task.destroy();
    worker.terminate();
  }
}
