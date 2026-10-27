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

-- ── 서버 쪽 데이터 검사 (브라우저의 sanitize를 우회해 직접 API를 호출해도 막히게)
-- 1) data는 객체여야 하고 허용한 키만 남긴다 (이름·학번·성적 같은 키를 넣어도 저장되지 않음)
-- 2) user_id는 항상 요청한 본인으로 고정, updated_at은 서버 시각
create or replace function public.grad_progress_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed text[] := array['programId','taken','custom','excluded','maxCreditsPerSemester','report','plans','libOptions'];
  report_allowed text[] := array['source','importedAt','department','admissionYear','areas','categories','checks'];
begin
  if jsonb_typeof(new.data) <> 'object' then
    raise exception 'data must be an object';
  end if;
  if jsonb_typeof(coalesce(new.data->'taken', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.data->'taken', '[]'::jsonb)) > 400 then
    raise exception 'taken must be an array (max 400)';
  end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into new.data
    from jsonb_each(new.data) as e(k, v) where k = any(allowed);
  if jsonb_typeof(new.data->'report') = 'object' then
    new.data := jsonb_set(new.data, '{report}', (
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(new.data->'report') as e(k, v) where k = any(report_allowed)
    ));
  end if;
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists grad_progress_guard on public.grad_progress;
create trigger grad_progress_guard
  before insert or update on public.grad_progress
  for each row execute function public.grad_progress_guard();
