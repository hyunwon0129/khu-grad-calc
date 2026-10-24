-- 졸업요건 계산기 DB 스키마 (Supabase SQL Editor에 붙여넣고 실행)
-- 한 사용자당 한 행. data에는 학수번호·학기·설정만 들어간다 (src/lib/storage.ts의 UserData).

create table if not exists public.grad_progress (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  -- 비정상적으로 큰 데이터 차단 (과목 수백 개여도 수십 KB 이내)
  constraint grad_progress_size check (pg_column_size(data) < 200000)
);

-- 행 단위 보안: 로그인한 본인 행만 읽고 쓸 수 있다
alter table public.grad_progress enable row level security;

drop policy if exists "본인 조회" on public.grad_progress;
drop policy if exists "본인 생성" on public.grad_progress;
drop policy if exists "본인 수정" on public.grad_progress;
drop policy if exists "본인 삭제" on public.grad_progress;

create policy "본인 조회" on public.grad_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 생성" on public.grad_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 수정" on public.grad_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 삭제" on public.grad_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 비로그인(anon) 사용자는 아무것도 할 수 없다
revoke all on public.grad_progress from anon;
grant select, insert, update, delete on public.grad_progress to authenticated;
