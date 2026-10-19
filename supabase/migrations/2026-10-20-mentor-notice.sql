-- ═══════════════════════════════════════════════════════════
-- 선배 알림 기록
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다.
--
-- 순서가 중요합니다: 이 SQL을 먼저 실행하고 코드를 배포하세요.
-- 코드가 먼저 나가면 운영자 화면이 열리지 않습니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- 후배가 선배를 골라도 선배에게는 자동 알림이 가지 않는다. 운영자가 문자로 알린다.
-- 누구에게 이미 알렸는지 남겨야 두 번 보내거나 빠뜨리지 않는다.
alter table public.matchings
  add column if not exists mentor_notified_at timestamptz,
  add column if not exists mentor_notified_via text;

-- ADMIN_SMS     = 운영자 화면에서 문자 앱을 열어 직접 보냄
-- MAC_MESSAGES  = scripts/notify-mentors.ts 가 맥의 메시지 앱으로 보냄
do $$ begin
  alter table public.matchings
    add constraint matchings_mentor_notified_via_check
    check (mentor_notified_via is null or mentor_notified_via in ('ADMIN_SMS', 'MAC_MESSAGES'));
exception when duplicate_object then null; end $$;
