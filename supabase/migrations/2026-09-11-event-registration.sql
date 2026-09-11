-- ═══════════════════════════════════════════════════════════
-- 행사 등록 / 멘토링 신청 2단계 분리
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 등록 기본정보 ────────────────────────────────────────
alter table public.users
  add column if not exists church text,
  -- 출석하는 교회가 없는 사람. 행사에서 따로 챙겨야 할 대상이라 표시해 둔다.
  add column if not exists is_new_friend boolean not null default false,
  -- 멘토링까지 신청했는지. 등록만 하고 끝낸 사람과 구분한다.
  add column if not exists mentoring_applied boolean not null default false;

-- ── 2. 멘토링 항목을 선택으로 바꾼다 ────────────────────────
-- 행사 등록만 한 사람은 성향·시간대·성별이 없다.
-- 지금은 not null 이라 등록 자체가 막힌다.
alter table public.users alter column persona_type drop not null;
alter table public.users alter column gender drop not null;

-- available_times 는 '최소 1개' 제약이 걸려 있다.
-- 멘토링을 신청한 사람만 지키면 되는 조건이라 조건부로 바꾼다.
do $$ begin
  alter table public.users drop constraint users_available_times_check;
exception when undefined_object then null; end $$;

alter table public.users
  alter column available_times drop not null,
  alter column available_times set default '{}';

do $$ begin
  alter table public.users
    add constraint users_mentoring_fields_required
    check (
      not mentoring_applied
      or (
        persona_type is not null
        and available_times is not null
        and array_length(available_times, 1) >= 1
      )
    );
exception when duplicate_object then null; end $$;

-- ── 3. 조회용 인덱스 ────────────────────────────────────────
-- 운영자가 '새친구만', '멘토링 신청자만' 을 자주 본다.
create index if not exists users_new_friend_idx on public.users (is_new_friend);
create index if not exists users_mentoring_applied_idx on public.users (mentoring_applied);
