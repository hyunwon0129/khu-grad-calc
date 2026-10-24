// dist/ 빌드 결과를 미리보기용 단일 HTML 파일(preview/index.html)로 합친다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const assets = readdirSync(new URL('assets/', dist));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL(`assets/${f}`, dist), 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(`assets/${f}`, dist), 'utf8')).join('\n')
  .replace(/<\/script/gi, '<\\/script');

const html = `<title>졸업요건 계산기</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@400;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
mkdirSync(new URL('../preview/', import.meta.url), { recursive: true });
writeFileSync(new URL('../preview/index.html', import.meta.url), html);
console.log(`preview/index.html ${(html.length / 1024).toFixed(0)}KB`);
