-- ═══════════════════════════════════════════════════════════
-- 멘토링 가능 시간대를 더 이상 받지 않는다
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
--
-- 배포 순서와 상관없습니다. 예전 제약의 array_length('{}', 1) 은 NULL 이 되고
-- check 제약은 NULL 을 통과시키므로, 빈 배열은 원래부터 막히지 않았습니다.
-- 이 SQL은 제약이 실제 규칙("성향만 필수")을 그대로 말하도록 정리하는 것입니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- 1:1 멘토링 날짜는 매칭된 뒤 선배·후배가 문자로 정한다. 신청서에서 시간대를
-- 묻지 않으므로 "멘토링 신청자는 시간대 1개 이상" 조건을 뺀다.
-- 성향(persona_type)은 계속 받으므로 그 조건만 남긴다.
--
-- 성별은 여기서 강제하지 않는다. 성별을 받기 전에 멘토링까지 신청한 행이
-- 이미 있어서, 제약을 걸면 그 행들 때문에 실행 자체가 실패한다.
-- 성별은 서버 검증(validate.ts)이 새 신청마다 확인한다.
--
-- available_times 컬럼은 지우지 않는다. 이전 신청자의 값이 남아 있고,
-- 새 신청은 기본값('{}')으로 저장된다.
alter table public.users drop constraint if exists users_mentoring_fields_required;

do $$ begin
  alter table public.users
    add constraint users_mentoring_fields_required
    check (not mentoring_applied or persona_type is not null);
exception when duplicate_object then null; end $$;
