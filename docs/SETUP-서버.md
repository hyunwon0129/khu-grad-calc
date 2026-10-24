# 로그인·배포 설정 (서버 없이, 무료)

구성: **화면 = GitHub Pages(정적 호스팅)**, **로그인·DB = Supabase 무료 플랜**.
직접 운영하는 서버는 없습니다. 사정표 PDF 분석은 계속 사용자 브라우저 안에서만 합니다.

```
[학생 브라우저] ──(정적 파일)── GitHub Pages
      │  PDF 분석·계산은 여기서만
      └─(학수번호·학기·설정, HTTPS)── Supabase  ─ 로그인(이메일 링크/카카오/구글)
                                              └ grad_progress 테이블 (본인 행만 접근, RLS)
```

## 1. Supabase 프로젝트 (약 10분)

1. https://supabase.com 가입 → **New project**
   - Region: **Northeast Asia (Seoul)** 권장
   - DB 비밀번호는 따로 보관 (앱에는 쓰지 않음)
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**
3. **Project Settings → API**에서 두 값을 복사
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` 키 → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ `service_role` 키는 앱·저장소·채팅 어디에도 붙여넣지 마세요.
4. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://<github아이디>.github.io/khu-grad-calc/`)
   - Redirect URLs에 추가: 위 주소, `http://localhost:5173/`

## 2. 로그인 방법 켜기

- **이메일 링크**: 기본으로 켜져 있음. 무료 플랜 기본 메일 발송은 시간당 몇 통으로 제한되므로, 시연 전에 Authentication → Emails에서 SMTP 연결을 검토하세요.
- **카카오** (선택): Kakao Developers에서 앱 생성 → REST API 키·Client Secret 발급 → Redirect URI에 `https://<프로젝트>.supabase.co/auth/v1/callback` 등록 → Supabase Authentication → Providers → Kakao에 키 입력.
  카카오는 이메일 제공 동의 항목 설정(비즈 앱 여부)에 따라 로그인이 실패할 수 있으니 실제로 한 번 로그인해 확인하세요. 안 되면 이메일·구글만 쓰면 됩니다.
- **구글** (선택): Google Cloud Console에서 OAuth 클라이언트 생성 → Supabase Providers → Google에 입력.
- 켠 소셜 로그인은 `VITE_AUTH_PROVIDERS=kakao,google`처럼 적습니다.

## 3. 로컬에서 확인

```bash
cp .env.example .env.local   # 값 채우기
npm run dev                  # 오른쪽 위 '로그인' 버튼이 생김
```

## 4. 회원 탈퇴 함수 배포 (선택, 권장)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <프로젝트 ref>
supabase functions deploy delete-account
```
배포하지 않으면 '회원 탈퇴' 버튼이 오류를 냅니다. ('서버 데이터 삭제'는 함수 없이 동작)

## 5. GitHub Pages 배포

1. GitHub에 저장소 생성 후 push
2. Settings → Secrets and variables → Actions
   - Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Variables: `VITE_AUTH_PROVIDERS` (예: `kakao`)
3. Settings → Pages → Source: **GitHub Actions**
4. main에 push하면 `.github/workflows/deploy.yml`이 테스트 → 빌드 → 배포

Vercel을 쓰려면: Import Project → 같은 환경변수 3개 입력 → Deploy. 설정 파일 추가 없이 됩니다.

## 6. 점검 체크리스트

- [ ] 로그인 안 한 상태로 `grad_progress`를 조회하면 빈 결과 (RLS)
- [ ] A 계정으로 저장한 데이터가 B 계정에서 안 보임
- [ ] 브라우저 개발자도구 Network 탭: 사정표 업로드 중 외부 요청 0건
- [ ] 동기화 요청 본문에 이름·학번·성적이 없음 (programId, taken, custom, excluded, maxCreditsPerSemester만)
- [ ] '서버 데이터 삭제', '회원 탈퇴' 동작
- [ ] `docs/개인정보처리방침-초안.md`를 다듬어 앱에 링크
