// 배포용 zip: 모든 코드를 index.html 한 파일에 담는다.
// → 더블클릭(file://)으로 열어도 동작하고, Netlify·GitHub Pages에 올려도 그대로 동작한다.
// 외부 글꼴 등 외부 요청 없음. 파일·폴더 이름은 영문만 (Windows 한글 이름 깨짐 방지).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';

const name = 'khu-grad-calc-site';
const dist = 'dist';
const html = readFileSync(`${dist}/index.html`, 'utf8');
const assets = readdirSync(`${dist}/assets`);
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dist}/assets/${f}`, 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dist}/assets/${f}`, 'utf8')).join('\n')
  .replace(/<\/script/gi, '<\\/script');
if (assets.filter((f) => f.endsWith('.js')).length !== 1) throw new Error('JS가 한 파일로 합쳐지지 않았습니다 (PREVIEW=1 빌드 필요)');

const out = html
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, '')
  .replace('</head>', () => `<style>${css}</style>\n</head>`) // 함수형: 코드 속 $& 등이 치환 패턴으로 해석되지 않게
  .replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
if (!out.includes(js.slice(-200))) throw new Error('JS가 온전히 들어가지 않았습니다');
if (/src="\.\/assets|href="\.\/assets/.test(out)) throw new Error('외부 assets 참조가 남아 있습니다');

rmSync('release', { recursive: true, force: true });
mkdirSync(`release/${name}`, { recursive: true });
writeFileSync(`release/${name}/index.html`, out);
copyFileSync(`${dist}/favicon.svg`, `release/${name}/favicon.svg`);
for (const f of ['_headers', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']) {
  copyFileSync(`${dist}/${f}`, `release/${name}/${f}`);
}
// Netlify 빌드 서버에서는 폴더만 만들면 된다 (zip 불필요)
if (!process.env.NETLIFY) execSync(`cd release && zip -qrX "${name}.zip" "${name}"`);
console.log(`release/${name}.zip (index.html ${(out.length / 1024).toFixed(0)}KB)`);
