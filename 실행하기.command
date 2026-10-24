#!/bin/bash
# macOS: 더블클릭으로 실행
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  open https://nodejs.org
  read -p "엔터를 누르면 닫힙니다"
  exit 1
fi
[ -d node_modules ] || { echo "처음 실행: 필요한 파일을 설치합니다. 1~2분 걸립니다..."; npm install; }
echo "브라우저에서 http://localhost:5173 이 열립니다. 끄려면 이 창을 닫으세요."
npm run dev -- --open
