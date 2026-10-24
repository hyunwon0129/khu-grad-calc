@echo off
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo 처음 실행: 필요한 파일을 설치합니다. 1~2분 걸립니다...
  call npm install
)
echo 브라우저에서 http://localhost:5173 이 열립니다. 끄려면 이 창을 닫으세요.
call npm run dev -- --open
pause
