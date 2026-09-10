-- ═══════════════════════════════════════════════════════════
-- 실행 방법
--   1. supabase.com 접속 → 프로젝트 선택
--   2. 왼쪽 메뉴에서 "SQL Editor" 클릭
--   3. "New query" 클릭
--   4. 아래 내용을 전부 복사해서 붙여넣기
--   5. 오른쪽 아래 "Run" 클릭 (또는 Cmd+Enter)
--
-- "Success. No rows returned" 가 나오면 정상입니다.
-- 여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════


-- ① 개인정보 동의 기록용 컬럼
alter table public.users
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;


-- ② 동의 없이는 저장되지 않도록
do $$ begin
  alter table public.users
    add constraint users_consent_required
    check (consented_at is not null and consent_version is not null);
exception when duplicate_object then null; end $$;


-- ③ 같은 연락처로 중복 신청 방지 (역할별)
do $$ begin
  alter table public.users
    add constraint users_contact_role_unique unique (contact, role);
exception when duplicate_object then null; end $$;
