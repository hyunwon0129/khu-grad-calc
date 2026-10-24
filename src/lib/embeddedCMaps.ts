// 한글 PDF(UniKS-UCS2-H 등 CID 글꼴)를 읽으려면 pdf.js에 CMap 파일이 필요하다.
// 네트워크 없이 동작하도록 한국어 CMap만 앱에 내장하고 메모리에서 꺼내 준다.

/** pdf.js가 CMap을 요청할 때 쓰는 공장 클래스를 만든다. files: 파일명 → 바이트 */
export function makeEmbeddedFactory(files: Map<string, Uint8Array>) {
  return class EmbeddedBinaryDataFactory {
    constructor(_opts: unknown) {}
    async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
      if (kind !== 'cMapUrl') throw new Error(`내장 데이터 없음: ${kind}`);
      const data = files.get(filename);
      if (!data) throw new Error(`내장 CMap 없음: ${filename}`);
      return data.slice(); // 워커로 넘어가며 버퍼가 분리될 수 있어 복사본을 준다
    }
  };
}

function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cache: Map<string, Uint8Array> | null = null;

/** 빌드 시 한국어 CMap을 data URL로 묶어 넣는다 (Vite 전용) */
export function koreanCMaps(): Map<string, Uint8Array> {
  if (cache) return cache;
  const modules = import.meta.glob<string>(
    [
      '/node_modules/pdfjs-dist/cmaps/UniKS-*.bcmap',
      '/node_modules/pdfjs-dist/cmaps/KSC*.bcmap',
      '/node_modules/pdfjs-dist/cmaps/Adobe-Korea1-*.bcmap',
    ],
    { query: '?inline', import: 'default', eager: true },
  );
  cache = new Map(
    Object.entries(modules).map(([path, url]) => [path.split('/').pop()!, dataUrlToBytes(url)]),
  );
  return cache;
}
