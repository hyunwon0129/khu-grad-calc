# 경희대 졸업요건 계산기 (2026 KHU AI Challenge 출품작)

비공식 서비스. 모든 계산은 브라우저 안에서만 이루어지며 입력 정보는 외부로 전송되지 않습니다.

## 배포 (설치 없이 링크로 쓰기)

운영 주소: https://hyunwon0129.github.io/khu-grad-calc/ (main에 push하면 GitHub Actions가 테스트·빌드·배포). 자세한 방법은 `docs/배포.md`, `docs/SETUP-서버.md`.

## 실행 (개발용)

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # 계산·추천 로직 테스트
npm run validate   # 데이터(JSON) 검증
npm run build      # 배포용 빌드 → dist/
```

## 폴더 구조

```
src/
  data/
    courses.json    과목: 학수번호, 과목명, 학점, 과정별 이수구분
    programs.json   과정: 학과·학번별 요건, 체계표(선수과목·트랙), 출처
  lib/
    types.ts        데이터 스키마
    calc.ts         요건 조회, 학점 계산, 중복 제거
    recommend.ts    다음 과목 추천, 트랙 달성률, 다전공·MD 추천
    calc.test.ts    단위 테스트
  App.tsx           최소 동작 화면
scripts/
  validate-data.mjs 데이터 검증 (학수번호 형식, 누락, 학점 합)
raw/                학교 원본 자료(요람, 개설과목 엑셀) — git 제외
```

## 데이터 추가 방법

1. 원본 자료를 `raw/`에 둔다 (git에 올라가지 않음).
2. 변환 스크립트로 `courses.json`, `programs.json`에 추가한다.
3. `npm run validate`로 오류 확인.
4. 원문과 대조 검증을 마친 과정만 `"verified": true`로 바꾼다.

데이터는 2026 학과 교육과정 책자·시행세칙과 학사제도안내에서 추출했습니다(출처: `data-src/SOURCES.md`). 테스트용 사정표 PDF(`src/test-fixtures`)는 `scripts/fixtures/make_reports.py`로 만든 가상 학생 자료입니다.

## 로그인·배포 (선택)

서버 없이 Supabase(로그인·DB)와 GitHub Pages로 운영합니다. 설정 방법은 `docs/SETUP-서버.md`.
환경변수가 없으면 로그인 기능이 숨겨지고 로컬 전용으로 동작합니다.

## 개인정보 원칙

- 실제 졸업사정표, 학번, 이름이 담긴 파일은 저장소에 올리지 않습니다.
- 시연·캡처는 가상 학생 데이터로만 합니다.
- 학교 포털 계정 정보를 요구하지 않습니다.
- 로그인 시 서버에는 학수번호·학기·설정만 저장합니다 (`src/lib/storage.ts`의 `sanitize`).
- 브라우저 코드에는 Supabase `anon` 키만 넣습니다. `service_role` 키는 절대 넣지 않습니다.
