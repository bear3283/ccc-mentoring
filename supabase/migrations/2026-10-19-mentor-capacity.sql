-- ═══════════════════════════════════════════════════════════
-- 멘토 정원 (1:1 → 멘토가 고른 1~3명)
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
--
-- 순서가 중요합니다: 이 SQL을 먼저 실행하고 코드를 배포하세요.
-- 코드가 먼저 나가면 멘토 신청이 capacity 컬럼이 없어 저장 단계에서 실패합니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- 멘토가 신청할 때 고르는 정원. 기존 멘토는 지금까지처럼 1명이다.
alter table public.mentor_profiles
  add column if not exists capacity int not null default 1;

do $$ begin
  alter table public.mentor_profiles
    add constraint mentor_profiles_capacity_range check (capacity between 1 and 3);
exception when duplicate_object then null; end $$;

-- 멘토 쪽 1명 제한을 걷어낸다. 정원은 아래 트리거가 지킨다.
-- 멘티 쪽(matchings_mentee_taken_unique)은 그대로 둔다 — 멘티는 여전히 한 명만 고른다.
drop index if exists public.matchings_mentor_taken_unique;

-- 정원 검사.
--
-- 코드에서 "자리가 남았는지" 세는 것만으로는 부족하다. 마지막 한 자리에
-- 두 멘티가 같은 순간에 누르면 둘 다 0명을 보고 통과한다.
-- 멘토 프로필 행을 잠가 같은 멘토에 대한 요청을 한 줄로 세운 뒤에 센다.
-- 잠금을 얻은 뒤의 count 는 앞선 요청이 커밋한 행까지 본다(READ COMMITTED).
create or replace function public.enforce_mentor_capacity()
returns trigger
language plpgsql
as $$
declare
  seat_limit int;
  taken int;
begin
  if new.status not in ('REQUESTED', 'CONFIRMED') then
    return new;
  end if;

  -- 이미 성사된 건의 상태만 바뀌는 경우(REQUESTED → CONFIRMED)는 새 자리가 아니다.
  if tg_op = 'UPDATE'
     and old.status in ('REQUESTED', 'CONFIRMED')
     and old.mentor_id = new.mentor_id then
    return new;
  end if;

  select capacity into seat_limit
    from public.mentor_profiles
    where user_id = new.mentor_id
    for update;

  -- 프로필이 없는 멘토는 매칭 후보가 될 수 없지만, 들어오면 예전처럼 1명으로 본다.
  seat_limit := coalesce(seat_limit, 1);

  select count(*) into taken
    from public.matchings
    where mentor_id = new.mentor_id
      and status in ('REQUESTED', 'CONFIRMED')
      and id <> new.id;

  if taken >= seat_limit then
    raise exception 'mentor_full: 멘토 정원(%)이 찼습니다', seat_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists matchings_mentor_capacity on public.matchings;
create trigger matchings_mentor_capacity
  before insert or update of status, mentor_id on public.matchings
  for each row execute function public.enforce_mentor_capacity();
