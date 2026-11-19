-- ═══════════════════════════════════════════════════════════
-- 운영자가 후배·선배를 직접 연결하고, 후배에게도 알린다
--
-- 실행: supabase.com → SQL Editor → New query → 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다. 기존 매칭은 비어 있는 채로 남습니다.
--
-- 순서가 중요합니다: 이 SQL을 먼저 실행하고 코드를 배포하세요.
-- 코드가 먼저 나가면 운영자 화면이 열리지 않습니다.
-- 확인: npm run check:db
-- ═══════════════════════════════════════════════════════════

-- 후배가 직접 고른 연결은 후배가 이미 선배 번호를 봤다. 운영자가 이어 준 연결은
-- 후배가 모르므로 문자로 알려야 한다. 둘을 가르려고 누가 이었는지 남긴다.
alter table public.matchings
  add column if not exists admin_assigned_at timestamptz,
  add column if not exists mentee_notified_at timestamptz,
  add column if not exists mentee_notified_via text;

-- 등록만 하고 멘토링을 신청하지 않은 고3에게 신청 안내 문자를 보냈는지.
-- 두 번 보내거나 빠뜨리지 않으려고 남긴다.
alter table public.users
  add column if not exists mentoring_invited_at timestamptz;

-- ADMIN_SMS = 운영자 화면에서 문자 앱을 열어 직접 보냄
do $$ begin
  alter table public.matchings
    add constraint matchings_mentee_notified_via_check
    check (mentee_notified_via is null or mentee_notified_via in ('ADMIN_SMS'));
exception when duplicate_object then null; end $$;
