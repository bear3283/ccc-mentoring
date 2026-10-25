-- ═══════════════════════════════════════════════════════════
-- 같은 번호는 한 번만 등록 (고3·대학생 구분 없이)
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
--
-- 같은 번호가 이미 두 건 이상 있으면 아무것도 바꾸지 않고 멈춥니다.
-- 그때는 운영자 화면 → "점검" 탭에서 같은 번호를 정리한 뒤 다시 실행하세요.
-- 코드는 이 SQL 없이도 같은 번호를 막습니다. 이 제약은 동시에 두 번 눌린
-- 요청까지 막는 마지막 방어선입니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

do $$
declare dup_count int;
begin
  select count(*) into dup_count from (
    select regexp_replace(contact, '\D', '', 'g')
    from public.users
    group by 1
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception '같은 번호로 등록된 사람이 % 건 있습니다. 점검 탭에서 정리한 뒤 다시 실행하세요.', dup_count;
  end if;
end $$;

-- 하이픈을 떼고 숫자만 비교한다. 010-1234-5678 과 01012345678 을 같은 번호로 본다.
create unique index if not exists users_contact_digits_unique
  on public.users (regexp_replace(contact, '\D', '', 'g'));

-- (번호, 역할) 제약은 위 인덱스가 더 넓게 덮으므로 필요 없지만, 지우지 않는다.
-- 예전 코드나 스크립트가 이 이름에 기대고 있어도 깨지지 않게 둔다.
