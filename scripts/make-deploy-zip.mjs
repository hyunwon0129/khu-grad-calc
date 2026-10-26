// dist/ 를 site 폴더로 감싼 zip으로 만든다 (Netlify Drop 등에 끌어다 놓기용).
// 파일·폴더 이름은 영문만 쓴다 (한글 이름은 Windows 압축 해제 시 깨지거나 빈 폴더로 보일 수 있음).
import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const name = 'khu-grad-calc-site';
rmSync('release', { recursive: true, force: true });
mkdirSync('release', { recursive: true });
cpSync('dist', `release/${name}`, { recursive: true });
execSync(`cd release && zip -qrX "${name}.zip" "${name}"`);
console.log(`release/${name}.zip`);
