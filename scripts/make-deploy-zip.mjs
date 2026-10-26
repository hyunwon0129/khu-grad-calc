// dist/ 를 '졸업요건계산기-배포' 폴더로 감싼 zip으로 만든다 (Netlify Drop 등에 끌어다 놓기용)
import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const name = '졸업요건계산기-배포';
rmSync(`release/${name}`, { recursive: true, force: true });
mkdirSync('release', { recursive: true });
cpSync('dist', `release/${name}`, { recursive: true });
rmSync(`release/${name}.zip`, { force: true });
execSync(`cd release && zip -qr "${name}.zip" "${name}"`);
console.log(`release/${name}.zip`);
